const test = require("node:test"),
  a = require("node:assert/strict");
const { identify, processSnapshot } = require("../src/lib/processes.cjs");
function fixture(platform, stdout, error = null) {
  const calls = [];
  return {
    calls,
    read: () =>
      processSnapshot({
        platform,
        run: (command, args, options, done) => {
          calls.push({ command, args, options });
          done(error, stdout);
        },
      }),
  };
}
test("identity uses only exact executable names and marks Node ambiguous", () => {
  for (const name of ["claude", "CLAUDE.EXE"])
    a.equal(identify(name), "claude");
  for (const name of ["codex", "codex.exe"]) a.equal(identify(name), "codex");
  for (const name of ["node", "node.exe", "nodejs"])
    a.equal(identify(name), "unknown");
  for (const name of [
    "node panel.cjs --prompt claude",
    "codex.exe app-server",
    "/tools/claude",
    "C:\\tools\\codex.exe",
    "/tools/@anthropic-ai/claude-code/cli.js",
    "chrome.exe",
  ])
    a.equal(identify(name), null);
  a.equal(identify({ Name: "claude.exe", CommandLine: "ignored" }), null);
});
test("Windows reads only the Name property with bounded hidden execution", async () => {
  const f = fixture("win32", "claude.exe\r\ncodex.exe\r\nchrome.exe\r\n");
  a.deepEqual(await f.read(), { claude: 1, codex: 1, unknown: 0 });
  const call = f.calls[0];
  a.equal(call.command, "powershell.exe");
  a.match(call.args.at(-1), /Get-CimInstance Win32_Process -Property Name/);
  a.match(call.args.at(-1), /Select-Object -ExpandProperty Name/);
  a.doesNotMatch(call.args.join(" "), /CommandLine|args=|cli\.js/);
  a.deepEqual(call.options, {
    windowsHide: true,
    timeout: 2000,
    maxBuffer: 512 * 1024,
  });
});
test("Unix asks ps for comm alone without process arguments", async () => {
  const f = fixture("linux", "claude\ncodex\ncodex\nsh\n");
  a.deepEqual(await f.read(), { claude: 1, codex: 2, unknown: 0 });
  a.equal(f.calls[0].command, "ps");
  a.deepEqual(f.calls[0].args, ["-e", "-o", "comm="]);
  a.equal(f.calls[0].options.timeout, 2000);
});
test("Node makes both agent counts unknown rather than inventing zero", async () => {
  for (const platform of ["win32", "linux"]) {
    const f = fixture(platform, "claude\nnode\nnode.exe\n");
    a.deepEqual(await f.read(), { claude: null, codex: null, unknown: 2 });
  }
});
test("measured absence is zero while process read failure stays unknown", async () => {
  a.deepEqual(await fixture("linux", "chrome\nsh\n").read(), {
    claude: 0,
    codex: 0,
    unknown: 0,
  });
  a.equal(await fixture("win32", "", Error("fixture timeout")).read(), null);
});

test("detailed process results retain native agents without reading arguments", async () => {
  const result = await processSnapshot({
    platform: "linux",
    details: true,
    run(command, args, options, callback) {
      callback(null, "claude\ncodex\nnode\n");
    },
  });
  a.equal(result.claude, null);
  a.deepEqual(
    result.agents.map((agent) => [agent.name, agent.count]),
    [
      ["claude", 1],
      ["codex", 1],
    ],
  );
  a.ok(
    result.agents.every(
      (agent) => agent.folder === null && agent.elapsedSeconds === null,
    ),
  );
});
