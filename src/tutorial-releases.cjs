'use strict';
// Approved local release. Each request validates the actual media before exposing it.
const releases = Object.freeze([Object.freeze({
  locale: 'pt',
  videoSrc: '/tutorial-painel/tutorial.pt.mp4',
  subtitleSrc: '/tutorial-painel/tutorial.pt.vtt',
  approval: Object.freeze({
    approvedByOwner: true,
    approvedAtUtc: '2026-10-04T01:32:00Z',
    videoSha256: 'be14748ec977492e80df5eb3ca50a2f8c783b201e7d61b2e4759129ad922da8b',
    subtitleSha256: '49d9ed65525afc6f9f3ec1818a53e7bbf19c36390ce105706494552d95b4bf56'
  })
})]);
module.exports = Object.freeze({ releases, enabledLocales: Object.freeze(['pt']) });
