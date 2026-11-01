import test from 'node:test';
import assert from 'node:assert/strict';

function checkPermission(
  role: 'owner' | 'team',
  permissions: string[],
  requiredKey: string
): boolean {
  if (role === 'owner') return true;
  if (permissions.includes('*')) return true;
  if (permissions.includes(requiredKey)) return true;
  const parentKey = requiredKey.split('.')[0];
  return permissions.includes(parentKey);
}

function getSyntheticEmail(username: string): string {
  return `${username.trim().toLowerCase()}@admin.local`;
}

test('RBAC: owner always has access to all keys', () => {
  assert.equal(checkPermission('owner', [], 'dashboard'), true);
  assert.equal(checkPermission('owner', [], 'settings.team'), true);
  assert.equal(checkPermission('owner', [], 'studio.templates'), true);
});

test('RBAC: team member with wildcard has full access', () => {
  assert.equal(checkPermission('team', ['*'], 'settings.website'), true);
});

test('RBAC: team member with parent permission can access child submenu', () => {
  // If team has 'booking', they can access 'booking.results' and 'booking.print_history'
  assert.equal(checkPermission('team', ['booking'], 'booking.results'), true);
  assert.equal(checkPermission('team', ['booking'], 'booking.print_history'), true);
  // But cannot access 'settings'
  assert.equal(checkPermission('team', ['booking'], 'settings.team'), false);
});

test('RBAC: team member with exact child key only accesses that child', () => {
  assert.equal(checkPermission('team', ['booking.results'], 'booking.results'), true);
  assert.equal(checkPermission('team', ['booking.results'], 'booking.print_history'), false);
  assert.equal(checkPermission('team', ['booking.results'], 'settings.website'), false);
});

test('Auth: synthetic email formatted correctly', () => {
  assert.equal(getSyntheticEmail('Owner'), 'owner@admin.local');
  assert.equal(getSyntheticEmail(' operator_1 '), 'operator_1@admin.local');
});
