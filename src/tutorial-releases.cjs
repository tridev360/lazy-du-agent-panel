'use strict';
// Approved local releases. Each request validates the actual media before exposing it.
const releases = Object.freeze([Object.freeze({
  locale: 'pt',
  videoSrc: '/tutorial-painel/tutorial.pt.mp4',
  subtitleSrc: '/tutorial-painel/tutorial.pt.vtt',
  approval: Object.freeze({
    approvedByOwner: true,
    approvedAtUtc: '2026-10-04T04:25:37Z',
    videoSha256: '9f50fd2bf592e1d6c27108196b3cc84f3bb3ec8fb9e5dca569efcb4bebacbae8',
    subtitleSha256: '315fab1fb2b476262cf466a002033eede6e3e090aa2bec21ef0280f96cef60f9'
  })
}),
Object.freeze({
  locale: 'en',
  videoSrc: '/tutorial-painel/tutorial.en.mp4',
  subtitleSrc: '/tutorial-painel/tutorial.en.vtt',
  approval: Object.freeze({
    approvedByOwner: true,
    approvedAtUtc: '2026-10-04T04:25:37Z',
    videoSha256: 'c6e211f065ef5e8a3796ef0b3cf6d756e2d6b39c2230ef35fc6212c854862a22',
    subtitleSha256: '2bf2cc2e6f2d5861a29045042afae3150b9d1cb6288e59d957bbef1d535d0874'
  })
}),
Object.freeze({
  locale: 'es',
  videoSrc: '/tutorial-painel/tutorial.es.mp4',
  subtitleSrc: '/tutorial-painel/tutorial.es.vtt',
  approval: Object.freeze({
    approvedByOwner: true,
    approvedAtUtc: '2026-10-04T04:25:37Z',
    videoSha256: 'f2680fd6aa5284fd772ec99f2316018fcb685a3d457aefff0b76c90424eaa44b',
    subtitleSha256: 'e9b098692f2b6eb7ebae720d9dbf30efc0102a44c93cc73b4ddfe07c4c0c59ae'
  })
})]);
module.exports = Object.freeze({ releases, enabledLocales: Object.freeze(['pt', 'en', 'es']) });
