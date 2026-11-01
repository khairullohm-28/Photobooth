import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_DIMENSIONS, INITIAL_PROFILES } from './printerService';
import { PrintPreset } from '../types/photobooth';

test('Printer Presets: correctly defines millimeter dimensions for standard paper', () => {
  assert.equal(PRESET_DIMENSIONS['4r'].width_mm, 102);
  assert.equal(PRESET_DIMENSIONS['4r'].height_mm, 152);

  assert.equal(PRESET_DIMENSIONS['strip_2x6'].width_mm, 51);
  assert.equal(PRESET_DIMENSIONS['strip_2x6'].height_mm, 152);

  assert.equal(PRESET_DIMENSIONS['5r'].width_mm, 127);
  assert.equal(PRESET_DIMENSIONS['5r'].height_mm, 178);

  assert.equal(PRESET_DIMENSIONS['a4'].width_mm, 210);
  assert.equal(PRESET_DIMENSIONS['a4'].height_mm, 297);
});

test('Printer Profiles: initial profiles have exactly one default', () => {
  const defaults = INITIAL_PROFILES.filter((p) => p.is_default);
  assert.equal(defaults.length, 1);
  assert.equal(defaults[0].paper_preset, '4r');
});

test('Printer Margin: verify zero or non-negative margins', () => {
  for (const p of INITIAL_PROFILES) {
    assert.ok(p.margin_top_mm >= 0);
    assert.ok(p.margin_right_mm >= 0);
    assert.ok(p.margin_bottom_mm >= 0);
    assert.ok(p.margin_left_mm >= 0);
  }
});
