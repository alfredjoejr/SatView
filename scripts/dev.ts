import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const backendPort = process.env.PORT ?? '3001';
const backendUrl = `http://127.0.0.1:${backendPort}`;
const viteBin = path.resolve(process.cwd(), 'node_modules/vite/bin/vite.js');

const children: ChildProcess[] = [];
let shuttingDown = false;

function prefixLines(label: string, stream: NodeJS.ReadableStream | null, target: NodeJS.WriteStream): void {
  if (!stream) return;
  let buffer = '';
  stream.on('data', (chunk: Buffer | string) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.length > 0) target.write(`[${label}] ${line}\n`);
    }
  });
  stream.on('end', () => {
    if (buffer.length > 0) target.write(`[${label}] ${buffer}\n`);
  });
}

function shutdown(exitCode = 0): void {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(exitCode), 250).unref();
}

function startChild(
  label: string,
  args: string[],
  extraEnv: Record<string, string>,
): ChildProcess {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...extraEnv },
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  prefixLines(label, child.stdout, process.stdout);
  prefixLines(label, child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`[dev] ${label} exited with code ${code ?? 0}`);
      shutdown(code ?? 1);
    }
  });
  children.push(child);
  return child;
}

async function waitForBackend(timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !shuttingDown) {
    try {
      const res = await fetch(`${backendUrl}/api/health`);
      if (res.ok) return;
    } catch {
      // Backend still starting up.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`Starting SatView backend (${backendUrl}) and Vite frontend...`);
startChild('backend', ['server/index.ts'], { PORT: backendPort });
await waitForBackend();
if (!shuttingDown) {
  startChild('frontend', [viteBin, ...process.argv.slice(2)], {
    SATVIEW_BACKEND_URL: backendUrl,
  });
}
