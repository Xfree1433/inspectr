// "Today" starts at local midnight, not at 6 pm Central (found 11-22).
// Run: node --test tests/app-day.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startOfAppToday, startOfAppTodaySql } from '../server/app-day.js';

test('start of today in US Central, winter and summer', () => {
  // 8 pm CST on Nov 22 is already Nov 23 in UTC; today still began at 06:00Z on the 22nd.
  assert.equal(startOfAppToday(new Date('2026-11-23T02:00:00Z'), 'America/Chicago').toISOString(), '2026-11-22T06:00:00.000Z');
  assert.equal(startOfAppToday(new Date('2026-11-22T06:00:00Z'), 'America/Chicago').toISOString(), '2026-11-22T06:00:00.000Z');
  assert.equal(startOfAppToday(new Date('2026-11-22T05:59:59Z'), 'America/Chicago').toISOString(), '2026-11-21T06:00:00.000Z');
  assert.equal(startOfAppToday(new Date('2026-07-04T03:00:00Z'), 'America/Chicago').toISOString(), '2026-07-03T05:00:00.000Z');
});

test('other zones, a bad zone, and the SQL form', () => {
  assert.equal(startOfAppToday(new Date('2026-11-23T02:00:00Z'), 'UTC').toISOString(), '2026-11-23T00:00:00.000Z');
  assert.equal(startOfAppToday(new Date('2026-11-23T02:00:00Z'), 'Not/AZone').toISOString(), '2026-11-22T06:00:00.000Z');
  assert.equal(startOfAppTodaySql(new Date('2026-11-23T02:00:00Z'), 'America/Chicago'), '2026-11-22 06:00:00');
});

test('the stats route and the new-inspection form use local time', () => {
  const server = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  assert.match(server, /const today = startOfAppTodaySql\(\);/);
  assert.equal((server.match(/datetime\(created_at\) >= datetime\(\?\)/g) || []).length, 2);
  const modal = readFileSync(new URL('../src/components/NewInspectionModal.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(modal, /setDate\(now\.toISOString\(\)/);
});
