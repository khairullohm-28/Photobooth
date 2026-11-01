/**
 * Filter Management Service
 * Handles 3D LUT (.cube) uploads, strip PNG generation, thumbnail synthesis,
 * filter reordering, and audit logging.
 */

import { supabase } from './supabase';
import { AdminService } from './adminService';
import { Filter, FilterExtraEffects } from '../types/photobooth';
import { parseCubeFile, createLutStripDataUrl, applyLut } from '../lib/lut';
import { buildDefaultLutFilters } from '../lib/presetLuts';

const STORAGE_FILTERS_KEY = 'wedding_studio_filters';

// Default sample image used for generating filter thumbnails
export const SAMPLE_FILTER_IMAGES = [
  {
    id: 'bride',
    label: 'Potret Pengantin',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'indoor',
    label: 'Suasana Indoor',
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'outdoor',
    label: 'Suasana Outdoor',
    url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=600&q=80',
  },
];

export function getStoredFilters(): Filter[] {
  try {
    const raw = localStorage.getItem(STORAGE_FILTERS_KEY);
    if (raw) {
      const parsed: Filter[] = JSON.parse(raw);
      if (parsed.length > 0) return parsed;
    }
  } catch {}

  const defaults = buildDefaultLutFilters();
  try {
    localStorage.setItem(STORAGE_FILTERS_KEY, JSON.stringify(defaults));
  } catch {}
  return defaults;
}

export function saveStoredFilters(filters: Filter[]) {
  try {
    localStorage.setItem(STORAGE_FILTERS_KEY, JSON.stringify(filters));
  } catch (err) {
    console.warn('LocalStorage save filters error:', err);
  }
}

export const FilterService = {
  /**
   * Get all active non-archived filters for guest app & previews, sorted by sort_order
   */
  async getActiveFilters(): Promise<Filter[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('filters')
          .select('*')
          .eq('is_active', true)
          .eq('is_archived', false)
          .order('sort_order', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as Filter[];
        }
      } catch (e) {
        console.warn('Supabase getActiveFilters error:', e);
      }
    }

    const local = getStoredFilters();
    return local
      .filter((f) => f.is_active !== false && !f.is_archived)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  },

  /**
   * Get all filters for admin table/grid
   */
  async getAllAdminFilters(): Promise<Filter[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('filters')
          .select('*')
          .eq('is_archived', false)
          .order('sort_order', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as Filter[];
        }
      } catch (e) {
        console.warn('Supabase getAllAdminFilters error:', e);
      }
    }

    const local = getStoredFilters();
    return local
      .filter((f) => !f.is_archived)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  },

  /**
   * Alias for getAllAdminFilters
   */
  async getFilters(): Promise<Filter[]> {
    return this.getAllAdminFilters();
  },

  /**
   * Generates a preview thumbnail for a filter using WebGL applyLut
   */
  async generateThumbnail(
    lutStripUrl: string,
    intensity: number = 100,
    extraEffects?: FilterExtraEffects,
    sampleImageUrl?: string,
    lutSize: number = 33
  ): Promise<string> {
    try {
      const srcUrl = sampleImageUrl || SAMPLE_FILTER_IMAGES[0].url;
      const canvas = await applyLut(srcUrl, lutStripUrl, intensity, extraEffects, lutSize);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (e) {
      console.warn('Failed to generate filter thumbnail:', e);
      return '';
    }
  },

  /**
   * Upload and process a .cube file
   */
  async processCubeFile(file: File): Promise<Filter> {
    const text = await file.text();
    const fallbackTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const parsed = parseCubeFile(text, fallbackTitle);

    const { dataUrl: lutStripDataUrl, finalSize } = createLutStripDataUrl(parsed);

    // Generate sample thumbnail
    let thumbUrl = '';
    try {
      thumbUrl = await this.generateThumbnail(lutStripDataUrl, 100, undefined, undefined, finalSize);
    } catch {}

    const filterId = `flt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const currentFilters = getStoredFilters();
    const maxSort = currentFilters.reduce((m, f) => Math.max(m, f.sort_order ?? 0), 0);

    const newFilter: Filter = {
      id: filterId,
      name: parsed.title || fallbackTitle,
      lut_url: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`,
      lut_png_url: lutStripDataUrl,
      lut_size: finalSize,
      intensity_default: 100,
      thumbnail_url: thumbUrl,
      is_active: true,
      is_archived: false,
      sort_order: maxSort + 1,
      extra_effects: { grain: 0, softness: 0, vignette: 0 },
      created_at: new Date().toISOString(),
    };

    // If Supabase connected, attempt to upload to storage & insert table
    if (supabase) {
      try {
        // Upload cube file to luts bucket
        const cubePath = `${filterId}.cube`;
        await supabase.storage.from('luts').upload(cubePath, file, {
          contentType: 'text/plain',
          upsert: true,
        });
        const { data: cubePublic } = supabase.storage.from('luts').getPublicUrl(cubePath);
        if (cubePublic?.publicUrl) {
          newFilter.lut_url = cubePublic.publicUrl;
        }

        // Insert to database
        const { error: dbErr } = await supabase.from('filters').insert([newFilter]);
        if (dbErr) {
          console.warn('Supabase insert filter failed, using local storage:', dbErr);
        }
      } catch (e) {
        console.warn('Supabase storage/insert error:', e);
      }
    }

    // Save locally
    const updated = [...currentFilters, newFilter];
    saveStoredFilters(updated);

    // Audit Log
    const currentAdmin = AdminService.getCurrentAdmin();
    if (currentAdmin) {
      await AdminService.recordAuditLog(
        currentAdmin.id,
        currentAdmin.name,
        'filter_create',
        `Menambah filter baru "${newFilter.name}" (LUT 3D ${finalSize}x${finalSize}x${finalSize})`
      );
    }

    return newFilter;
  },

  /**
   * Update filter attributes (name, intensity, extra_effects, is_active)
   */
  async updateFilter(id: string, partial: Partial<Filter>): Promise<Filter> {
    const filters = getStoredFilters();
    const idx = filters.findIndex((f) => f.id === id);
    if (idx === -1) throw new Error('Filter tidak ditemukan');

    const updated = { ...filters[idx], ...partial };

    // Re-generate thumbnail if intensity or extra_effects changed
    if (
      (partial.intensity_default !== undefined || partial.extra_effects !== undefined) &&
      updated.lut_png_url
    ) {
      try {
        updated.thumbnail_url = await this.generateThumbnail(
          updated.lut_png_url,
          updated.intensity_default,
          updated.extra_effects,
          undefined,
          updated.lut_size || 33
        );
      } catch {}
    }

    filters[idx] = updated;
    saveStoredFilters(filters);

    if (supabase) {
      try {
        await supabase.from('filters').update(partial).eq('id', id);
      } catch (e) {
        console.warn('Supabase update filter error:', e);
      }
    }

    const currentAdmin = AdminService.getCurrentAdmin();
    if (currentAdmin) {
      await AdminService.recordAuditLog(
        currentAdmin.id,
        currentAdmin.name,
        'filter_update',
        `Memperbarui pengaturan filter "${updated.name}"`
      );
    }

    return updated;
  },

  /**
   * Soft delete a filter
   */
  async deleteFilter(id: string): Promise<void> {
    const filters = getStoredFilters();
    const target = filters.find((f) => f.id === id);
    if (!target) return;

    const updated = filters.map((f) => (f.id === id ? { ...f, is_archived: true } : f));
    saveStoredFilters(updated);

    if (supabase) {
      try {
        await supabase.from('filters').update({ is_archived: true }).eq('id', id);
      } catch (e) {
        console.warn('Supabase soft delete filter error:', e);
      }
    }

    const currentAdmin = AdminService.getCurrentAdmin();
    if (currentAdmin) {
      await AdminService.recordAuditLog(
        currentAdmin.id,
        currentAdmin.name,
        'filter_delete',
        `Menghapus filter "${target.name}"`
      );
    }
  },

  /**
   * Reorder filters
   */
  async reorderFilters(orderedIds: string[]): Promise<void> {
    const filters = getStoredFilters();
    const updated = filters.map((f) => {
      const idx = orderedIds.indexOf(f.id);
      return idx !== -1 ? { ...f, sort_order: idx + 1 } : f;
    });

    saveStoredFilters(updated);

    if (supabase) {
      try {
        for (let i = 0; i < orderedIds.length; i++) {
          await supabase.from('filters').update({ sort_order: i + 1 }).eq('id', orderedIds[i]);
        }
      } catch (e) {
        console.warn('Supabase reorder filters error:', e);
      }
    }

    const currentAdmin = AdminService.getCurrentAdmin();
    if (currentAdmin) {
      await AdminService.recordAuditLog(
        currentAdmin.id,
        currentAdmin.name,
        'filter_reorder',
        'Mengubah urutan tampilan filter'
      );
    }
  },
};
