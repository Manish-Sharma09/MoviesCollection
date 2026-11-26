// Runs one data script in its own Node process with a time limit (scripts/update-data.mjs).
import { spawn } from 'node:child_process';
import { rename, writeFile } from 'node:fs/promises';

/**
 * Runs `file` and resolves (never rejects) with { ok, code, timedOut, ms }. A script still running after
 * `minutes` is stopped. The data scripts save what they have read as they go, so a stopped script loses
 * little and the next run carries on from there.
 */
export function runStep(file, { args = [], env = {}, minutes }) {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file, ...args], { stdio: 'inherit', env: { ...process.env, ...env } });
    let timedOut = false;
    let killer;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      killer = setTimeout(() => child.kill('SIGKILL'), 10_000);
    }, minutes * 60_000);
    const done = (code) => {
      clearTimeout(timer);
      clearTimeout(killer);
      resolve({ ok: code === 0 && !timedOut, code, timedOut, ms: Date.now() - started });
    };
    child.on('error', () => done(1));
    child.on('exit', (code) => done(code ?? 1)); // no code: ended by a signal
  });
}

/** Writes JSON to a temporary file and renames it into place, so a script stopped half way never leaves half a file. */
export async function saveJson(url, data, space) {
  const tmp = new URL(`${url.href}.tmp`); // a fixed name: one left by a stopped run is overwritten, never piles up
  await writeFile(tmp, JSON.stringify(data, null, space));
  await rename(tmp, url);
}
