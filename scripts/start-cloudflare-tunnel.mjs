#!/usr/bin/env node
/**
 * One-command Expo + Cloudflare quick tunnel for Expo Go.
 * Usage: npm run start:tunnel
 */
import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFERRED_PORT = Number(process.env.PORT || 8081);

const CLOUDFLARED_CANDIDATES = [
  process.env.CLOUDFLARED_PATH,
  'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
  'C:\\Program Files\\cloudflared\\cloudflared.exe',
  'cloudflared',
].filter(Boolean);

function findCloudflared() {
  for (const candidate of CLOUDFLARED_CANDIDATES) {
    if (candidate === 'cloudflared') return candidate;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function toExpoGoUrl(httpsUrl) {
  // Cloudflare quick tunnels are HTTPS-only. Expo Go must use exps://
  // (exp:// sends plain HTTP and gets: "plain HTTP request was sent to HTTPS port").
  const host = new URL(httpsUrl).hostname;
  return `exps://${host}`;
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

async function pickPort(start) {
  for (let port = start; port < start + 20; port++) {
    if (await canListen(port)) return port;
  }
  throw new Error(`No free port found near ${start}`);
}

function freePortWindows(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`  Freed port ${port} (killed PID ${pid})`);
      } catch {
        // ignore
      }
    }
  } catch {
    // nothing listening
  }
}

const cloudflared = findCloudflared();
if (!cloudflared) {
  console.error('cloudflared not found. Install with:');
  console.error('  winget install --id Cloudflare.cloudflared -e');
  process.exit(1);
}

if (process.platform === 'win32') {
  freePortWindows(PREFERRED_PORT);
}

const port = await pickPort(PREFERRED_PORT);

console.log('\n  muffle.tech · Expo Go tunnel');
console.log(`  Metro port: ${port}`);
console.log('  Starting Metro + Cloudflare…\n');

const expo = spawn(
  'npx',
  ['expo', 'start', '--lan', '--go', '--port', String(port)],
  {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
    shell: true,
  },
);

const tunnel = spawn(cloudflared, ['tunnel', '--url', `http://127.0.0.1:${port}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

let printedUrl = false;

function handleTunnelChunk(buf) {
  const text = buf.toString();
  // Keep cloudflared quieter — only show useful lines
  if (
    /trycloudflare\.com|Registered tunnel|error|failed|ERR_/i.test(text) ||
    printedUrl === false
  ) {
    process.stdout.write(text);
  }

  if (printedUrl) return;
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (!match) return;

  printedUrl = true;
  const expUrl = toExpoGoUrl(match[0]);
  console.log('\n────────────────────────────────────────');
  console.log('  Open in Expo Go:');
  console.log(`  ${expUrl}`);
  console.log('────────────────────────────────────────\n');
}

tunnel.stdout.on('data', handleTunnelChunk);
tunnel.stderr.on('data', handleTunnelChunk);

expo.stdout.on('data', (buf) => process.stdout.write(buf));
expo.stderr.on('data', (buf) => process.stderr.write(buf));

function shutdown(code = 0) {
  try {
    expo.kill('SIGTERM');
  } catch {
    // ignore
  }
  try {
    tunnel.kill('SIGTERM');
  } catch {
    // ignore
  }
  setTimeout(() => process.exit(code), 500);
}

expo.on('exit', (code) => {
  if (code && code !== 0) {
    console.error(`\nExpo exited with code ${code}\n`);
  }
  shutdown(code ?? 0);
});

tunnel.on('exit', (code) => {
  if (!printedUrl && code && code !== 0) {
    console.error(`\nCloudflare tunnel exited early (port ${port}).\n`);
  }
  shutdown(code ?? 0);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
