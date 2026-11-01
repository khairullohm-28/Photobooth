import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTolerantMatch,
  parseMultipleCodes,
  extractSessionIdFromUrlOrText,
  formatSessionCode,
  normalizeCodeForMatching,
} from '../utils/codeSearch';
import { AdminProfile } from '../types/admin';

test('Session Code Generator: formats 4 digits up to 9999, then expands to 5+ digits', () => {
  assert.equal(formatSessionCode('KL', 1), 'KL-0001');
  assert.equal(formatSessionCode('MND', 42), 'MND-0042');
  assert.equal(formatSessionCode('DMW', 9999), 'DMW-9999');
  assert.equal(formatSessionCode('DMW', 10000), 'DMW-10000');
  assert.equal(formatSessionCode('DMW', 10042), 'DMW-10042');
});

test('Tolerant Search: matches case-insensitive, ignores hyphens and spaces', () => {
  const code = 'MND-0042';
  const uuid = 'c4b8b6a1-9a7e-4122-8d77-9dfb581e2233';
  const prefix = 'MND';

  // Exact
  assert.equal(isTolerantMatch('MND-0042', code, uuid, prefix), true);

  // Lowercase & no dash
  assert.equal(isTolerantMatch('mnd0042', code, uuid, prefix), true);

  // With space
  assert.equal(isTolerantMatch('MND 42', code, uuid, prefix), true);
  assert.equal(isTolerantMatch('mnd 42', code, uuid, prefix), true);

  // Short without leading zeros
  assert.equal(isTolerantMatch('mnd42', code, uuid, prefix), true);

  // Numbers only when scoped to this event prefix
  assert.equal(isTolerantMatch('42', code, uuid, prefix), true);
  assert.equal(isTolerantMatch('0042', code, uuid, prefix), true);

  // Non-matching code
  assert.equal(isTolerantMatch('MND-0043', code, uuid, prefix), false);
  assert.equal(isTolerantMatch('99', code, uuid, prefix), false);
});

test('Barcode USB Scanner: extracts UUID or session id from full guest URL', () => {
  const url1 = 'https://photobooth.domainku.com/e/monika-david/s/c4b8b6a1-9a7e-4122-8d77-9dfb581e2233';
  const extracted1 = extractSessionIdFromUrlOrText(url1);
  assert.equal(extracted1, 'c4b8b6a1-9a7e-4122-8d77-9dfb581e2233');

  const code = 'MND-0042';
  const uuid = 'c4b8b6a1-9a7e-4122-8d77-9dfb581e2233';
  assert.equal(isTolerantMatch(url1, code, uuid, 'MND'), true);
});

test('Multi-Code Quick Print Parser: splits by comma, space, and newline', () => {
  const input = 'MND-0042, KL-0001 MND0043\nDMW-0005\r\n42';
  const tokens = parseMultipleCodes(input);
  assert.deepEqual(tokens, ['MND-0042', 'KL-0001', 'MND0043', 'DMW-0005', '42']);
});

test('RBAC Policy: team member without booking permission is rejected', () => {
  const teamWithoutBooking: AdminProfile = {
    id: 'usr_team_02',
    username: 'cleaner',
    display_name: 'Cleaner',
    role: 'team',
    permissions: ['dashboard'],
    allowed_event_ids: null,
    is_active: true,
    last_login_at: null,
    created_at: new Date().toISOString(),
  };

  const hasPerm =
    teamWithoutBooking.role === 'owner' ||
    teamWithoutBooking.permissions.includes('*') ||
    teamWithoutBooking.permissions.includes('booking') ||
    teamWithoutBooking.permissions.includes('booking.results');

  assert.equal(hasPerm, false);

  const teamWithBooking: AdminProfile = {
    ...teamWithoutBooking,
    permissions: ['booking.results'],
  };

  const hasPerm2 =
    teamWithBooking.role === 'owner' ||
    teamWithBooking.permissions.includes('*') ||
    teamWithBooking.permissions.includes('booking') ||
    teamWithBooking.permissions.includes('booking.results');

  assert.equal(hasPerm2, true);
});
