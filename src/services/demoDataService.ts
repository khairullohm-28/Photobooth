/**
 * Demo Data Service: Generates and purges sample wedding event, 30 demo sessions,
 * placeholder photo assets, and print jobs for testing Booking and Dashboard.
 * All records are marked with is_demo: true.
 */

import { supabase, getStoredAnalytics, saveStoredAnalytics } from './supabase';
import { Event, Session, SessionAsset, PrintJob, AnalyticsEvent } from '../types/photobooth';
import { getStoredEvents, saveStoredEvents, EventService } from './eventService';
import { getStoredPrintJobs, saveStoredPrintJobs } from './printerService';

const STORAGE_SESSIONS_KEY = 'wedding_pb_sessions';
const STORAGE_ASSETS_KEY = 'wedding_pb_assets';
const STORAGE_COUNTERS_KEY = 'wedding_pb_counters';

export const DEMO_EVENT_ID = 'evt_demo_wedding';
export const DEMO_EVENT_SLUG = 'demo-wedding';

/**
 * Creates high-quality SVG data URL for demo photo frame result
 */
function createPlaceholderFrameSvg(sessionCode: string, index: number): string {
  const hues = [210, 330, 45, 160, 280, 20];
  const hue = hues[index % hues.length];
  const bg1 = `hsl(${hue}, 40%, 25%)`;
  const bg2 = `hsl(${hue}, 30%, 15%)`;
  const gold = '#d4af37';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${bg1}" />
          <stop offset="100%" stop-color="${bg2}" />
        </linearGradient>
      </defs>
      <rect width="600" height="900" fill="url(#bgGrad)" />
      <rect x="20" y="20" width="560" height="860" fill="none" stroke="${gold}" stroke-width="3" />
      <rect x="30" y="30" width="540" height="840" fill="none" stroke="${gold}" stroke-width="1" opacity="0.6" />
      
      <!-- Slot 1 -->
      <rect x="60" y="70" width="480" height="320" rx="8" fill="#ffffff" opacity="0.9" />
      <circle cx="300" cy="200" r="45" fill="#f59e0b" opacity="0.8" />
      <path d="M 230 350 Q 300 240 370 350 Z" fill="#1c1917" opacity="0.75" />
      <text x="300" y="380" font-family="serif" font-size="14" fill="#666" text-anchor="middle">Sample Pose 1</text>
      
      <!-- Slot 2 -->
      <rect x="60" y="410" width="480" height="320" rx="8" fill="#ffffff" opacity="0.9" />
      <circle cx="280" cy="540" r="40" fill="#ec4899" opacity="0.8" />
      <circle cx="330" cy="545" r="35" fill="#3b82f6" opacity="0.8" />
      <path d="M 220 690 Q 280 580 340 690 Z" fill="#1c1917" opacity="0.7" />
      <path d="M 290 690 Q 340 590 390 690 Z" fill="#1c1917" opacity="0.7" />
      <text x="300" y="720" font-family="serif" font-size="14" fill="#666" text-anchor="middle">Sample Pose 2</text>
      
      <!-- Bottom Branding -->
      <text x="300" y="780" font-family="'Libre Baskerville', serif" font-weight="bold" font-size="24" fill="${gold}" text-anchor="middle" letter-spacing="2">DEWI &amp; RAMA</text>
      <text x="300" y="805" font-family="sans-serif" font-size="12" fill="#e5e5e5" text-anchor="middle" letter-spacing="1">10 DESEMBER 2026 • PHOTOBOOTH</text>
      
      <!-- Code Badge -->
      <rect x="220" y="825" width="160" height="32" rx="6" fill="#111111" stroke="${gold}" stroke-width="1.5" />
      <text x="300" y="847" font-family="monospace" font-weight="bold" font-size="16" fill="#ffffff" text-anchor="middle" letter-spacing="2">${sessionCode}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DemoDataService = {
  /**
   * Check if demo data currently exists
   */
  async checkHasDemoData(): Promise<boolean> {
    try {
      const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
      if (raw) {
        const sessions: Record<string, Session> = JSON.parse(raw);
        const has = Object.values(sessions).some((s) => s.is_demo);
        if (has) return true;
      }
    } catch {}

    const events = getStoredEvents();
    if (events.some((e) => e.is_demo && e.id === DEMO_EVENT_ID)) {
      return true;
    }

    if (supabase) {
      try {
        const { count } = await supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .eq('is_demo', true);
        if (count && count > 0) return true;
      } catch {}
    }

    return false;
  },

  /**
   * Generates 1 demo wedding event + 30 demo sessions + realistic assets + print jobs
   */
  async generateDemoData(): Promise<{ success: boolean; sessionCount: number }> {
    const demoEvent: Event = {
      id: DEMO_EVENT_ID,
      name: 'Demo Wedding Dewi & Rama',
      slug: DEMO_EVENT_SLUG,
      code_prefix: 'DMW',
      event_date: '10 Desember 2026',
      couple_names: 'Dewi & Rama',
      quote_text: 'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan hidup untukmu agar kamu merasa tenteram.',
      quote_source: 'QS. Ar-Rum: 21',
      template_category_id: 'cat_khai_lila',
      status: 'aktif',
      is_demo: true,
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    };

    // 1. Save or update demo event
    const events = getStoredEvents();
    const existingEvtIdx = events.findIndex((e) => e.id === DEMO_EVENT_ID);
    if (existingEvtIdx >= 0) {
      events[existingEvtIdx] = demoEvent;
    } else {
      events.push(demoEvent);
    }
    saveStoredEvents(events);

    if (supabase) {
      try {
        await supabase.from('events').upsert(demoEvent);
      } catch {}
    }

    // 2. Generate 30 sessions
    const createdSessions: Record<string, Session> = {};
    const createdAssets: Record<string, SessionAsset[]> = {};
    const createdJobs: PrintJob[] = [];

    const now = Date.now();
    const printOperators = ['operator', 'budi_booth', 'siti_print'];

    for (let i = 1; i <= 30; i++) {
      const numStr = i.toString().padStart(4, '0');
      const sessionCode = `DMW-${numStr}`;
      const sessionId = `sess_demo_dmw_${i}`;

      // Spread created_at across last 72 hours
      const hoursAgo = Math.max(0.5, (30 - i) * 2.3);
      const createdAt = new Date(now - hoursAgo * 3600 * 1000).toISOString();
      const expiresAt = new Date(new Date(createdAt).getTime() + 120 * 3600 * 1000).toISOString();

      // Determine printed count (mix of 0, 1, 2 copies)
      let printedCount = 0;
      if (i % 5 === 0) printedCount = 2;
      else if (i % 2 === 0) printedCount = 1;

      const session: Session = {
        id: sessionId,
        event_id: DEMO_EVENT_ID,
        session_code: sessionCode,
        frame_id: i % 2 === 0 ? 'frm_strip_3' : 'frm_grid_4',
        filter_id: i % 3 === 0 ? 'flt_classic_bw' : i % 2 === 0 ? 'flt_warm_vintage' : 'flt_normal',
        mirror: true,
        status: 'aktif',
        printed_count: printedCount,
        files_deleted_at: null,
        is_demo: true,
        created_at: createdAt,
        expires_at: expiresAt,
      };

      createdSessions[sessionId] = session;

      // Create realistic photo assets
      const frameUrl = createPlaceholderFrameSvg(sessionCode, i);
      const assetsForSession: SessionAsset[] = [
        {
          id: `ast_frm_${sessionId}`,
          session_id: sessionId,
          type: 'frame_result',
          url: frameUrl,
          created_at: createdAt,
        },
        {
          id: `ast_raw1_${sessionId}`,
          session_id: sessionId,
          type: 'raw_photo',
          url: frameUrl,
          shot_index: 1,
          created_at: createdAt,
        },
        {
          id: `ast_raw2_${sessionId}`,
          session_id: sessionId,
          type: 'raw_photo',
          url: frameUrl,
          shot_index: 2,
          created_at: createdAt,
        },
      ];

      createdAssets[sessionId] = assetsForSession;

      // If printed, create matching print job record
      if (printedCount > 0) {
        const jobCreatedAt = new Date(new Date(createdAt).getTime() + 10 * 60 * 1000).toISOString();
        createdJobs.push({
          id: `pjob_demo_${sessionId}`,
          session_id: sessionId,
          profile_id: 'prf_dnp_4r',
          copies: printedCount,
          printed_by: printOperators[i % printOperators.length],
          printed_at: jobCreatedAt,
          session_code: sessionCode,
          event_id: DEMO_EVENT_ID,
          event_name: demoEvent.name,
          profile_name: 'DNP DS620 / Citizen CY - 4R',
        });
      }
    }

    // Generate realistic demo analytics events
    const demoAnalytics: AnalyticsEvent[] = [];
    const devices = ['iOS', 'iOS', 'iOS', 'Android', 'Android', 'Other'];
    const cameras = ['user', 'user', 'user', 'user', 'environment'];

    for (let k = 1; k <= 48; k++) {
      const hoursAgo = Math.max(0.2, (48 - k) * 1.5);
      const evtTime = new Date(now - hoursAgo * 3600 * 1000).toISOString();
      const dev = devices[k % devices.length];
      const cam = cameras[k % cameras.length];

      // start
      demoAnalytics.push({
        id: `ae_demo_start_${k}`,
        event_id: DEMO_EVENT_ID,
        step: 'start',
        device_os: dev,
        camera_facing: cam,
        created_at: evtTime,
      });

      // frame (41 completed)
      if (k <= 41) {
        demoAnalytics.push({
          id: `ae_demo_frame_${k}`,
          event_id: DEMO_EVENT_ID,
          step: 'frame',
          device_os: dev,
          camera_facing: cam,
          created_at: new Date(new Date(evtTime).getTime() + 15000).toISOString(),
        });
      }

      // photos_done (36 completed)
      if (k <= 36) {
        demoAnalytics.push({
          id: `ae_demo_photos_${k}`,
          event_id: DEMO_EVENT_ID,
          step: 'photos_done',
          device_os: dev,
          camera_facing: cam,
          created_at: new Date(new Date(evtTime).getTime() + 45000).toISOString(),
        });
      }

      // filter (30 completed)
      if (k <= 30) {
        demoAnalytics.push({
          id: `ae_demo_filter_${k}`,
          event_id: DEMO_EVENT_ID,
          session_id: `sess_demo_dmw_${k}`,
          step: 'filter',
          device_os: dev,
          camera_facing: cam,
          created_at: new Date(new Date(evtTime).getTime() + 65000).toISOString(),
        });
      }

      // download (26 completed)
      if (k <= 26) {
        demoAnalytics.push({
          id: `ae_demo_download_${k}`,
          event_id: DEMO_EVENT_ID,
          session_id: `sess_demo_dmw_${k}`,
          step: 'download',
          device_os: dev,
          camera_facing: cam,
          created_at: new Date(new Date(evtTime).getTime() + 90000).toISOString(),
        });
      }
    }

    // Save to local storage
    try {
      const rawSess = localStorage.getItem(STORAGE_SESSIONS_KEY);
      const existingSess = rawSess ? JSON.parse(rawSess) : {};
      localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify({ ...existingSess, ...createdSessions }));

      const rawAst = localStorage.getItem(STORAGE_ASSETS_KEY);
      const existingAst = rawAst ? JSON.parse(rawAst) : {};
      localStorage.setItem(STORAGE_ASSETS_KEY, JSON.stringify({ ...existingAst, ...createdAssets }));

      const existingJobs = getStoredPrintJobs();
      const nonDemoJobs = existingJobs.filter((j) => !j.id.startsWith('pjob_demo_'));
      saveStoredPrintJobs([...createdJobs, ...nonDemoJobs]);

      // Save analytics
      const existingAnalytics = getStoredAnalytics().filter((a) => a.event_id !== DEMO_EVENT_ID);
      saveStoredAnalytics([...existingAnalytics, ...demoAnalytics]);

      // Set counter
      const rawCounters = localStorage.getItem(STORAGE_COUNTERS_KEY);
      const counters = rawCounters ? JSON.parse(rawCounters) : {};
      counters[DEMO_EVENT_ID] = 30;
      localStorage.setItem(STORAGE_COUNTERS_KEY, JSON.stringify(counters));
    } catch (err) {
      console.warn('LocalStorage save demo data issue:', err);
    }

    // Persist to Supabase if connected
    if (supabase) {
      try {
        const sessionRows = Object.values(createdSessions);
        await supabase.from('sessions').upsert(sessionRows);

        const assetRows = Object.values(createdAssets).flat();
        await supabase.from('session_assets').upsert(assetRows);

        await supabase.from('print_jobs').upsert(createdJobs);

        await supabase.from('analytics_events').upsert(demoAnalytics);
      } catch (e) {
        console.warn('Supabase demo data insert notice:', e);
      }
    }

    return { success: true, sessionCount: 30 };
  },

  /**
   * Purges all sample data with is_demo: true
   */
  async purgeDemoData(): Promise<{ success: boolean; removedCount: number }> {
    let removedCount = 0;

    try {
      const rawSess = localStorage.getItem(STORAGE_SESSIONS_KEY);
      if (rawSess) {
        const sessions: Record<string, Session> = JSON.parse(rawSess);
        const filteredSess: Record<string, Session> = {};
        for (const [id, s] of Object.entries(sessions)) {
          if (s.is_demo || s.event_id === DEMO_EVENT_ID) {
            removedCount++;
          } else {
            filteredSess[id] = s;
          }
        }
        localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(filteredSess));
      }

      const rawAst = localStorage.getItem(STORAGE_ASSETS_KEY);
      if (rawAst) {
        const assets: Record<string, SessionAsset[]> = JSON.parse(rawAst);
        const filteredAst: Record<string, SessionAsset[]> = {};
        for (const [id, astList] of Object.entries(assets)) {
          if (!id.startsWith('sess_demo_dmw_')) {
            filteredAst[id] = astList;
          }
        }
        localStorage.setItem(STORAGE_ASSETS_KEY, JSON.stringify(filteredAst));
      }

      // Purge demo print jobs
      const jobs = getStoredPrintJobs();
      const cleanJobs = jobs.filter(
        (j) => !j.id.startsWith('pjob_demo_') && j.event_id !== DEMO_EVENT_ID
      );
      saveStoredPrintJobs(cleanJobs);

      // Purge demo analytics
      const cleanAnalytics = getStoredAnalytics().filter((a) => a.event_id !== DEMO_EVENT_ID);
      saveStoredAnalytics(cleanAnalytics);

      // Purge demo event
      const events = getStoredEvents().filter((e) => e.id !== DEMO_EVENT_ID);
      saveStoredEvents(events);
    } catch (err) {
      console.warn('LocalStorage purge demo data issue:', err);
    }

    if (supabase) {
      try {
        await supabase.from('sessions').delete().eq('is_demo', true);
        await supabase.from('analytics_events').delete().eq('event_id', DEMO_EVENT_ID);
        await supabase.from('events').delete().eq('id', DEMO_EVENT_ID);
      } catch (e) {
        console.warn('Supabase purge demo data notice:', e);
      }
    }

    return { success: true, removedCount };
  },
};
