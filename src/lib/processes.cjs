const { execFile } = require("node:child_process");
const {key:sessionKey}=require('./session-story.cjs');
function identify(name) {
  if (typeof name !== "string") return null;
  const value = name.trim();
  if (/^claude(?:\.exe)?$/i.test(value)) return "claude";
  if (/^codex(?:\.exe)?$/i.test(value)) return "codex";
  if (/^(?:node|nodejs)(?:\.exe)?$/i.test(value)) return "unknown";
  return null;
}
function groupProcesses(rows) {
  const byId = new Map(rows.map((row) => [row.pid, row]));
  const top = { claude: 0, codex: 0 };
  for (const row of rows) {
    const kind = identify(row.name);
    if (!["claude", "codex"].includes(kind)) continue;
    let parent = byId.get(row.ppid);
    const visited = new Set([row.pid]);
    let child = false;
    while (parent && !visited.has(parent.pid)) {
      visited.add(parent.pid);
      if (["claude", "codex"].includes(identify(parent.name))) {
        child = true;
        break;
      }
      parent = byId.get(parent.ppid);
    }
    if (!child) top[kind]++;
  }
  return top;
}
function processSnapshot({
  platform = process.platform,
  run = execFile,
  details = false,
  bindSessions = false,
} = {}) {
  return new Promise((resolve) => {
    const windows = platform === "win32";
    const args = windows
      ? [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          bindSessions
            ? "$ErrorActionPreference='Stop'; @(Get-CimInstance Win32_Process -Filter \"Name='codex.exe' OR Name='claude.exe'\" | ForEach-Object { $match=[regex]::Match($_.CommandLine,'(?:resume|--session-id|--resume)\\s+([a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12})'); [pscustomobject]@{Name=$_.Name;ProcessId=$_.ProcessId;ParentProcessId=$_.ParentProcessId;Session=if($match.Success){$match.Groups[1].Value}else{$null}} }) | ConvertTo-Json -Compress"
            : details
            ? "$ErrorActionPreference='Stop'; @(Get-CimInstance Win32_Process -Property Name,ProcessId,ParentProcessId | Select-Object Name,ProcessId,ParentProcessId) | ConvertTo-Json -Compress"
            : "$ErrorActionPreference='Stop'; Get-CimInstance Win32_Process -Property Name | Select-Object -ExpandProperty Name",
        ]
      : details
        ? ["-e", "-o", "pid=,ppid=,comm="]
        : ["-e", "-o", "comm="];
    run(
      windows ? "powershell.exe" : "ps",
      args,
      { windowsHide: true, timeout: 2000, maxBuffer: 512 * 1024 },
      (error, stdout) => {
        if (error || typeof stdout !== "string") return resolve(null);
        let rows = [];
        try {
          if (details && windows) {
            const parsed = JSON.parse(stdout);
            rows = (Array.isArray(parsed) ? parsed : [parsed]).map((row) => ({
              name: row.Name,
              pid: row.ProcessId,
              ppid: row.ParentProcessId,
              session: row.Session||null,
            }));
          } else if (details) {
            rows = stdout
              .trim()
              .split(/\r?\n/)
              .filter(Boolean)
              .map((line) => {
                const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line);
                if (!match) throw Error("Invalid process metadata");
                return {
                  pid: Number(match[1]),
                  ppid: Number(match[2]),
                  name: match[3],
                };
              });
          } else rows = stdout.split(/\r?\n/).map((name) => ({ name }));
          if (
            details &&
            rows.some(
              (row) =>
                typeof row.name !== "string" ||
                !Number.isSafeInteger(row.pid) ||
                !Number.isSafeInteger(row.ppid),
            )
          )
            return resolve(null);
        } catch {
          return resolve(null);
        }
        const counts = { claude: 0, codex: 0, unknown: 0 };
        for (const row of rows) {
          const kind = identify(row.name);
          if (kind) counts[kind]++;
        }
        const top = details ? groupProcesses(rows) : null;
        const liveSessionKeys=bindSessions?rows.map(r=>sessionKey(r.session)).filter(Boolean):[];
        if (counts.unknown && !details) {
          counts.claude = null;
          counts.codex = null;
        }
        resolve(
          details
            ? {
                ...counts,
                top,
                ...(bindSessions?{liveSessionKeys}:{}),
                agents: ["claude", "codex"]
                  .filter((name) => top[name] > 0)
                  .map((name) => ({
                    name,
                    count: top[name],
                    folder: null,
                    elapsedSeconds: null,
                  })),
              }
            : counts,
        );
      },
    );
  });
}
module.exports = { identify, processSnapshot, groupProcesses };
