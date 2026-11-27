// Test preload for verseva doctor: replaces globalThis.fetch so no test reaches the network.
// DOCTOR_STUB=offline rejects every call; otherwise it answers with DOCTOR_STUB_LATEST.
// Each call is appended to DOCTOR_STUB_LOG as one JSON line.
import fs from 'node:fs';

globalThis.fetch = async (url, init = {}) => {
  if (process.env.DOCTOR_STUB_LOG) {
    fs.appendFileSync(process.env.DOCTOR_STUB_LOG, JSON.stringify({
      url: String(url),
      method: init.method ?? 'GET',
      redirect: init.redirect ?? null,
      signal: Boolean(init.signal),
      headers: init.headers ?? null,
    }) + '\n');
  }
  if (process.env.DOCTOR_STUB === 'offline') throw new TypeError('fetch failed');
  const body = process.env.DOCTOR_STUB_BODY ?? JSON.stringify({ name: '@verseva/design', version: process.env.DOCTOR_STUB_LATEST });
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
};
