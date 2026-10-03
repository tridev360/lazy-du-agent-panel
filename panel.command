#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "Lazy Du Panel needs Node.js 20 or newer on macOS. Install the LTS version from nodejs.org, then open this file again. / No macOS, instale o Node.js LTS de nodejs.org e abra este arquivo de novo." buttons {"OK"} default button "OK"'
  exit 1
fi
node src/open.cjs >/dev/null 2>&1 &
exit 0
