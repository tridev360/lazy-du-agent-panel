const { execFile } = require("node:child_process");
function identify(name) {
  if (typeof name !== "string") return null;
  const value = name.trim();
  if (/^claude(?:\.exe)?$/i.test(value)) return "claude";
  if (/^codex(?:\.exe)?$/i.test(value)) return "codex";
  if (/^(?:node|nodejs)(?:\.exe)?$/i.test(value)) return "unknown";
  return null;
}
function processSnapshot({
  platform = process.platform,
  run = execFile,
  details = false,
} = {}) {
  return new Promise((resolve) => {
    const win = platform === "win32";
    const args = win
      ? [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "$ErrorActionPreference='Stop'; Get-CimInstance Win32_Process -Property Name | Select-Object -ExpandProperty Name",
        ]
      : ["-e", "-o", "comm="];
    run(
      win ? "powershell.exe" : "ps",
      args,
      { windowsHide: true, timeout: 2000, maxBuffer: 512 * 1024 },
      (error, stdout) => {
        if (error || typeof stdout !== "string") return resolve(null);
        const counts = { claude: 0, codex: 0, unknown: 0 };
        for (const line of stdout.split(/\r?\n/)) {
          const kind = identify(line);
          if (kind === "claude" || kind === "codex") counts[kind]++;
          else if (kind === "unknown") counts.unknown++;
        }
        const agents = ["claude", "codex"]
          .filter((kind) => counts[kind] > 0)
          .map((kind) => ({
            name: kind,
            count: counts[kind],
            folder: null,
            elapsedSeconds: null,
          }));
        if (counts.unknown) {
          counts.claude = null;
          counts.codex = null;
        }
        resolve(details ? { ...counts, agents } : counts);
      },
    );
  });
}
module.exports = { identify, processSnapshot };
