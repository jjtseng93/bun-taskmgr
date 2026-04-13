import { randomBytes } from "node:crypto";
import path from "node:path"
import os from "node:os"
import { createInterface } from "node:readline/promises";
import { stdin, stdout, stderr, exit } from "node:process";

const HOST = "127.0.0.1";
const token = randomBytes(8).toString("hex");
const SIGNAL_ALIASES = new Map([
  ["1", "SIGHUP"],
  ["2", "SIGINT"],
  ["3", "SIGQUIT"],
  ["9", "SIGKILL"],
  ["15", "SIGTERM"],
  ["h", "SIGHUP"],
  ["i", "SIGINT"],
  ["k", "SIGKILL"],
  ["q", "QUIT"],
  ["t", "SIGTERM"],
]);
const COMMON_SIGNALS = ["SIGHUP", "SIGINT", "SIGQUIT", "SIGKILL", "SIGTERM", "SIGUSR1", "SIGUSR2"];
let currentSignal = "SIGTERM";

function isWindows() {
  return process.platform === "win32";
}

function runCommand(cmd) {
  const proc = Bun.spawnSync(cmd, {
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: proc.exitCode,
    stdout: new TextDecoder().decode(proc.stdout).replace(/\r\n/g, "\n"),
    stderr: new TextDecoder().decode(proc.stderr).replace(/\r\n/g, "\n"),
  };
}

function listProcesses() {
  return isWindows() ? listWindowsProcesses() : listLinuxProcesses();
}

function listLinuxProcesses() {
  const { exitCode, stdout, stderr } = runCommand(["ps", "-eo", "pid,args"]);

  if (exitCode !== 0) {
    throw new Error(stderr || "failed to run ps -eo pid,args");
  }

  return stdout
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.*)$/);
      if (!match) return null;

      return {
        pid: Number(match[1]),
        args: match[2],
      };
    })
    .filter(Boolean);
}

function listWindowsProcesses() {
  const { exitCode, stdout, stderr } = runCommand([
    "powershell",
    "-NoProfile",
    "-Command",
    "Get-CimInstance Win32_Process | Select-Object ProcessId, CommandLine",
  ]);

  if (exitCode !== 0) {
    throw new Error(stderr || "failed to query Win32_Process");
  }

  return stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => !/^(ProcessId|---------)/.test(line.trim()))
    .map((line) => {
      const match = line.match(/^\s*(\d+)\s+(.*)$/);
      if (match) {
        return {
          pid: Number(match[1]),
          args: match[2].trim(),
        };
      }

      const fallback = line.match(/^(.*\S)\s+(\d+)\s*$/);
      if (!fallback) return null;

      return {
        pid: Number(fallback[2]),
        args: fallback[1].trim(),
      };
    })
    .filter(Boolean);
}

function killProcess(pid, signal = currentSignal) {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`invalid pid: ${pid}`);
  }

  if (isWindows()) {
    const { exitCode, stderr } = runCommand([
      "taskkill",
      "/PID",
      String(pid),
      "/T",
      "/F"
    ]);

    if (exitCode !== 0) {
      throw new Error(stderr || `failed to kill pid ${pid}`);
    }

    return;
  }

  const { exitCode, stderr } = runCommand(["kill", "-s", signal, String(pid)]);
  if (exitCode !== 0) {
    throw new Error(stderr || `failed to send ${signal} to pid ${pid}`);
  }
}

function normalizeArgs(text) {
  return (text || "").replace(/\r?\n/g, " ");
}

async function renderProcessTable(serverPort,filter) {
  if(process.argv[2])
  {
    filter=process.argv[2]
    process.argv[2]=""
  }
  
  const rows = listProcesses()
    .sort((a, b) => a.pid - b.pid)
    .filter(({ pid, args }) => {
      if(!filter) return true;
      
      return (pid+" "+args).includes(filter)
    })
    .map(({ pid, args }) => {
      const url = `http://${HOST}:${serverPort}/${token}/${pid}/kill`;
      return `- [${pid}](${url}) ${normalizeArgs(args)}  `;
    });

  let markdown = [
    `# Bun Task Manager`,
    ``,
    `- PID ARGS  `,
    ...rows,
    `# Usage`,
    `- Click on PID to kill that process`,
    ``,
    `- Server: "http://${HOST}:${serverPort}/${token}/:pid/kill"`,
    `- Platform: ${process.platform}`,
    `- Processes: ${rows.length}`,
    `- Signal: \`${isWindows() ? "taskkill" : currentSignal}\``,
    ``,
    `## Commands
- \`l\` [filter] list/refresh
- \`q\` quit
- \`k\` SIGKILL, \`i\` SIGINT, \`t\` SIGTERM, \`h\` SIGHUP
- Signal number like \`9\` or \`15\`  
- Also useful but not bound to a letter: \`3=SIGQUIT\`, \`10=SIGUSR1\`, \`12=SIGUSR2\`  `,
    `=======`
  ].join("\n");


  //markdown=markdown.replace(/\(http.+\)/g,"")

  //let mdf=path.join(os.tmpdir(),"pspidargs.md")
  //await Bun.write(mdf,markdown)

  //console.clear();
  
  //await Bun.spawn([process.execPath,mdf],{stdio:['ignore',1,'ignore']}).exited
  
  stdout.write(Bun.markdown.ansi(markdown,{
  	hyperlinks:true
  }));
}

function resolveSignal(input) {
  const value = input.trim().toLowerCase();

  if (!value) {
    return null;
  }

  if (SIGNAL_ALIASES.has(value)) {
    return SIGNAL_ALIASES.get(value);
  }

  if (/^\d+$/.test(value)) {
    return String(Number(value));
  }

  const upper = input.trim().toUpperCase();
  if (COMMON_SIGNALS.includes(upper)) {
    return upper;
  }

  if (/^SIG[A-Z0-9]+$/.test(upper)) {
    return upper;
  }

  return null;
}

async function runCommandLoop(serverPort) {
  const rl = createInterface({ input: stdin, output: stderr });

  while (true) {
    let input 

    try{
    input = (await rl.question("> ")).trim();
    }catch(e){input="q"}


    if (!input) {
      continue;
    }

    if (input[0] === "l") {
      let filter=input.slice(2)
      await renderProcessTable(serverPort,filter);
      continue;
    }

    if (input === "q") {
      rl.close();
      server.stop(true);
      exit(0);
    }

    const signal = resolveSignal(input);
    if (signal) {
      currentSignal = signal;
      await renderProcessTable(serverPort);
      continue;
    }

    console.log(`unknown command: ${input}`);
    console.log("use l, k, i, t, h, q, a signal number like 9/15, or a signal name like SIGUSR1");
  }
}

const server = Bun.serve({
  hostname: HOST,
  port: 0,
  idleTimeout: 30,
  async fetch(req) {
    const url = new URL(req.url);
    const match = url.pathname.match(/^\/([0-9a-f]{16})\/(\d+)\/kill$/i);

    if (!match) {
      return new Response("not found\n", { status: 404 });
    }

    if (match[1] !== token) {
      return new Response("forbidden\n", { status: 403 });
    }

    const pid = Number(match[2]);

    try {
      killProcess(pid);
      await renderProcessTable(server.port);
      stdout.write("> ")
      return new Response(`sent ${isWindows() ? "taskkill" : currentSignal} to pid ${pid}\n`, { status: 200 });
    } catch (error) {
      return new Response(`${error.message}\n`, { status: 500 });
    }
  },
});

await renderProcessTable(server.port);
await runCommandLoop(server.port);
