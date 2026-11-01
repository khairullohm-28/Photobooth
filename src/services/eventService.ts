/**
 * Event / User Management Service Layer
 * Handles Multi-Wedding Events (User), Event Settings, Event Filters,
 * Screen Backgrounds (Image/GIF/Video), Slug & Prefix uniqueness checks,
 * Hard deletion with name confirmation, and Audit Logging.
 */

import { supabase } from './supabase';
import { AdminService } from './adminService';
import {
  Event,
  EventSettings,
  ScreenBackground,
  ScreenKey,
  AdminProfile,
} from '../types/photobooth';
import { SEED_EVENT, SEED_SETTINGS, SEED_BACKGROUNDS } from '../data/seedData';

const STORAGE_EVENTS_KEY = 'wedding_user_events';
const STORAGE_EVENT_SETTINGS_KEY = 'wedding_user_event_settings';
const STORAGE_EVENT_FILTERS_KEY = 'wedding_user_event_filters';
const STORAGE_SCREEN_BACKGROUNDS_KEY = 'wedding_user_screen_backgrounds';
const STORAGE_SESSIONS_KEY = 'wedding_pb_sessions';

// Pre-seeded demo events for immediate testing
const INITIAL_DEMO_EVENTS: Event[] = [
  SEED_EVENT,
  {
    id: 'evt_monika_david',
    name: 'Monika & David Wedding',
    slug: 'monika-david',
    code_prefix: 'MND',
    event_date: '15 November 2026',
    couple_names: 'Monika & David',
    quote_text: 'Two souls, one heart. A journey of infinite love and togetherness.',
    quote_source: 'Monika & David',
    template_category_id: 'cat_monika_david',
    active_from: new Date(Date.now() - 86400000 * 5).toISOString(),
    active_until: new Date(Date.now() + 86400000 * 30).toISOString(),
    status: 'aktif',
    is_demo: true,
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

const INITIAL_DEMO_SETTINGS: Record<string, EventSettings> = {
  evt_khai_lila_2026: SEED_SETTINGS,
  evt_monika_david: {
    event_id: 'evt_monika_david',
    retention_hours: 120,
    countdown_seconds: 3,
    default_mirror: true,
  },
};

const INITIAL_DEMO_FILTERS: Record<string, string[]> = {
  evt_khai_lila_2026: [], // empty = all active
  evt_monika_david: [],
};

const INITIAL_DEMO_BACKGROUNDS: Record<string, ScreenBackground[]> = {
  evt_khai_lila_2026: SEED_BACKGROUNDS,
  evt_monika_david: [
    {
      event_id: 'evt_monika_david',
      screen_key: 'landing',
      media_url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
      media_type: 'image',
      blur_px: 0,
      overlay_opacity: 0.45,
    },
    {
      event_id: 'evt_monika_david',
      screen_key: 'howto',
      media_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
      media_type: 'image',
      blur_px: 8,
      overlay_opacity: 0.55,
    },
    {
      event_id: 'evt_monika_david',
      screen_key: 'frame',
      media_url: 'https://images.unsplash.com/photo-1519225429980-715cb0215aed?auto=format&fit=crop&w=1200&q=80',
      media_type: 'image',
      blur_px: 8,
      overlay_opacity: 0.55,
    },
    {
      event_id: 'evt_monika_david',
      screen_key: 'camera',
      media_url: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1200&q=80',
      media_type: 'image',
      blur_px: 8,
      overlay_opacity: 0.60,
    },
    {
      event_id: 'evt_monika_david',
      screen_key: 'filter',
      media_url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=1200&q=80',
      media_type: 'image',
      blur_px: 8,
      overlay_opacity: 0.60,
    },
    {
      event_id: 'evt_monika_david',
      screen_key: 'result',
      media_url: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
      media_type: 'image',
      blur_px: 8,
      overlay_opacity: 0.65,
    },
  ],
};

// --------------------------------------------------------------------------
// Local Storage Helpers
// --------------------------------------------------------------------------

export function getStoredEvents(): Event[] {
  try {
    const raw = localStorage.getItem(STORAGE_EVENTS_KEY);
    if (raw) {
      const parsed: Event[] = JSON.parse(raw);
      if (parsed.length > 0) return parsed;
    }
  } catch {}

  try {
    localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(INITIAL_DEMO_EVENTS));
  } catch {}
  return INITIAL_DEMO_EVENTS;
}

export function saveStoredEvents(events: Event[]) {
  try {
    localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(events));
  } catch (err) {
    console.warn('LocalStorage save events error:', err);
  }
}

export function getStoredEventSettings(eventId: string): EventSettings {
  try {
    const raw = localStorage.getItem(STORAGE_EVENT_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed[eventId]) return parsed[eventId];
    }
  } catch {}

  return INITIAL_DEMO_SETTINGS[eventId] || {
    event_id: eventId,
    retention_hours: 120,
    countdown_seconds: 3,
    default_mirror: true,
  };
}

export function saveStoredEventSettings(eventId: string, settings: EventSettings) {
  try {
    const raw = localStorage.getItem(STORAGE_EVENT_SETTINGS_KEY);
    const existing = raw ? JSON.parse(raw) : INITIAL_DEMO_SETTINGS;
    existing[eventId] = settings;
    localStorage.setItem(STORAGE_EVENT_SETTINGS_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('LocalStorage save event settings error:', err);
  }
}

export function getStoredEventFilters(eventId: string): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_EVENT_FILTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed[eventId])) return parsed[eventId];
    }
  } catch {}

  return INITIAL_DEMO_FILTERS[eventId] || [];
}

export function saveStoredEventFilters(eventId: string, filterIds: string[]) {
  try {
    const raw = localStorage.getItem(STORAGE_EVENT_FILTERS_KEY);
    const existing = raw ? JSON.parse(raw) : INITIAL_DEMO_FILTERS;
    existing[eventId] = filterIds;
    localStorage.setItem(STORAGE_EVENT_FILTERS_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('LocalStorage save event filters error:', err);
  }
}

export function getStoredScreenBackgrounds(eventId: string): ScreenBackground[] {
  try {
    const raw = localStorage.getItem(STORAGE_SCREEN_BACKGROUNDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed[eventId]) && parsed[eventId].length > 0) {
        return parsed[eventId];
      }
    }
  } catch {}

  return INITIAL_DEMO_BACKGROUNDS[eventId] || SEED_BACKGROUNDS.map((bg) => ({ ...bg, event_id: eventId }));
}

export function saveStoredScreenBackgrounds(eventId: string, backgrounds: ScreenBackground[]) {
  try {
    const raw = localStorage.getItem(STORAGE_SCREEN_BACKGROUNDS_KEY);
    const existing = raw ? JSON.parse(raw) : INITIAL_DEMO_BACKGROUNDS;
    existing[eventId] = backgrounds;
    localStorage.setItem(STORAGE_SCREEN_BACKGROUNDS_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('LocalStorage save screen backgrounds error:', err);
  }
}

// --------------------------------------------------------------------------
// Utility helpers
// --------------------------------------------------------------------------

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateInitialsPrefix(name: string): string {
  const clean = name.replace(/[^a-zA-Z\s]/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    const firstLetters = words
      .map((w) => w[0])
      .join('')
      .toUpperCase();
    return firstLetters.slice(0, 4);
  } else if (words.length === 1 && words[0].length >= 2) {
    return words[0].slice(0, 3).toUpperCase();
  }
  return 'WED';
}

/**
 * Compresses an image file into WebP data URL on client
 */
export async function compressImageToWebp(file: File, maxDim: number = 1920): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (Math.max(w, h) > maxDim) {
          if (w >= h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/webp', 0.85));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar untuk kompresi'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.readAsDataURL(file);
  });
}

// --------------------------------------------------------------------------
// EventService Implementation
// --------------------------------------------------------------------------

export const EventService = {
  /**
   * Get all events, scoped by admin's allowed_event_ids if restricted
   */
  async getEvents(admin?: AdminProfile | null): Promise<Event[]> {
    let allEvents = getStoredEvents();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          allEvents = data as Event[];
        }
      } catch (e) {
        console.warn('Supabase getEvents fallback:', e);
      }
    }

    // Role-based access control filtering
    if (admin && admin.role === 'team' && admin.allowed_event_ids && admin.allowed_event_ids.length > 0) {
      allEvents = allEvents.filter((ev) => admin.allowed_event_ids!.includes(ev.id));
    }

    return allEvents;
  },

  /**
   * Get single event by ID
   */
  async getEventById(id: string): Promise<Event | null> {
    const events = await this.getEvents();
    return events.find((e) => e.id === id) || null;
  },

  /**
   * Get single event by slug
   */
  async getEventBySlug(slug: string): Promise<Event | null> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('slug', slug)
          .single();

        if (!error && data) return data as Event;
      } catch {}
    }

    const events = getStoredEvents();
    return events.find((e) => e.slug === slug) || null;
  },

  /**
   * Get session count for an event
   */
  async getSessionCount(eventId: string): Promise<number> {
    if (supabase) {
      try {
        const { count, error } = await supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId);

        if (!error && count !== null) return count;
      } catch {}
    }

    try {
      const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
      if (raw) {
        const sessions = JSON.parse(raw);
        const count = Object.values(sessions).filter((s: any) => s.event_id === eventId).length;
        return count;
      }
    } catch {}

    if (eventId === 'evt_khai_lila_2026') return 2;
    if (eventId === 'evt_monika_david') return 42;
    return 0;
  },

  /**
   * Check if slug is unique (case-insensitive)
   */
  async checkSlugUnique(slug: string, currentId?: string): Promise<boolean> {
    const clean = slugify(slug);
    if (!clean) return false;

    const events = getStoredEvents();
    const collision = events.find(
      (e) => e.slug.toLowerCase() === clean.toLowerCase() && e.id !== currentId
    );
    if (collision) return false;

    if (supabase) {
      try {
        let query = supabase.from('events').select('id').eq('slug', clean);
        if (currentId) {
          query = query.neq('id', currentId);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) return false;
      } catch {}
    }

    return true;
  },

  /**
   * Check if code_prefix is unique (case-insensitive)
   */
  async checkPrefixUnique(prefix: string, currentId?: string): Promise<boolean> {
    const clean = prefix.trim().toUpperCase();
    if (!clean || clean.length < 2 || clean.length > 4) return false;

    const events = getStoredEvents();
    const collision = events.find(
      (e) => e.code_prefix.toUpperCase() === clean && e.id !== currentId
    );
    if (collision) return false;

    if (supabase) {
      try {
        let query = supabase.from('events').select('id').eq('code_prefix', clean);
        if (currentId) {
          query = query.neq('id', currentId);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) return false;
      } catch {}
    }

    return true;
  },

  /**
   * Create a new Event with its settings, allowed filters, and 6 screen backgrounds
   */
  async createEvent(
    eventData: Omit<Event, 'id' | 'created_at'>,
    settingsData: Omit<EventSettings, 'event_id'>,
    allowedFilterIds: string[],
    backgroundsData: ScreenBackground[]
  ): Promise<Event> {
    // Validate uniqueness
    const isSlugFree = await this.checkSlugUnique(eventData.slug);
    if (!isSlugFree) {
      throw new Error(`Slug "${eventData.slug}" sudah digunakan oleh acara lain. Silakan pilih slug lain.`);
    }

    const isPrefixFree = await this.checkPrefixUnique(eventData.code_prefix);
    if (!isPrefixFree) {
      throw new Error(`Kode prefix "${eventData.code_prefix}" sudah digunakan oleh acara lain. Kode prefix wajib unik global.`);
    }

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newEvent: Event = {
      ...eventData,
      id: eventId,
      code_prefix: eventData.code_prefix.trim().toUpperCase(),
      slug: slugify(eventData.slug),
      is_active: eventData.status === 'aktif',
      created_at: new Date().toISOString(),
    };

    const newSettings: EventSettings = {
      ...settingsData,
      event_id: eventId,
    };

    const normalizedBackgrounds = backgroundsData.map((bg) => ({
      ...bg,
      event_id: eventId,
    }));

    // 1. Supabase insert if available
    if (supabase) {
      try {
        await supabase.from('events').insert([newEvent]);
        await supabase.from('event_settings').insert([newSettings]);

        if (allowedFilterIds.length > 0) {
          const filterRows = allowedFilterIds.map((fid) => ({
            event_id: eventId,
            filter_id: fid,
          }));
          await supabase.from('event_filters').insert(filterRows);
        }

        if (normalizedBackgrounds.length > 0) {
          await supabase.from('screen_backgrounds').insert(normalizedBackgrounds);
        }
      } catch (e) {
        console.warn('Supabase createEvent insert error:', e);
      }
    }

    // 2. Local storage save
    const currentEvents = getStoredEvents();
    saveStoredEvents([newEvent, ...currentEvents]);
    saveStoredEventSettings(eventId, newSettings);
    saveStoredEventFilters(eventId, allowedFilterIds);
    saveStoredScreenBackgrounds(eventId, normalizedBackgrounds);

    // 3. Record Audit Log
    const currentAdmin = AdminService.getCurrentAdmin();
    if (currentAdmin) {
      await AdminService.recordAuditLog(
        currentAdmin.id,
        currentAdmin.name,
        'event_create',
        `Membuat user acara baru "${newEvent.name}" (Slug: ${newEvent.slug}, Kode Prefix: ${newEvent.code_prefix})`
      );
    }

    return newEvent;
  },

  /**
   * Update existing Event, settings, filters, and backgrounds
   */
  async updateEvent(
    id: string,
    eventData: Partial<Event>,
    settingsData?: Partial<EventSettings>,
    allowedFilterIds?: string[],
    backgroundsData?: ScreenBackground[]
  ): Promise<Event> {
    const events = getStoredEvents();
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Acara tidak ditemukan');

    const existing = events[idx];

    // Check slug uniqueness if changed
    if (eventData.slug && eventData.slug !== existing.slug) {
      const isSlugFree = await this.checkSlugUnique(eventData.slug, id);
      if (!isSlugFree) {
        throw new Error(`Slug "${eventData.slug}" sudah digunakan acara lain`);
      }
    }

    // Check prefix uniqueness if changed
    if (eventData.code_prefix && eventData.code_prefix !== existing.code_prefix) {
      const isPrefixFree = await this.checkPrefixUnique(eventData.code_prefix, id);
      if (!isPrefixFree) {
        throw new Error(`Kode prefix "${eventData.code_prefix}" sudah digunakan acara lain`);
      }
    }

    const updatedEvent: Event = {
      ...existing,
      ...eventData,
      slug: eventData.slug ? slugify(eventData.slug) : existing.slug,
      code_prefix: eventData.code_prefix ? eventData.code_prefix.trim().toUpperCase() : existing.code_prefix,
      is_active: eventData.status ? eventData.status === 'aktif' : existing.is_active,
    };

    events[idx] = updatedEvent;
    saveStoredEvents(events);

    if (settingsData) {
      const currentSettings = getStoredEventSettings(id);
      saveStoredEventSettings(id, { ...currentSettings, ...settingsData });
    }

    if (allowedFilterIds !== undefined) {
      saveStoredEventFilters(id, allowedFilterIds);
    }

    if (backgroundsData) {
      saveStoredScreenBackgrounds(id, backgroundsData);
    }

    if (supabase) {
      try {
        await supabase.from('events').update(eventData).eq('id', id);
        if (settingsData) {
          await supabase.from('event_settings').update(settingsData).eq('event_id', id);
        }
        if (allowedFilterIds !== undefined) {
          await supabase.from('event_filters').delete().eq('event_id', id);
          if (allowedFilterIds.length > 0) {
            await supabase.from('event_filters').insert(
              allowedFilterIds.map((fid) => ({ event_id: id, filter_id: fid }))
            );
          }
        }
        if (backgroundsData && backgroundsData.length > 0) {
          for (const bg of backgroundsData) {
            await supabase.from('screen_backgrounds').upsert({
              event_id: id,
              screen_key: bg.screen_key,
              media_url: bg.media_url,
              media_type: bg.media_type,
              blur_px: bg.blur_px,
              overlay_opacity: bg.overlay_opacity,
            });
          }
        }
      } catch (e) {
        console.warn('Supabase updateEvent error:', e);
      }
    }

    const currentAdmin = AdminService.getCurrentAdmin();
    if (currentAdmin) {
      await AdminService.recordAuditLog(
        currentAdmin.id,
        currentAdmin.name,
        'event_update',
        `Memperbarui data acara "${updatedEvent.name}"`
      );
    }

    return updatedEvent;
  },

  /**
   * Hard Delete an Event with strict confirmation (user must type event name)
   */
  async deleteEvent(id: string, confirmationName: string): Promise<void> {
    const events = getStoredEvents();
    const target = events.find((e) => e.id === id);
    if (!target) throw new Error('Acara tidak ditemukan');

    if (confirmationName.trim() !== target.name.trim()) {
      throw new Error(`Nama konfirmasi tidak cocok. Harap ketik "${target.name}" secara tepat.`);
    }

    // Remove from local storage
    const updated = events.filter((e) => e.id !== id);
    saveStoredEvents(updated);

    // Remove settings & backgrounds
    try {
      const rawSettings = localStorage.getItem(STORAGE_EVENT_SETTINGS_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        delete parsed[id];
        localStorage.setItem(STORAGE_EVENT_SETTINGS_KEY, JSON.stringify(parsed));
      }
    } catch {}

    try {
      const rawBgs = localStorage.getItem(STORAGE_SCREEN_BACKGROUNDS_KEY);
      if (rawBgs) {
        const parsed = JSON.parse(rawBgs);
        delete parsed[id];
        localStorage.setItem(STORAGE_SCREEN_BACKGROUNDS_KEY, JSON.stringify(parsed));
      }
    } catch {}

    // Supabase cascade deletion
    if (supabase) {
      try {
        await supabase.from('events').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase deleteEvent error:', e);
      }
    }

    const currentAdmin = AdminService.getCurrentAdmin();
    if (currentAdmin) {
      await AdminService.recordAuditLog(
        currentAdmin.id,
        currentAdmin.name,
        'event_delete',
        `Menghapus user acara "${target.name}" beserta pengaturan dan background-nya`
      );
    }
  },

  /**
   * Generate default screen backgrounds for a newly created event
   */
  getDefaultBackgrounds(eventId: string, initialMediaUrl?: string): ScreenBackground[] {
    const defaultUrl =
      initialMediaUrl ||
      'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80';

    const keys: ScreenKey[] = ['landing', 'howto', 'frame', 'camera', 'filter', 'result'];
    return keys.map((key) => ({
      event_id: eventId,
      screen_key: key,
      media_url: defaultUrl,
      media_type: 'image',
      blur_px: key === 'landing' ? 0 : 8,
      overlay_opacity: key === 'landing' ? 0.40 : 0.60,
    }));
  },

  getStoredEventFilters,
  saveStoredEventFilters,
  getStoredScreenBackgrounds,
  saveStoredScreenBackgrounds,
  getStoredEventSettings,
  saveStoredEventSettings,
};
