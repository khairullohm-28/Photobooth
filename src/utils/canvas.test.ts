import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCoverCrop,
  calculateSlotPixels,
  getCssFilterString,
  calculateExpirationDate,
  formatCountdownTimer,
} from './canvas';

test('calculateCoverCrop: crops wider source correctly', () => {
  // Source 1920x1080 (16:9), target 1000x1000 (1:1)
  const crop = calculateCoverCrop(1920, 1080, 1000, 1000);
  assert.equal(crop.sy, 0);
  assert.equal(crop.sh, 1080);
  assert.equal(crop.sw, 1080);
  assert.equal(crop.sx, (1920 - 1080) / 2);
});

test('calculateCoverCrop: crops taller source correctly', () => {
  // Source 1080x1920 (9:16), target 1000x1000 (1:1)
  const crop = calculateCoverCrop(1080, 1920, 1000, 1000);
  assert.equal(crop.sx, 0);
  assert.equal(crop.sw, 1080);
  assert.equal(crop.sh, 1080);
  assert.equal(crop.sy, (1920 - 1080) / 2);
});

test('calculateSlotPixels: maps percentage to pixels accurately', () => {
  const slot = { x: 10, y: 20, w: 80, h: 60, shot_index: 0 };
  const bounds = calculateSlotPixels(slot, 1000, 2000);
  assert.equal(bounds.x, 100);
  assert.equal(bounds.y, 400);
  assert.equal(bounds.w, 800);
  assert.equal(bounds.h, 1200);
});

test('getCssFilterString: builds expected filter values', () => {
  const filter1 = getCssFilterString({ brightness: 110, grayscale: 100 });
  assert.equal(filter1, 'brightness(110%) grayscale(100%)');

  const empty = getCssFilterString({});
  assert.equal(empty, 'none');
});

test('calculateExpirationDate: adds retention hours properly', () => {
  const base = '2026-10-28T12:00:00.000Z';
  const expires = calculateExpirationDate(base, 120);
  const diffHours = (new Date(expires).getTime() - new Date(base).getTime()) / (3600 * 1000);
  assert.equal(diffHours, 120);
});

test('formatCountdownTimer: formats hours above 99 properly', () => {
  const ms120Hours = 120 * 3600 * 1000;
  const formatted = formatCountdownTimer(ms120Hours);
  assert.equal(formatted.formatted, '120:00:00');
  assert.equal(formatted.isExpired, false);

  const expired = formatCountdownTimer(-500);
  assert.equal(expired.formatted, '00:00:00');
  assert.equal(expired.isExpired, true);
});
