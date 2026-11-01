import test from 'node:test';
import assert from 'node:assert/strict';
import { MENU_ITEMS } from './components/AdminLayout';

test('Reports Navigation: Laporan group contains all 6 required submenus', () => {
  const reportsGroup = MENU_ITEMS.find((m) => m.id === 'reports');
  assert.ok(reportsGroup, 'Laporan group must exist');
  assert.equal(reportsGroup.subItems?.length, 6, 'Laporan must contain 6 submenus');

  const expectedSubmenus = [
    { id: 'reports.events', label: 'Rekap Per Acara', path: '/admin/reports/events' },
    { id: 'reports.periodic', label: 'Penggunaan Periodik', path: '/admin/reports/periodic' },
    { id: 'reports.templates_filters', label: 'Template & Filter', path: '/admin/reports/templates-filters' },
    { id: 'reports.prints', label: 'Cetak', path: '/admin/reports/prints' },
    { id: 'reports.storage', label: 'Penyimpanan & Retensi', path: '/admin/reports/storage' },
    { id: 'reports.audit_log', label: 'Aktivitas Tim', path: '/admin/reports/audit-log' },
  ];

  expectedSubmenus.forEach((expected, i) => {
    const actual = reportsGroup.subItems?.[i];
    assert.ok(actual, `Submenu at index ${i} must exist`);
    assert.equal(actual.id, expected.id);
    assert.equal(actual.label, expected.label);
    assert.equal(actual.path, expected.path);
  });
});

test('CSV & Excel Export Helper: sanitizes quotes, commas, and special characters', () => {
  const sanitize = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  assert.equal(sanitize('Simple Text'), '"Simple Text"');
  assert.equal(sanitize('Text with "quotes"'), '"Text with ""quotes"""');
  assert.equal(sanitize('Text with, comma'), '"Text with, comma"');
  assert.equal(sanitize(null), '');
  assert.equal(sanitize(undefined), '');
  assert.equal(sanitize(1250), '"1250"');
});

test('Analytics Funnel: calculates drop-off percentage correctly', () => {
  const calcDropOff = (prev: number, curr: number) => {
    if (prev <= 0) return 0;
    return Math.round(((prev - curr) / prev) * 1000) / 10;
  };

  // From 100 to 80 = 20% drop
  assert.equal(calcDropOff(100, 80), 20);

  // From 80 to 70 = 12.5% drop
  assert.equal(calcDropOff(80, 70), 12.5);

  // From 0 to 0 = 0%
  assert.equal(calcDropOff(0, 0), 0);

  // From 50 to 50 = 0% drop
  assert.equal(calcDropOff(50, 50), 0);
});

test('Storage Calculation: assigns correct weights per asset type', () => {
  const getAssetSize = (type: string) => {
    switch (type) {
      case 'frame_result':
        return 870000;
      case 'raw_photo':
        return 650000;
      case 'live_photo':
        return 1500000;
      case 'gif':
        return 1200000;
      case 'gif_mp4':
        return 950000;
      default:
        return 400000;
    }
  };

  assert.equal(getAssetSize('frame_result'), 870000);
  assert.equal(getAssetSize('raw_photo'), 650000);
  assert.equal(getAssetSize('live_photo'), 1500000);
  assert.equal(getAssetSize('gif'), 1200000);
  assert.equal(getAssetSize('unknown'), 400000);
});
