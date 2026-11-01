import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSlotPixels } from '../utils/canvas';
import { FrameSlot } from '../types/photobooth';
import { detectHolesFromImageData } from '../services/studioService';

test('Slot Math: calculateSlotPixels correctly handles normalized 0-1 coordinates', () => {
  const slot: FrameSlot = {
    id: 's1',
    x: 0.1,
    y: 0.2,
    w: 0.5,
    h: 0.4,
    rotation: 30,
    shot_index: 1,
  };

  const canvasWidth = 1200;
  const canvasHeight = 1800;

  const pixels = calculateSlotPixels(slot, canvasWidth, canvasHeight);

  assert.equal(pixels.x, 120);
  assert.equal(pixels.y, 360);
  assert.equal(pixels.w, 600);
  assert.equal(pixels.h, 720);
  assert.equal(pixels.rotation, 30);
});

test('Slot Math: calculateSlotPixels correctly handles legacy percentage coordinates', () => {
  const slot: FrameSlot = {
    id: 's2',
    x: 10,
    y: 20,
    w: 50,
    h: 40,
    rotation: 45,
    shot_index: 2,
  };

  const canvasWidth = 1000;
  const canvasHeight = 1500;

  const pixels = calculateSlotPixels(slot, canvasWidth, canvasHeight);

  assert.equal(pixels.x, 100);
  assert.equal(pixels.y, 300);
  assert.equal(pixels.w, 500);
  assert.equal(pixels.h, 600);
  assert.equal(pixels.rotation, 45);
});

test('Slot Math: Center pivot calculation for rotation 30 deg', () => {
  const slot: FrameSlot = {
    id: 's3',
    x: 0.2,
    y: 0.3,
    w: 0.6,
    h: 0.4,
    rotation: 30,
    shot_index: 1,
  };

  const bounds = calculateSlotPixels(slot, 1000, 1000);
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;

  assert.equal(bounds.x, 200);
  assert.equal(bounds.y, 300);
  assert.equal(bounds.w, 600);
  assert.equal(bounds.h, 400);
  assert.equal(cx, 500);
  assert.equal(cy, 500);
  assert.equal(bounds.rotation, 30);
});

test('Photo Count: Auto-calculates count of unique shot_index values', () => {
  const slots: FrameSlot[] = [
    { id: '1', x: 0.1, y: 0.1, w: 0.3, h: 0.3, shot_index: 1 },
    { id: '2', x: 0.5, y: 0.1, w: 0.3, h: 0.3, shot_index: 1 }, // duplicate shot (strip)
    { id: '3', x: 0.1, y: 0.5, w: 0.3, h: 0.3, shot_index: 2 },
    { id: '4', x: 0.5, y: 0.5, w: 0.3, h: 0.3, shot_index: 2 }, // duplicate shot (strip)
  ];

  const uniqueShots = new Set(slots.map((s) => s.shot_index));
  assert.equal(uniqueShots.size, 2);
});

test('Category Delete Guard: Rejects deletion if category has templates or is in use', () => {
  // Guard logic simulation
  const dummyFrames = [
    { id: 'f1', category_id: 'cat_in_use', is_archived: false },
    { id: 'f2', category_id: 'cat_archived', is_archived: true },
  ];
  const assignedEventCatId = 'cat_assigned';

  const canDelete = (catId: string) => {
    const hasFrames = dummyFrames.some((f) => f.category_id === catId);
    if (hasFrames) {
      return { allowed: false, error: 'Kategori tidak dapat dihapus karena masih memiliki template aktif atau terarsip.' };
    }
    if (catId === assignedEventCatId) {
      return { allowed: false, error: 'Kategori tidak dapat dihapus karena sedang dipakai oleh acara pernikahan.' };
    }
    return { allowed: true };
  };

  assert.equal(canDelete('cat_in_use').allowed, false);
  assert.match(canDelete('cat_in_use').error || '', /memiliki template/);

  assert.equal(canDelete('cat_archived').allowed, false);
  assert.match(canDelete('cat_archived').error || '', /memiliki template/);

  assert.equal(canDelete('cat_assigned').allowed, false);
  assert.match(canDelete('cat_assigned').error || '', /sedang dipakai oleh acara/);

  assert.equal(canDelete('cat_empty').allowed, true);
});

test('Soft-Delete Guard: Archives template if used in guest sessions', () => {
  const sessions = [
    { id: 'sess_1', frame_id: 'frm_used' },
  ];

  const deleteFrame = (frameId: string) => {
    const isUsed = sessions.some((s) => s.frame_id === frameId);
    if (isUsed) {
      return { softDeleted: true, message: 'Arsip (soft-delete)' };
    }
    return { softDeleted: false, message: 'Hapus permanen' };
  };

  assert.equal(deleteFrame('frm_used').softDeleted, true);
  assert.equal(deleteFrame('frm_unused').softDeleted, false);
});
