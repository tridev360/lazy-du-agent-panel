(function(root) {
  'use strict';
  const manifest = Object.freeze({ version: 1, tutorials: Object.freeze({}) });
  if (typeof module === 'object' && module.exports) module.exports = manifest;
  else root.PanelTutorialManifest = manifest;
})(typeof window === 'object' ? window : globalThis);
