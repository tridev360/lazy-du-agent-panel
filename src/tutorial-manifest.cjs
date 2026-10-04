'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_VIDEO_BYTES = 5 * 1024 * 1024;
const MAX_VTT_BYTES = 256 * 1024;
const LOCALES = ['pt', 'en', 'es'];
const LOCAL_ASSET = /^\/tutorial-painel\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.(mp4|vtt)$/;
const SHA256 = /^[a-f0-9]{64}$/;
const emptyManifest = () => ({ version: 1, tutorials: {} });

function boxes(buffer, start = 0, end = buffer.length) {
  const result = [];
  for (let offset = start; offset < end;) {
    if (end - offset < 8) throw Error('MP4_BOX');
    let size = buffer.readUInt32BE(offset), header = 8;
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (size === 1) {
      if (end - offset < 16) throw Error('MP4_BOX');
      const large = buffer.readBigUInt64BE(offset + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('MP4_BOX');
      size = Number(large); header = 16;
    } else if (size === 0) size = end - offset;
    if (size < header || size > end - offset) throw Error('MP4_BOX');
    result.push({ type, start: offset + header, end: offset + size });
    offset += size;
  }
  return result;
}

// Reads the final MP4 container's movie duration, without ffprobe or a process.
function mp4Duration(buffer) {
  try {
    const top = boxes(buffer);
    if (!top.some(box => box.type === 'ftyp')) return null;
    const movie = top.find(box => box.type === 'moov');
    if (!movie) return null;
    const header = boxes(buffer, movie.start, movie.end).find(box => box.type === 'mvhd');
    if (!header) return null;
    const data = buffer.subarray(header.start, header.end), version = data[0];
    let timescale, duration;
    if (version === 0 && data.length >= 20) {
      timescale = data.readUInt32BE(12); duration = data.readUInt32BE(16);
    } else if (version === 1 && data.length >= 32) {
      timescale = data.readUInt32BE(20);
      const value = data.readBigUInt64BE(24);
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      duration = Number(value);
    } else return null;
    const seconds = duration / timescale;
    return timescale > 0 && Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch { return null; }
}

function timestamp(value) {
  const match = /^(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})$/.exec(value);
  if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) return null;
  return Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

function validVtt(text, duration) {
  const lines = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  if (!/^WEBVTT(?:[ \t].*)?$/.test(lines[0]) || lines[1]?.trim()) return false;
  const blocks = lines.slice(2).join('\n').split(/\n[ \t]*\n/).filter(block => block.trim());
  let count = 0;
  for (const block of blocks) {
    const rows = block.trim().split('\n');
    if (/^(NOTE(?:[ \t]|$)|STYLE$|REGION$)/.test(rows[0])) continue;
    const index = rows[0].includes('-->') ? 0 : 1;
    const cue = /^([^ \t]+)[ \t]+-->[ \t]+([^ \t]+)(?:[ \t].*)?$/.exec(rows[index] || '');
    if (!cue || !rows.slice(index + 1).some(line => line.trim())) return false;
    const start = timestamp(cue[1]), end = timestamp(cue[2]);
    if (start === null || end === null || end <= start || end > duration + 0.25) return false;
    count++;
  }
  return count > 0;
}

function readAsset(publicDir, src, extension, limit) {
  const match = typeof src === 'string' && LOCAL_ASSET.exec(src);
  if (!match || match[1] !== extension) throw Error('LOCAL_ASSET');
  const root = fs.realpathSync(publicDir), target = fs.realpathSync(path.join(root, src.slice(1)));
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('LOCAL_ASSET');
  const stat = fs.statSync(target);
  if (!stat.isFile() || stat.size <= 0 || stat.size > limit) throw Error('ASSET_BYTES');
  const buffer = fs.readFileSync(target);
  if (buffer.length !== stat.size) throw Error('ASSET_CHANGED');
  return { buffer, bytes: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
}

// The caller supplies the actual owner approval. This module never reads coordination state.
function buildTutorialManifest({ publicDir, releases = [], enabledLocales = ['pt'] } = {}) {
  const manifest = emptyManifest();
  for (const release of Array.isArray(releases) ? releases : []) {
    const locale = release?.locale;
    if (!LOCALES.includes(locale) || !Array.isArray(enabledLocales) || !enabledLocales.includes(locale) || manifest.tutorials[locale]) continue;
    const ownLanguage = new RegExp('(?:^|[./_-])' + locale + '(?=[./_-]|$)');
    if (!ownLanguage.test(release.videoSrc || '') || !ownLanguage.test(release.subtitleSrc || '')) continue;
    const approval = release.approval;
    if (approval?.approvedByOwner !== true || !SHA256.test(approval.videoSha256 || '') ||
      !SHA256.test(approval.subtitleSha256 || '') || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(approval.approvedAtUtc || '') ||
      !Number.isFinite(Date.parse(approval.approvedAtUtc))) continue;
    try {
      const video = readAsset(publicDir, release.videoSrc, 'mp4', MAX_VIDEO_BYTES);
      const subtitle = readAsset(publicDir, release.subtitleSrc, 'vtt', MAX_VTT_BYTES);
      if (video.sha256 !== approval.videoSha256 || subtitle.sha256 !== approval.subtitleSha256) continue;
      const durationSeconds = mp4Duration(video.buffer);
      if (durationSeconds === null || !validVtt(subtitle.buffer.toString('utf8'), durationSeconds)) continue;
      manifest.tutorials[locale] = {
        locale, video: { src: release.videoSrc, bytes: video.bytes, sha256: video.sha256 },
        subtitle: { src: release.subtitleSrc, bytes: subtitle.bytes, sha256: subtitle.sha256 },
        durationSeconds, approvalMatched: true
      };
    } catch { /* Missing, changed or invalid files keep the tutorial unavailable. */ }
  }
  return manifest;
}

// Serve as the ordinary local JS asset with Cache-Control: no-store. Rebuild on each
// page load so a removed or changed file never inherits a previous availability.
function tutorialManifestScript(options) {
  return '(function(root){"use strict";root.PanelTutorialManifest=' + JSON.stringify(buildTutorialManifest(options)) + ';})(window);\n';
}

module.exports = { buildTutorialManifest, tutorialManifestScript, emptyManifest, mp4Duration, validVtt, MAX_VIDEO_BYTES, MAX_VTT_BYTES };
