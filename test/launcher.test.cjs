const test = require("node:test");
const assert = require("node:assert/strict");
const { browserCommand } = require("../src/open.cjs");
test("browser launch uses platform commands and a local URL", () => {
  const url = "http://127.0.0.1:3251";
  assert.equal(browserCommand("win32", url).command, "powershell.exe");
  assert.match(browserCommand("win32", url).args.at(-1), /Start-Process/);
  assert.deepEqual(browserCommand("darwin", url), {
    command: "open",
    args: [url],
  });
  assert.deepEqual(browserCommand("linux", url), {
    command: "xdg-open",
    args: [url],
  });
});
