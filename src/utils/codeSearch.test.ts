import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSessionCode,
  normalizeCodeForMatching,
  extractSessionIdFromUrlOrText,
  parseMultipleCodes,
  isTolerantMatch,
} from './codeSearch';

test('formatSessionCode: formats 4-digit code correctly', () => {
  assert.equal(formatSessionCode('MND', 42), 'MND-0042');
  assert.equal(formatSessionCode('kl', 1), 'KL-0001');
  assert.equal(formatSessionCode('KL', 10052), 'KL-10052');
});

test('normalizeCodeForMatching: strips spaces, dashes and lowercases', () => {
  assert.equal(normalizeCodeForMatching('MND-0042'), 'mnd0042');
  assert.equal(normalizeCodeForMatching('  mnd 42  '), 'mnd42');
});

test('extractSessionIdFromUrlOrText: extracts from guest URL or UUID', () => {
  const url = 'https://photobooth.app/e/khai-lila/s/93caa221-bff1-4e6b-8b76-2cf4ea3a4d80';
  assert.equal(extractSessionIdFromUrlOrText(url), '93caa221-bff1-4e6b-8b76-2cf4ea3a4d80');

  const rawUuid = '93caa221-bff1-4e6b-8b76-2cf4ea3a4d80';
  assert.equal(extractSessionIdFromUrlOrText(rawUuid), '93caa221-bff1-4e6b-8b76-2cf4ea3a4d80');
});

test('parseMultipleCodes: splits codes by space, commas and newlines', () => {
  const input = 'MND-0042, MND-0043 \n MND-0051  KL-0001';
  const parsed = parseMultipleCodes(input);
  assert.deepEqual(parsed, ['MND-0042', 'MND-0043', 'MND-0051', 'KL-0001']);
});

test('isTolerantMatch: matches mnd42, MND 42, 42 against MND-0042', () => {
  const code = 'MND-0042';
  const id = 'sess_12345';

  // "mnd42" matches
  assert.equal(isTolerantMatch('mnd42', code, id, 'MND'), true);
  // "MND 42" matches
  assert.equal(isTolerantMatch('MND 42', code, id, 'MND'), true);
  // "mnd-0042" matches
  assert.equal(isTolerantMatch('mnd-0042', code, id, 'MND'), true);
  // Number only "42" matches
  assert.equal(isTolerantMatch('42', code, id, 'MND'), true);
  // Non-matching code
  assert.equal(isTolerantMatch('99', code, id, 'MND'), false);
  assert.equal(isTolerantMatch('abc', code, id, 'MND'), false);
});
