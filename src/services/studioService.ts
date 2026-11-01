/**
 * Studio Foto Service Layer
 * Handles Template Categories, Frame CRUD, Hole Detection, WebP Compression,
 * Soft-delete guards, and Audit Logging.
 */

import { supabase } from './supabase';
import { AdminService } from './adminService';
import { Frame, FrameSlot, TemplateCategory } from '../types/photobooth';
import { SEED_CATEGORIES, SEED_FRAMES, SEED_EVENT } from '../data/seedData';

const STORAGE_CATEGORIES_KEY = 'wedding_studio_categories';
const STORAGE_FRAMES_KEY = 'wedding_studio_frames';
const STORAGE_SESSIONS_KEY = 'wedding_pb_sessions';

// ----------------------------------------------------
// Local Storage Helpers
// ----------------------------------------------------
export function getStoredCategories(): TemplateCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_CATEGORIES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return SEED_CATEGORIES;
}

export function saveStoredCategories(categories: TemplateCategory[]) {
  try {
    localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(categories));
  } catch (err) {
    console.warn('LocalStorage save categories error:', err);
  }
}

export function getStoredFrames(): Frame[] {
  try {
    const raw = localStorage.getItem(STORAGE_FRAMES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return SEED_FRAMES;
}

export function saveStoredFrames(frames: Frame[]) {
  try {
    localStorage.setItem(STORAGE_FRAMES_KEY, JSON.stringify(frames));
  } catch (err) {
    console.warn('LocalStorage save frames error:', err);
  }
}

// ----------------------------------------------------
// Image Processing & Hole Detection Math Utilities
// ----------------------------------------------------

/**
 * Compresses an image element or data URL to WebP format
 * with max longest edge constraints.
 */
export async function generateWebpAndThumb(
  sourceImage: HTMLImageElement | string,
  maxPreviewEdge: number = 1000,
  maxThumbEdge: number = 320
): Promise<{ previewUrl: string; thumbUrl: string }> {
  let img: HTMLImageElement;
  if (typeof sourceImage === 'string') {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = (e) => reject(new Error('Failed to load image for WebP compression'));
      el.src = sourceImage;
    });
  } else {
    img = sourceImage;
  }

  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // 1. Generate Preview WebP
  let pW = origW;
  let pH = origH;
  if (Math.max(origW, origH) > maxPreviewEdge) {
    if (origW >= origH) {
      pW = maxPreviewEdge;
      pH = Math.round((origH * maxPreviewEdge) / origW);
    } else {
      pH = maxPreviewEdge;
      pW = Math.round((origW * maxPreviewEdge) / origH);
    }
  }

  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = pW;
  previewCanvas.height = pH;
  const pCtx = previewCanvas.getContext('2d');
  if (pCtx) {
    pCtx.drawImage(img, 0, 0, pW, pH);
  }
  const previewUrl = previewCanvas.toDataURL('image/webp', 0.85);

  // 2. Generate Thumbnail WebP
  let tW = origW;
  let tH = origH;
  if (Math.max(origW, origH) > maxThumbEdge) {
    if (origW >= origH) {
      tW = maxThumbEdge;
      tH = Math.round((origH * maxThumbEdge) / origW);
    } else {
      tH = maxThumbEdge;
      tW = Math.round((origW * maxThumbEdge) / origH);
    }
  }

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = tW;
  thumbCanvas.height = tH;
  const tCtx = thumbCanvas.getContext('2d');
  if (tCtx) {
    tCtx.drawImage(img, 0, 0, tW, tH);
  }
  const thumbUrl = thumbCanvas.toDataURL('image/webp', 0.80);

  return { previewUrl, thumbUrl };
}

/**
 * Automatic Hole Detection
 * Downscales frame image (max 600px for speed), searches for transparent islands (alpha < 16),
 * ignores border-touching areas and tiny areas (< 2% of canvas),
 * and creates bounding box slots with rotation 0 and sequential shot_index (1, 2, ...).
 */
export function detectHolesFromImageData(
  img: HTMLImageElement,
  alphaThreshold: number = 16,
  minAreaPercent: number = 2.0
): FrameSlot[] {
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;
  if (!origW || !origH) return [];

  // Downscale for fast pixel scanning
  const maxScanDim = 600;
  const scale = Math.min(1, maxScanDim / Math.max(origW, origH));
  const scanW = Math.max(1, Math.round(origW * scale));
  const scanH = Math.max(1, Math.round(origH * scale));

  const offscreen = document.createElement('canvas');
  offscreen.width = scanW;
  offscreen.height = scanH;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return [];

  ctx.drawImage(img, 0, 0, scanW, scanH);
  const imgData = ctx.getImageData(0, 0, scanW, scanH);
  const data = imgData.data;

  // 2D grid of visited pixels
  const totalPixels = scanW * scanH;
  const visited = new Uint8Array(totalPixels);

  // Helper to test if a pixel is transparent (hole candidate)
  const isTransparent = (x: number, y: number): boolean => {
    if (x < 0 || x >= scanW || y < 0 || y >= scanH) return false;
    const idx = (y * scanW + x) * 4;
    return data[idx + 3] < alphaThreshold;
  };

  const detectedIslands: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    pixelCount: number;
    touchesBorder: boolean;
  }[] = [];

  // Flood fill / BFS queue
  const queueX = new Int32Array(totalPixels);
  const queueY = new Int32Array(totalPixels);

  for (let y = 0; y < scanH; y++) {
    for (let x = 0; x < scanW; x++) {
      const pIdx = y * scanW + x;
      if (visited[pIdx] || !isTransparent(x, y)) continue;

      // Start new region BFS
      visited[pIdx] = 1;
      let head = 0;
      let tail = 0;
      queueX[tail] = x;
      queueY[tail] = y;
      tail++;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let pixelCount = 0;
      let touchesBorder = false;

      while (head < tail) {
        const curX = queueX[head];
        const curY = queueY[head];
        head++;
        pixelCount++;

        if (curX <= 1 || curX >= scanW - 2 || curY <= 1 || curY >= scanH - 2) {
          touchesBorder = true;
        }

        if (curX < minX) minX = curX;
        if (curX > maxX) maxX = curX;
        if (curY < minY) minY = curY;
        if (curY > maxY) maxY = curY;

        // Check 4-directional neighbors
        const neighbors = [
          [curX + 1, curY],
          [curX - 1, curY],
          [curX, curY + 1],
          [curX, curY - 1],
        ];

        for (let i = 0; i < 4; i++) {
          const nx = neighbors[i][0];
          const ny = neighbors[i][1];
          if (nx >= 0 && nx < scanW && ny >= 0 && ny < scanH) {
            const nIdx = ny * scanW + nx;
            if (!visited[nIdx] && isTransparent(nx, ny)) {
              visited[nIdx] = 1;
              queueX[tail] = nx;
              queueY[tail] = ny;
              tail++;
            }
          }
        }
      }

      const areaRatio = (pixelCount / totalPixels) * 100;

      // Discard islands that touch outer edge or are smaller than threshold (< 2%)
      if (!touchesBorder && areaRatio >= minAreaPercent) {
        detectedIslands.push({
          minX,
          maxX,
          minY,
          maxY,
          pixelCount,
          touchesBorder,
        });
      }
    }
  }

  // Sort detected islands top-to-bottom, left-to-right
  detectedIslands.sort((a, b) => {
    const diffY = a.minY - b.minY;
    if (Math.abs(diffY) > scanH * 0.08) return diffY;
    return a.minX - b.minX;
  });

  // Convert bounding boxes to normalized 0-1 slots with sequential shot_index starting at 1
  return detectedIslands.map((island, idx) => {
    // Add tiny 1px inner margin to avoid frame border edge clipping
    const xNorm = Math.max(0, island.minX / scanW);
    const yNorm = Math.max(0, island.minY / scanH);
    const wNorm = Math.min(1 - xNorm, (island.maxX - island.minX + 1) / scanW);
    const hNorm = Math.min(1 - yNorm, (island.maxY - island.minY + 1) / scanH);

    return {
      id: `slot_${Date.now()}_${idx + 1}`,
      x: Number(xNorm.toFixed(4)),
      y: Number(yNorm.toFixed(4)),
      w: Number(wNorm.toFixed(4)),
      h: Number(hNorm.toFixed(4)),
      rotation: 0,
      shot_index: idx + 1,
    };
  });
}

/**
 * Checks if a slot region is heavily obstructed (> 20% opaque pixels)
 */
export function checkSlotObstruction(
  img: HTMLImageElement,
  slot: FrameSlot,
  canvasW: number,
  canvasH: number
): { isObstructed: boolean; opaquePercent: number } {
  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = canvasW;
    offscreen.height = canvasH;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return { isObstructed: false, opaquePercent: 0 };

    ctx.drawImage(img, 0, 0, canvasW, canvasH);

    // Calculate slot pixel rect (support both 0-1 and percent)
    const factorX = slot.w <= 1.0 ? canvasW : canvasW / 100;
    const factorY = slot.h <= 1.0 ? canvasH : canvasH / 100;

    const sx = Math.max(0, Math.round(slot.x * factorX));
    const sy = Math.max(0, Math.round(slot.y * factorY));
    const sw = Math.min(canvasW - sx, Math.round(slot.w * factorX));
    const sh = Math.min(canvasH - sy, Math.round(slot.h * factorY));

    if (sw <= 0 || sh <= 0) return { isObstructed: false, opaquePercent: 0 };

    const sample = ctx.getImageData(sx, sy, sw, sh);
    const data = sample.data;
    const totalPixels = sw * sh;
    let opaqueCount = 0;

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 200) {
        opaqueCount++;
      }
    }

    const opaquePercent = Math.round((opaqueCount / totalPixels) * 100);
    return {
      isObstructed: opaquePercent > 20,
      opaquePercent,
    };
  } catch {
    return { isObstructed: false, opaquePercent: 0 };
  }
}

// ----------------------------------------------------
// Studio Foto Service Class
// ----------------------------------------------------

export interface CreateFramePayload {
  name: string;
  category_id: string;
  image_url: string; // Original PNG
  preview_url?: string;
  thumbnail_url?: string;
  canvas_width: number;
  canvas_height: number;
  slots: FrameSlot[];
  aspect_ratio?: string;
  badge?: string;
  is_active?: boolean;
}

export const StudioService = {
  // ==========================================
  // 1. Template Categories
  // ==========================================

  async getCategories(): Promise<TemplateCategory[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('template_categories')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          return data as TemplateCategory[];
        }
      } catch (err) {
        console.warn('Supabase getCategories fallback:', err);
      }
    }
    return getStoredCategories();
  },

  async createCategory(name: string): Promise<{ success: boolean; category?: TemplateCategory; error?: string }> {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, error: 'Nama kategori tidak boleh kosong' };
    }

    const categories = await this.getCategories();
    const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      return { success: false, error: 'Kategori dengan nama tersebut sudah ada' };
    }

    const newCat: TemplateCategory = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      created_at: new Date().toISOString(),
    };

    if (supabase) {
      try {
        await supabase.from('template_categories').insert(newCat);
      } catch (err) {
        console.warn('Supabase createCategory notice:', err);
      }
    }

    const updated = [newCat, ...categories];
    saveStoredCategories(updated);

    await AdminService.logAudit('create', 'template_categories', newCat.id, { name: newCat.name });

    return { success: true, category: newCat };
  },

  async updateCategory(id: string, name: string): Promise<{ success: boolean; category?: TemplateCategory; error?: string }> {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, error: 'Nama kategori tidak boleh kosong' };
    }

    const categories = await this.getCategories();
    const target = categories.find((c) => c.id === id);
    if (!target) {
      return { success: false, error: 'Kategori tidak ditemukan' };
    }

    const duplicate = categories.find((c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      return { success: false, error: 'Nama kategori sudah digunakan' };
    }

    const updatedCat: TemplateCategory = {
      ...target,
      name: trimmed,
    };

    if (supabase) {
      try {
        await supabase
          .from('template_categories')
          .update({ name: trimmed })
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase updateCategory notice:', err);
      }
    }

    const nextList = categories.map((c) => (c.id === id ? updatedCat : c));
    saveStoredCategories(nextList);

    await AdminService.logAudit('update', 'template_categories', id, { old_name: target.name, new_name: trimmed });

    return { success: true, category: updatedCat };
  },

  /**
   * Delete Category Guard:
   * Blocked if category has templates (active or archived) OR is assigned to any event.
   */
  async deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
    const categories = await this.getCategories();
    const target = categories.find((c) => c.id === id);
    if (!target) {
      return { success: false, error: 'Kategori tidak ditemukan' };
    }

    // 1. Check if category still has templates
    const allFrames = await this.getFrames({ includeArchived: true });
    const framesWithCategory = allFrames.filter((f) => f.category_id === id);
    if (framesWithCategory.length > 0) {
      return {
        success: false,
        error: `Kategori "${target.name}" tidak dapat dihapus karena masih memiliki ${framesWithCategory.length} template frame. Hapus atau pindahkan template terlebih dahulu.`,
      };
    }

    // 2. Check if category is assigned to any event
    const eventCheck = await this.checkCategoryAssignedToEvent(id);
    if (eventCheck.isAssigned) {
      return {
        success: false,
        error: `Kategori "${target.name}" tidak dapat dihapus karena sedang dipakai oleh acara: ${eventCheck.eventNames.join(', ')}.`,
      };
    }

    if (supabase) {
      try {
        await supabase.from('template_categories').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteCategory notice:', err);
      }
    }

    const remaining = categories.filter((c) => c.id !== id);
    saveStoredCategories(remaining);

    await AdminService.logAudit('delete', 'template_categories', id, { name: target.name });

    return { success: true };
  },

  async checkCategoryAssignedToEvent(
    categoryId: string
  ): Promise<{ isAssigned: boolean; eventNames: string[] }> {
    // 1. Check Supabase events table if connected
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('couple_names, template_category_id')
          .eq('template_category_id', categoryId);
        if (!error && data && data.length > 0) {
          return {
            isAssigned: true,
            eventNames: data.map((e) => e.couple_names),
          };
        }
      } catch {}
    }

    // 2. Fallback check with SEED_EVENT
    if (SEED_EVENT.template_category_id === categoryId) {
      return {
        isAssigned: true,
        eventNames: [SEED_EVENT.couple_names],
      };
    }

    return { isAssigned: false, eventNames: [] };
  },

  /**
   * Returns usage statistics for all categories
   */
  async getCategoriesWithStats(): Promise<
    (TemplateCategory & { templateCount: number; eventsUsedCount: number; eventNames: string[] })[]
  > {
    const [categories, frames] = await Promise.all([
      this.getCategories(),
      this.getFrames({ includeArchived: true }),
    ]);

    const results = [];
    for (const cat of categories) {
      const templateCount = frames.filter((f) => f.category_id === cat.id && !f.is_archived).length;
      const eventCheck = await this.checkCategoryAssignedToEvent(cat.id);
      results.push({
        ...cat,
        templateCount,
        eventsUsedCount: eventCheck.eventNames.length,
        eventNames: eventCheck.eventNames,
      });
    }

    return results;
  },

  // ==========================================
  // 2. Template / Frame Management
  // ==========================================

  async getFrames(options?: {
    categoryId?: string;
    includeArchived?: boolean;
    search?: string;
  }): Promise<Frame[]> {
    let list: Frame[] = [];

    if (supabase) {
      try {
        let query = supabase.from('frames').select('*').order('sort_order', { ascending: true });
        if (options?.categoryId) {
          query = query.eq('category_id', options.categoryId);
        }
        if (!options?.includeArchived) {
          query = query.eq('is_archived', false);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          list = data as Frame[];
        }
      } catch (err) {
        console.warn('Supabase getFrames fallback:', err);
      }
    }

    if (list.length === 0) {
      list = getStoredFrames();
    }

    // Apply filters
    if (options?.categoryId) {
      list = list.filter((f) => f.category_id === options.categoryId);
    }
    if (!options?.includeArchived) {
      list = list.filter((f) => !f.is_archived);
    }
    if (options?.search) {
      const term = options.search.toLowerCase().trim();
      list = list.filter((f) => f.name.toLowerCase().includes(term));
    }

    // Sort order ascending
    list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    return list;
  },

  async getFrameById(id: string): Promise<Frame | null> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('frames').select('*').eq('id', id).single();
        if (!error && data) return data as Frame;
      } catch {}
    }
    const stored = getStoredFrames();
    return stored.find((f) => f.id === id) || null;
  },

  async createFrame(payload: CreateFramePayload): Promise<{ success: boolean; frame?: Frame; error?: string }> {
    if (!payload.name?.trim()) {
      return { success: false, error: 'Nama template tidak boleh kosong' };
    }
    if (!payload.category_id) {
      return { success: false, error: 'Pilih kategori template terlebih dahulu' };
    }
    if (!payload.image_url) {
      return { success: false, error: 'File frame PNG belum diunggah' };
    }
    if (!payload.slots || payload.slots.length === 0) {
      return { success: false, error: 'Template harus memiliki minimal 1 slot foto' };
    }

    // Auto-calculate unique photo count from slots
    const uniqueShots = new Set(payload.slots.map((s) => s.shot_index));
    const photoCount = uniqueShots.size;

    // Get current frames to determine next sort_order
    const existing = await this.getFrames({ includeArchived: true });
    const maxSort = existing.reduce((max, f) => Math.max(max, f.sort_order || 0), 0);

    const newFrame: Frame = {
      id: `frm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category_id: payload.category_id,
      name: payload.name.trim(),
      image_url: payload.image_url,
      preview_url: payload.preview_url || payload.image_url,
      thumbnail_url: payload.thumbnail_url || payload.preview_url || payload.image_url,
      canvas_width: payload.canvas_width,
      canvas_height: payload.canvas_height,
      slots: payload.slots,
      photo_count: photoCount,
      sort_order: maxSort + 1,
      is_active: payload.is_active ?? true,
      is_archived: false,
      aspect_ratio: payload.aspect_ratio || `${payload.canvas_width}:${payload.canvas_height}`,
      badge: payload.badge,
      created_at: new Date().toISOString(),
    };

    if (supabase) {
      try {
        await supabase.from('frames').insert(newFrame);
      } catch (err) {
        console.warn('Supabase createFrame notice:', err);
      }
    }

    const updatedList = [...existing, newFrame];
    saveStoredFrames(updatedList);

    await AdminService.logAudit('create', 'frames', newFrame.id, {
      name: newFrame.name,
      category_id: newFrame.category_id,
      photo_count: newFrame.photo_count,
    });

    return { success: true, frame: newFrame };
  },

  async updateFrame(
    id: string,
    updates: Partial<CreateFramePayload>
  ): Promise<{ success: boolean; frame?: Frame; error?: string }> {
    const existing = await this.getFrames({ includeArchived: true });
    const target = existing.find((f) => f.id === id);
    if (!target) {
      return { success: false, error: 'Template tidak ditemukan' };
    }

    const nextSlots = updates.slots || target.slots;
    const uniqueShots = new Set(nextSlots.map((s) => s.shot_index));
    const photoCount = uniqueShots.size;

    const updatedFrame: Frame = {
      ...target,
      ...updates,
      slots: nextSlots,
      photo_count: photoCount,
      aspect_ratio:
        updates.aspect_ratio ||
        (updates.canvas_width && updates.canvas_height
          ? `${updates.canvas_width}:${updates.canvas_height}`
          : target.aspect_ratio),
    };

    if (supabase) {
      try {
        await supabase.from('frames').update(updatedFrame).eq('id', id);
      } catch (err) {
        console.warn('Supabase updateFrame notice:', err);
      }
    }

    const nextList = existing.map((f) => (f.id === id ? updatedFrame : f));
    saveStoredFrames(nextList);

    await AdminService.logAudit('update', 'frames', id, {
      name: updatedFrame.name,
      updated_keys: Object.keys(updates),
    });

    return { success: true, frame: updatedFrame };
  },

  async toggleFrameStatus(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
    const existing = await this.getFrames({ includeArchived: true });
    const target = existing.find((f) => f.id === id);
    if (!target) return { success: false, error: 'Template tidak ditemukan' };

    const updated: Frame = { ...target, is_active: isActive };

    if (supabase) {
      try {
        await supabase.from('frames').update({ is_active: isActive }).eq('id', id);
      } catch (err) {
        console.warn('Supabase toggle status notice:', err);
      }
    }

    const nextList = existing.map((f) => (f.id === id ? updated : f));
    saveStoredFrames(nextList);

    await AdminService.logAudit('update', 'frames', id, { is_active: isActive });
    return { success: true };
  },

  async duplicateFrame(id: string): Promise<{ success: boolean; frame?: Frame; error?: string }> {
    const target = await this.getFrameById(id);
    if (!target) return { success: false, error: 'Template sumber tidak ditemukan' };

    const existing = await this.getFrames({ includeArchived: true });
    const maxSort = existing.reduce((max, f) => Math.max(max, f.sort_order || 0), 0);

    const cloned: Frame = {
      ...target,
      id: `frm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${target.name} (Salinan)`,
      sort_order: maxSort + 1,
      is_active: true,
      is_archived: false,
      created_at: new Date().toISOString(),
      slots: target.slots.map((s, idx) => ({
        ...s,
        id: `slot_${Date.now()}_${idx + 1}`,
      })),
    };

    if (supabase) {
      try {
        await supabase.from('frames').insert(cloned);
      } catch (err) {
        console.warn('Supabase duplicateFrame notice:', err);
      }
    }

    const nextList = [...existing, cloned];
    saveStoredFrames(nextList);

    await AdminService.logAudit('duplicate', 'frames', cloned.id, {
      source_id: id,
      name: cloned.name,
    });

    return { success: true, frame: cloned };
  },

  /**
   * Reorders frames based on ordered array of frame IDs
   */
  async reorderFrames(orderedIds: string[]): Promise<boolean> {
    const existing = await this.getFrames({ includeArchived: true });
    const orderMap = new Map<string, number>();
    orderedIds.forEach((id, idx) => orderMap.set(id, idx + 1));

    const nextList = existing.map((f) => {
      if (orderMap.has(f.id)) {
        return { ...f, sort_order: orderMap.get(f.id)! };
      }
      return f;
    });

    saveStoredFrames(nextList);

    if (supabase) {
      try {
        for (let i = 0; i < orderedIds.length; i++) {
          await supabase.from('frames').update({ sort_order: i + 1 }).eq('id', orderedIds[i]);
        }
      } catch (err) {
        console.warn('Supabase reorderFrames notice:', err);
      }
    }

    await AdminService.logAudit('reorder', 'frames', undefined, { count: orderedIds.length });
    return true;
  },

  /**
   * Delete Frame:
   * If template was ever used in guest sessions, perform soft-delete (is_archived = true).
   * If never used, perform permanent hard delete.
   */
  async deleteFrame(id: string): Promise<{ success: boolean; softDeleted: boolean; error?: string }> {
    const existing = await this.getFrames({ includeArchived: true });
    const target = existing.find((f) => f.id === id);
    if (!target) return { success: false, softDeleted: false, error: 'Template tidak ditemukan' };

    // Check if used in any sessions
    let isUsedInSession = false;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('id')
          .eq('frame_id', id)
          .limit(1);
        if (!error && data && data.length > 0) {
          isUsedInSession = true;
        }
      } catch {}
    }

    if (!isUsedInSession) {
      try {
        const rawSessions = localStorage.getItem(STORAGE_SESSIONS_KEY);
        if (rawSessions) {
          const sessionsObj = JSON.parse(rawSessions);
          if (Object.values(sessionsObj).some((s: any) => s.frame_id === id)) {
            isUsedInSession = true;
          }
        }
      } catch {}
    }

    if (isUsedInSession) {
      // Soft-delete
      const updatedList = existing.map((f) =>
        f.id === id ? { ...f, is_archived: true, is_active: false } : f
      );
      saveStoredFrames(updatedList);

      if (supabase) {
        try {
          await supabase
            .from('frames')
            .update({ is_archived: true, is_active: false })
            .eq('id', id);
        } catch {}
      }

      await AdminService.logAudit('archive', 'frames', id, { name: target.name });
      return { success: true, softDeleted: true };
    }

    // Hard-delete
    const filtered = existing.filter((f) => f.id !== id);
    saveStoredFrames(filtered);

    if (supabase) {
      try {
        await supabase.from('frames').delete().eq('id', id);
      } catch {}
    }

    await AdminService.logAudit('delete', 'frames', id, { name: target.name });
    return { success: true, softDeleted: false };
  },
};
