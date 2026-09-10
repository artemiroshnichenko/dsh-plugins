import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expandHome } from "./checker.js";
import type { RestartResult } from "./types.js";

export function restartDsh(delayMs = 800): RestartResult {
  const currentPid = process.pid;
  const launcherPath = expandHome("~/.agents/bin/mind");
  const fallbackDsh = expandHome("~/.agents/bin/dsh");

  let startCmd: string;
  let startArgs: string[];

  if (fs.existsSync(launcherPath)) {
    startCmd = launcherPath;
    startArgs = [];
  } else if (fs.existsSync(fallbackDsh)) {
    startCmd = fallbackDsh;
    startArgs = ["web"];
  } else {
    startCmd = "dsh";
    startArgs = ["web"];
  }

  // Write a transient restart script that waits for old process to flush response and exit, then launches new DSH
  const tmpScriptPath = path.join(
    os.tmpdir(),
    `dsh-restart-${Date.now()}-${Math.random().toString(36).slice(2)}.sh`,
  );

  const scriptContent = `#!/bin/bash
sleep ${(delayMs / 1000).toFixed(2)}

# Terminate old process gracefully
if kill -0 ${currentPid} 2>/dev/null; then
  kill -TERM ${currentPid} 2>/dev/null
  sleep 1
fi
if kill -0 ${currentPid} 2>/dev/null; then
  kill -9 ${currentPid} 2>/dev/null
fi

# Launch mind / dsh in background
nohup "${startCmd}" ${startArgs.join(" ")} > /dev/null 2>&1 &
rm -f "${tmpScriptPath}"
`;

  try {
    fs.writeFileSync(tmpScriptPath, scriptContent, { mode: 0o755 });
    const child = spawn("/bin/bash", [tmpScriptPath], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return {
      ok: true,
      restarting: true,
      pid: currentPid,
      message: `Restart scheduled in ${delayMs}ms using ${startCmd}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      restarting: false,
      pid: currentPid,
      message: `Failed to trigger restart: ${err?.message || String(err)}`,
    };
  }
}
