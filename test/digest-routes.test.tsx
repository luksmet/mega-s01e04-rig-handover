import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir };
const app = createApp(config);

writeFileSync(
  join(dir, '2026-11-01.jsonl'),
  [
    '{"at":"2026-11-01T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
    'not json',
    '{"at":"2026-11-01T02:00:00+01:00","job":"lane/sync","status":"fail","owner":"rook","error":"quota exceeded"}',
    '{"at":"2026-11-01T03:00:00+01:00","job":"digest/render","status":"ok","owner":null}',
    '',
  ].join('\n'),
);
writeFileSync(join(dir, '2026-11-02.jsonl'), '');

describe('digest page route', () => {
  it('200 for a night that exists, with its rows', async () => {
    const res = await app.request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest 2026-11-01');
    expect(html).toContain('lane/sync');
    expect(html).toContain('digest/render');
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-11-03');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no digest for 2026-11-03');
  });

  it('empty night: 200 and says nothing ran', async () => {
    const res = await app.request('/digest/2026-11-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('bad line: still 200, warns about the line and keeps the rows', async () => {
    const res = await app.request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line could not be read');
    expect(html).toContain('lane/sync');
    expect(html).toContain('quota exceeded');
  });
});

describe('digest JSON route', () => {
  it('200 for a night that exists', async () => {
    const res = await app.request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ night: '2026-11-01' });
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-11-03');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('empty night: rows []', async () => {
    const res = await app.request('/api/digest/2026-11-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      night: '2026-11-02',
      rows: [],
      counts: { ok: 0, retry: 0, fail: 0 },
      badLines: 0,
    });
  });

  it('bad line: 200, badLines 1 and the good rows present', async () => {
    const res = await app.request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.badLines).toBe(1);
    expect(body.counts).toEqual({ ok: 2, retry: 0, fail: 1 });
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(['digest/render', 'lane/sync']);
    expect(body.rows[1]).toMatchObject({ job: 'lane/sync', runs: 2, lastStatus: 'fail', lastError: 'quota exceeded' });
  });
});
