import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getActiveGroupId,
  isPathMatching,
  normalizePath,
  MENU_ITEMS,
} from './components/AdminLayout';

test('Navigation: normalizePath standardizes setting vs settings', () => {
  assert.equal(normalizePath('/admin/setting/printer'), '/admin/settings/printer');
  assert.equal(normalizePath('/admin/settings/printer'), '/admin/settings/printer');
  assert.equal(normalizePath('/admin/booking/results'), '/admin/booking/results');
});

test('Navigation: isPathMatching handles exact and normalized matches', () => {
  assert.equal(
    isPathMatching('/admin/settings/printer', '/admin/setting/printer'),
    true
  );
  assert.equal(
    isPathMatching('/admin/settings/printer', '/admin/settings/printer'),
    true
  );
  assert.equal(
    isPathMatching('/admin/booking/results', '/admin/booking/results'),
    true
  );
  assert.equal(
    isPathMatching('/admin/booking/results', '/admin/booking/print-history'),
    false
  );
});

test('Navigation: getActiveGroupId detects correct parent group', () => {
  // Direct refresh at /admin/setting/printer opens 'settings' group
  assert.equal(getActiveGroupId('/admin/setting/printer'), 'settings');
  assert.equal(getActiveGroupId('/admin/settings/printer'), 'settings');
  assert.equal(getActiveGroupId('/admin/settings/team'), 'settings');

  // Booking pages
  assert.equal(getActiveGroupId('/admin/booking/results'), 'booking');
  assert.equal(getActiveGroupId('/admin/booking/print-history'), 'booking');

  // Studio pages
  assert.equal(getActiveGroupId('/admin/studio/categories'), 'studio');
  assert.equal(getActiveGroupId('/admin/studio/templates'), 'studio');
  assert.equal(getActiveGroupId('/admin/studio/filters'), 'studio');

  // Reports pages
  assert.equal(getActiveGroupId('/admin/reports/events'), 'reports');
  assert.equal(getActiveGroupId('/admin/reports'), 'reports');

  // Non-group top-level items return null (accordion closed)
  assert.equal(getActiveGroupId('/admin/dashboard'), null);
  assert.equal(getActiveGroupId('/admin/events'), null);
});

test('Navigation: each parent with submenus has a valid first submenu', () => {
  const groupedMenus = MENU_ITEMS.filter((item) => item.subItems && item.subItems.length > 0);
  assert.equal(groupedMenus.length, 4); // booking, studio, settings, reports

  const booking = MENU_ITEMS.find((item) => item.id === 'booking');
  assert.equal(booking?.subItems?.[0].path, '/admin/booking/results');

  const studio = MENU_ITEMS.find((item) => item.id === 'studio');
  assert.equal(studio?.subItems?.[0].path, '/admin/studio/categories');

  const settings = MENU_ITEMS.find((item) => item.id === 'settings');
  assert.equal(settings?.subItems?.[0].path, '/admin/settings/team');

  const reports = MENU_ITEMS.find((item) => item.id === 'reports');
  assert.equal(reports?.subItems?.[0].path, '/admin/reports/events');
});
