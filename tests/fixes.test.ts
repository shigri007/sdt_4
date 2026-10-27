// Checks for the open items in the test sheet (TC-005, TC-044, TC-045, TC-046).
// The CSRF and restart checks start the real server (server.ts) as a separate process on a temporary database.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import QRCode from 'qrcode';
import { toCsv } from '../src/services/csv.js';
import { kitTraceUrl } from '../src/services/kitQr.js';
import { TAB_PATHS } from '../src/access.js';
import { TraceabilityService } from '../server/src/services/traceability.js';
import { db } from '../server/src/db/index.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const dir = mkdtempSync(path.join(tmpdir(), 'steritrack-fixes-'));
const DB_FILE = path.join(dir, 'restart.sqlite');
const PORT = 3400 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
let server: ChildProcess | null = null;
let output = '';

async function startServer(): Promise<void> {
  output = '';
  server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), HOST: '127.0.0.1', DATABASE_PATH: DB_FILE, INITIAL_PASSWORD: 'Restart-Test-Admin-1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout!.on('data', chunk => { output += chunk; });
  server.stderr!.on('data', chunk => { output += chunk; });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* still starting */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Server did not start:\n${output}`);
}

function stopServer(): Promise<void> {
  // SIGKILL: an abrupt stop, like a crash or container restart; nothing gets a chance to save on exit.
  return new Promise(resolve => {
    if (!server || server.exitCode !== null) return resolve();
    server.once('exit', () => resolve());
    server.kill('SIGKILL');
  });
}

async function signIn(username: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  expect(res.status).toBe(200);
  const cookie = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  const { csrfToken } = await res.json();
  return { cookie, csrfToken };
}

const newKit = (code: string) => JSON.stringify({ kitCode: code, kitName: 'Restart Check Tray #1', kitTypeId: 1, departmentOwnerId: 1 });

describe('Open test-sheet items on the real server', () => {
  let quality = { username: 'zhang_lei', password: '' };

  beforeAll(async () => {
    await startServer();
    // First run prints one generated password per seeded account (local temporary database only).
    const match = output.match(/^\s+zhang_lei: (\S+)$/m);
    if (!match) throw new Error('No first-run password found for zhang_lei');
    quality.password = match[1];
  }, 30000);

  afterAll(async () => {
    await stopServer();
    rmSync(dir, { recursive: true, force: true });
  });

  it('TC-005: rejects a state-changing request without a valid CSRF token', async () => {
    const { cookie, csrfToken } = await signIn(quality.username, quality.password);
    const post = (headers: Record<string, string>) =>
      fetch(`${BASE}/api/kits`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, ...headers }, body: newKit('KIT-CSRF') });

    const missing = await post({});
    expect(missing.status).toBe(403);
    expect((await missing.json()).error).toBe('Request verification failed.');

    const wrong = await post({ 'X-CSRF-Token': 'not-the-session-token' });
    expect(wrong.status).toBe(403);

    const otherSite = await post({ 'X-CSRF-Token': csrfToken, Origin: 'https://evil.example' });
    expect(otherSite.status).toBe(403);
    expect((await otherSite.json()).error).toBe('Request origin is not allowed.');

    // Nothing was created by the rejected requests.
    const lookup = await fetch(`${BASE}/api/kits/KIT-CSRF`, { headers: { Cookie: cookie } });
    expect(lookup.status).toBe(404);

    // The same request with the session's token is accepted (the user has the right role).
    const ok = await post({ 'X-CSRF-Token': csrfToken });
    expect(ok.status).toBe(201);
  });

  it('TC-046: an accepted change is still there after an abrupt server restart', async () => {
    const { cookie, csrfToken } = await signIn(quality.username, quality.password);
    const created = await fetch(`${BASE}/api/kits`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': csrfToken }, body: newKit('KIT-RESTART'),
    });
    expect(created.status).toBe(201);

    await stopServer();
    await startServer();

    // Sessions are stored in the database too, so the same sign-in still works after the restart.
    const after = await fetch(`${BASE}/api/kits/KIT-RESTART`, { headers: { Cookie: cookie } });
    expect(after.status).toBe(200);
    const body = await after.json();
    expect(body.data.kit_code).toBe('KIT-RESTART');
    expect(body.data.kit_name).toBe('Restart Check Tray #1');
    expect(body.data.current_status).toBe('RETURNED');
  }, 30000);
});

describe('TC-044: report CSV export', () => {
  const rows = [
    { kitCode: 'KIT-0012', kitName: 'General Surgery Laparotomy Tray #4', reviewer: 'Zhang Lei (张磊)', notes: 'said "ok", then left' },
    { kitCode: 'KIT-0001', kitName: 'Tray #1', reviewer: '=HYPERLINK("x")', notes: '-12' },
  ];
  const csv = toCsv(rows);

  it('keeps every row, including text with "#" and Chinese names', () => {
    const lines = csv.replace(/^﻿/, '').split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('"kitCode","kitName","reviewer","notes"');
    expect(lines[1]).toContain('"General Surgery Laparotomy Tray #4"');
    expect(lines[1]).toContain('"Zhang Lei (张磊)"');
    expect(lines[1]).toContain('"said ""ok"", then left"');
  });

  it('starts with a byte-order mark so Excel reads UTF-8', () => {
    expect(csv.startsWith('﻿')).toBe(true);
  });

  it('neutralises spreadsheet formulas but keeps negative numbers', () => {
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"-12"');
  });
});

describe('TC-045: kit QR code opens the trace page', () => {
  it('encodes the full link to the frontend trace route', () => {
    expect(kitTraceUrl('KIT-0012', 'https://steritrack.example.app')).toBe('https://steritrack.example.app/traceability/KIT-0012');
    expect(TAB_PATHS.traceability).toBe('/traceability');
  });

  it('API QR image points at /traceability, not the old /kits path', async () => {
    process.env.DATABASE_PATH = path.join(dir, 'trace.sqlite');
    process.env.INITIAL_PASSWORD = 'Trace-Test-Admin-1';
    await db.init();
    try {
      const trace = await TraceabilityService.getKitTraceability('KIT-0012');
      const options = { margin: 1, width: 240, color: { dark: '#0F172A', light: '#FFFFFF' } };
      expect(trace.qrCodeDataUrl).toBe(await QRCode.toDataURL('/traceability/KIT-0012', options));
      expect(trace.qrCodeDataUrl).not.toBe(await QRCode.toDataURL('/kits/KIT-0012', options));
    } finally {
      db.close();
    }
  });
});
