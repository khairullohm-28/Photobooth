/**
 * Printer Service: Manages print profiles, paper presets, calibration test prints,
 * print jobs recording, and hidden iframe document printing.
 */

import { supabase } from './supabase';
import {
  PrintProfile,
  PrintJob,
  PrintPreset,
  PrintFitMode,
  PrintOrientation,
} from '../types/photobooth';

export const PRESET_DIMENSIONS: Record<
  PrintPreset,
  { label: string; width_mm: number; height_mm: number }
> = {
  '4r': { label: '4R (102 x 152 mm / 4x6 inci)', width_mm: 102, height_mm: 152 },
  '5r': { label: '5R (127 x 178 mm / 5x7 inci)', width_mm: 127, height_mm: 178 },
  'a6': { label: 'A6 (105 x 148 mm)', width_mm: 105, height_mm: 148 },
  'a5': { label: 'A5 (148 x 210 mm)', width_mm: 148, height_mm: 210 },
  'a4': { label: 'A4 (210 x 297 mm)', width_mm: 210, height_mm: 297 },
  'strip_2x6': { label: 'Strip 2x6 (51 x 152 mm / 2x6 inci)', width_mm: 51, height_mm: 152 },
  'custom': { label: 'Ukuran Kustom (mm)', width_mm: 102, height_mm: 152 },
};

export const INITIAL_PROFILES: PrintProfile[] = [
  {
    id: 'prf_dnp_4r',
    name: 'DNP DS620 / Citizen CY - 4R (102x152mm)',
    paper_preset: '4r',
    paper_width_mm: 102,
    paper_height_mm: 152,
    orientation: 'portrait',
    margin_top_mm: 0,
    margin_right_mm: 0,
    margin_bottom_mm: 0,
    margin_left_mm: 0,
    fit_mode: 'fill',
    is_default: true,
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: 'prf_epson_strip',
    name: 'Epson L805 - Strip 2x6 (51x152mm)',
    paper_preset: 'strip_2x6',
    paper_width_mm: 51,
    paper_height_mm: 152,
    orientation: 'portrait',
    margin_top_mm: 2,
    margin_right_mm: 2,
    margin_bottom_mm: 2,
    margin_left_mm: 2,
    fit_mode: 'fit',
    is_default: false,
    created_at: new Date(Date.now() - 86400000 * 25).toISOString(),
  },
  {
    id: 'prf_canon_selphy',
    name: 'Canon Selphy CP1500 - Postcard 4R',
    paper_preset: '4r',
    paper_width_mm: 100,
    paper_height_mm: 148,
    orientation: 'portrait',
    margin_top_mm: 3,
    margin_right_mm: 3,
    margin_bottom_mm: 3,
    margin_left_mm: 3,
    fit_mode: 'fill',
    is_default: false,
    created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
  {
    id: 'prf_a5_glossy',
    name: 'A5 Glossy Photo Paper (148x210mm)',
    paper_preset: 'a5',
    paper_width_mm: 148,
    paper_height_mm: 210,
    orientation: 'portrait',
    margin_top_mm: 4,
    margin_right_mm: 4,
    margin_bottom_mm: 4,
    margin_left_mm: 4,
    fit_mode: 'fit',
    is_default: false,
    created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: 'prf_a4_standard',
    name: 'A4 Studio Standard (210x297mm)',
    paper_preset: 'a4',
    paper_width_mm: 210,
    paper_height_mm: 297,
    orientation: 'portrait',
    margin_top_mm: 5,
    margin_right_mm: 5,
    margin_bottom_mm: 5,
    margin_left_mm: 5,
    fit_mode: 'fit',
    is_default: false,
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
];

const STORAGE_PRINT_PROFILES_KEY = 'wedding_pb_print_profiles';
const STORAGE_PRINT_JOBS_KEY = 'wedding_pb_print_jobs';

function getStoredProfiles(): PrintProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_PRINT_PROFILES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return INITIAL_PROFILES;
}

function saveStoredProfiles(profiles: PrintProfile[]) {
  try {
    localStorage.setItem(STORAGE_PRINT_PROFILES_KEY, JSON.stringify(profiles));
  } catch (err) {
    console.warn('LocalStorage save profiles error:', err);
  }
}

export function getStoredPrintJobs(): PrintJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_PRINT_JOBS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveStoredPrintJobs(jobs: PrintJob[]) {
  try {
    localStorage.setItem(STORAGE_PRINT_JOBS_KEY, JSON.stringify(jobs));
  } catch (err) {
    console.warn('LocalStorage save print jobs error:', err);
  }
}

export const PrinterService = {
  /**
   * Get all print profiles
   */
  async getProfiles(): Promise<PrintProfile[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('print_profiles')
          .select('*')
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as PrintProfile[];
        }
      } catch (e) {
        console.warn('Supabase getProfiles fallback:', e);
      }
    }

    return getStoredProfiles();
  },

  /**
   * Get single profile by ID
   */
  async getProfileById(id: string): Promise<PrintProfile | null> {
    const profiles = await this.getProfiles();
    return profiles.find((p) => p.id === id) || null;
  },

  /**
   * Get default printer profile
   */
  async getDefaultProfile(): Promise<PrintProfile> {
    const profiles = await this.getProfiles();
    return profiles.find((p) => p.is_default) || profiles[0] || INITIAL_PROFILES[0];
  },

  /**
   * Create or update profile
   */
  async saveProfile(
    profile: Omit<PrintProfile, 'id' | 'created_at'> & { id?: string }
  ): Promise<PrintProfile> {
    const profiles = await this.getProfiles();
    const isNew = !profile.id;
    const profileId = profile.id || `prf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // If marked default, unmark other profiles
    const updatedProfiles = profiles.map((p) => ({
      ...p,
      is_default: profile.is_default ? p.id === profileId : p.is_default,
    }));

    const savedRecord: PrintProfile = {
      ...profile,
      id: profileId,
      created_at: isNew ? new Date().toISOString() : undefined,
    };

    const existingIndex = updatedProfiles.findIndex((p) => p.id === profileId);
    if (existingIndex >= 0) {
      updatedProfiles[existingIndex] = {
        ...updatedProfiles[existingIndex],
        ...savedRecord,
      };
    } else {
      updatedProfiles.push(savedRecord);
    }

    // Ensure at least one profile is default
    const hasDefault = updatedProfiles.some((p) => p.is_default);
    if (!hasDefault && updatedProfiles.length > 0) {
      updatedProfiles[0].is_default = true;
    }

    saveStoredProfiles(updatedProfiles);

    if (supabase) {
      try {
        if (profile.is_default) {
          await supabase.from('print_profiles').update({ is_default: false }).neq('id', profileId);
        }
        await supabase.from('print_profiles').upsert(savedRecord);
      } catch (e) {
        console.warn('Supabase saveProfile notice:', e);
      }
    }

    return savedRecord;
  },

  /**
   * Delete profile
   */
  async deleteProfile(id: string): Promise<{ success: boolean; error?: string }> {
    const profiles = await this.getProfiles();
    if (profiles.length <= 1) {
      return { success: false, error: 'Minimal harus ada 1 profil printer yang tersimpan' };
    }

    const target = profiles.find((p) => p.id === id);
    if (!target) return { success: false, error: 'Profil tidak ditemukan' };

    const remaining = profiles.filter((p) => p.id !== id);
    if (target.is_default && remaining.length > 0) {
      remaining[0].is_default = true;
    }

    saveStoredProfiles(remaining);

    if (supabase) {
      try {
        await supabase.from('print_profiles').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase deleteProfile notice:', e);
      }
    }

    return { success: true };
  },

  /**
   * Set specific profile as default
   */
  async setDefaultProfile(id: string): Promise<void> {
    const profiles = await this.getProfiles();
    const updated = profiles.map((p) => ({
      ...p,
      is_default: p.id === id,
    }));
    saveStoredProfiles(updated);

    if (supabase) {
      try {
        await supabase.from('print_profiles').update({ is_default: false }).neq('id', id);
        await supabase.from('print_profiles').update({ is_default: true }).eq('id', id);
      } catch (e) {
        console.warn('Supabase setDefaultProfile notice:', e);
      }
    }
  },

  /**
   * Record a print job and increment session's printed_count
   */
  async recordPrintJob(
    sessionId: string,
    copies: number,
    profileId?: string,
    printedBy?: string
  ): Promise<PrintJob> {
    const job: PrintJob = {
      id: `pjob_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      session_id: sessionId,
      profile_id: profileId,
      copies: Math.max(1, copies),
      printed_by: printedBy || 'operator',
      printed_at: new Date().toISOString(),
    };

    // 1. Store print job locally
    const jobs = getStoredPrintJobs();
    jobs.unshift(job);
    if (jobs.length > 500) jobs.pop();
    saveStoredPrintJobs(jobs);

    // 2. Persist to Supabase if connected
    if (supabase) {
      try {
        await supabase.from('print_jobs').insert(job);
      } catch (err) {
        console.warn('Supabase print_jobs insert notice:', err);
      }
    }

    return job;
  },

  /**
   * Retrieve print history with optional filters
   */
  async getPrintHistory(filters?: {
    event_id?: string;
    searchQuery?: string;
    date?: string;
  }): Promise<PrintJob[]> {
    let jobs: PrintJob[] = [];

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('print_jobs')
          .select(`
            id, session_id, profile_id, copies, printed_by, printed_at,
            sessions ( session_code, event_id, events ( name ) ),
            print_profiles ( name )
          `)
          .order('printed_at', { ascending: false })
          .limit(200);

        if (!error && data) {
          jobs = data.map((d: any) => ({
            id: d.id,
            session_id: d.session_id,
            profile_id: d.profile_id,
            copies: d.copies,
            printed_by: d.printed_by,
            printed_at: d.printed_at,
            session_code: d.sessions?.session_code,
            event_id: d.sessions?.event_id,
            event_name: d.sessions?.events?.name,
            profile_name: d.print_profiles?.name,
          }));
        }
      } catch (e) {
        console.warn('Supabase getPrintHistory fallback:', e);
      }
    }

    if (jobs.length === 0) {
      jobs = getStoredPrintJobs();
    }

    // Apply in-memory filters
    if (filters) {
      if (filters.event_id && filters.event_id !== 'all') {
        jobs = jobs.filter((j) => j.event_id === filters.event_id);
      }
      if (filters.date) {
        jobs = jobs.filter((j) => j.printed_at.startsWith(filters.date!));
      }
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase().trim();
        jobs = jobs.filter(
          (j) =>
            (j.session_code && j.session_code.toLowerCase().includes(q)) ||
            (j.event_name && j.event_name.toLowerCase().includes(q)) ||
            (j.printed_by && j.printed_by.toLowerCase().includes(q)) ||
            (j.profile_name && j.profile_name.toLowerCase().includes(q))
        );
      }
    }

    return jobs;
  },

  /**
   * Core Print Engine:
   * Uses hidden iframe with @page CSS size, orientation, and margins.
   */
  async printImage(
    imageUrl: string,
    profile: PrintProfile,
    options: {
      copies?: number;
      printCodeFooter?: boolean;
      sessionCode?: string;
    } = {}
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const copies = Math.max(1, options.copies || 1);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        resolve(false);
        return;
      }

      const fitCss =
        profile.fit_mode === 'fit'
          ? 'contain'
          : profile.fit_mode === 'fill'
          ? 'cover'
          : 'none';

      // Repeat images according to copies
      let pagesHtml = '';
      for (let i = 0; i < copies; i++) {
        pagesHtml += `
          <div class="print-page">
            <img src="${imageUrl}" alt="Print Job" />
            ${
              options.printCodeFooter && options.sessionCode
                ? `<div class="code-badge">${options.sessionCode}</div>`
                : ''
            }
          </div>
        `;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Wedding Photobooth - Print</title>
          <style>
            @page {
              size: ${profile.paper_width_mm}mm ${profile.paper_height_mm}mm ${profile.orientation};
              margin: ${profile.margin_top_mm}mm ${profile.margin_right_mm}mm ${profile.margin_bottom_mm}mm ${profile.margin_left_mm}mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-page {
              width: 100%;
              height: 100vh;
              page-break-after: always;
              position: relative;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .print-page:last-child {
              page-break-after: avoid;
            }
            img {
              width: 100%;
              height: 100%;
              object-fit: ${fitCss};
              display: block;
            }
            .code-badge {
              position: absolute;
              bottom: 1.5mm;
              right: 2mm;
              background: rgba(255, 255, 255, 0.85);
              border: 0.5px solid #666;
              padding: 1px 4px;
              font-family: monospace;
              font-size: 7pt;
              font-weight: bold;
              color: #111;
              letter-spacing: 0.5px;
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
        </body>
        </html>
      `);
      doc.close();

      const triggerPrint = () => {
        try {
          iframe.contentWindow?.focus();
          let resolved = false;

          const finish = () => {
            if (!resolved) {
              resolved = true;
              setTimeout(() => {
                try {
                  document.body.removeChild(iframe);
                } catch {}
                resolve(true);
              }, 600);
            }
          };

          if (iframe.contentWindow) {
            iframe.contentWindow.onafterprint = finish;
          }

          iframe.contentWindow?.print();

          // Fallback timer if onafterprint does not fire
          setTimeout(finish, 4000);
        } catch (err) {
          console.warn('Iframe print error:', err);
          try {
            document.body.removeChild(iframe);
          } catch {}
          resolve(false);
        }
      };

      // Ensure images are loaded before printing
      const img = doc.querySelector('img');
      if (img) {
        if (img.complete) {
          setTimeout(triggerPrint, 250);
        } else {
          img.onload = () => setTimeout(triggerPrint, 250);
          img.onerror = () => triggerPrint();
        }
      } else {
        triggerPrint();
      }
    });
  },

  /**
   * Generates Calibration Test Print Page:
   * Features mm grid ruler, boundary lines, profile specs, and center crosshair.
   */
  async printCalibrationTestPage(profile: PrintProfile): Promise<boolean> {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        resolve(false);
        return;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Kalibrasi Printer - ${profile.name}</title>
          <style>
            @page {
              size: ${profile.paper_width_mm}mm ${profile.paper_height_mm}mm ${profile.orientation};
              margin: ${profile.margin_top_mm}mm ${profile.margin_right_mm}mm ${profile.margin_bottom_mm}mm ${profile.margin_left_mm}mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #111;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              width: 100%;
              height: 100vh;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .calibration-box {
              width: 100%;
              height: 100%;
              border: 2px solid #000;
              position: relative;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              padding: 4mm;
              background: 
                linear-gradient(to right, #eee 1px, transparent 1px) 0 0 / 10mm 10mm,
                linear-gradient(to bottom, #eee 1px, transparent 1px) 0 0 / 10mm 10mm;
            }
            .corner-mark {
              position: absolute;
              width: 10mm;
              height: 10mm;
              border-color: #000;
              border-style: solid;
            }
            .top-left { top: 0; left: 0; border-width: 3px 0 0 3px; }
            .top-right { top: 0; right: 0; border-width: 3px 3px 0 0; }
            .bottom-left { bottom: 0; left: 0; border-width: 0 0 3px 3px; }
            .bottom-right { bottom: 0; right: 0; border-width: 0 3px 3px 0; }
            
            .center-crosshair {
              position: absolute;
              top: 50%;
              left: 50%;
              width: 20mm;
              height: 20mm;
              transform: translate(-50%, -50%);
              border: 1px dashed #666;
              border-radius: 50%;
            }
            .center-crosshair::before {
              content: '';
              position: absolute;
              top: 0; left: 50%; width: 1px; height: 100%;
              background: #000;
            }
            .center-crosshair::after {
              content: '';
              position: absolute;
              top: 50%; left: 0; width: 100%; height: 1px;
              background: #000;
            }

            .info-header {
              text-align: center;
              z-index: 2;
            }
            .title {
              font-size: 11pt;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .subtitle {
              font-size: 8pt;
              color: #444;
              margin-top: 1mm;
            }
            .ruler-h {
              width: 100%;
              height: 6mm;
              border-top: 1px solid #000;
              border-bottom: 1px solid #000;
              background: #fafafa;
              font-size: 6pt;
              font-family: monospace;
              display: flex;
              align-items: flex-end;
              justify-content: space-between;
              padding: 0 2mm;
            }
            .specs-card {
              background: rgba(255, 255, 255, 0.95);
              border: 1px solid #000;
              padding: 2mm 4mm;
              font-size: 7.5pt;
              z-index: 2;
              margin: 0 auto;
              text-align: center;
              max-width: 85%;
              box-shadow: 2px 2px 0px rgba(0,0,0,0.8);
            }
            .footer-note {
              font-size: 6.5pt;
              color: #555;
              text-align: center;
              z-index: 2;
            }
          </style>
        </head>
        <body>
          <div class="calibration-box">
            <div class="corner-mark top-left"></div>
            <div class="corner-mark top-right"></div>
            <div class="corner-mark bottom-left"></div>
            <div class="corner-mark bottom-right"></div>
            <div class="center-crosshair"></div>

            <div class="info-header">
              <div class="title">LEMBAR KALIBRASI CETAK PHOTOBOOTH</div>
              <div class="subtitle">Verifikasi Garis Tepi, Skala Ukuran, dan Alignment Printer</div>
            </div>

            <div class="ruler-h">
              <span>| 0 cm</span>
              <span>2 cm</span>
              <span>4 cm</span>
              <span>6 cm</span>
              <span>8 cm</span>
              <span>10 cm</span>
              <span>12 cm</span>
              <span>14 cm |</span>
            </div>

            <div class="specs-card">
              <strong>PROFIL:</strong> ${profile.name}<br/>
              <strong>UKURAN KERTAS:</strong> ${profile.paper_width_mm} x ${profile.paper_height_mm} mm (${profile.paper_preset.toUpperCase()})<br/>
              <strong>ORIENTASI:</strong> ${profile.orientation.toUpperCase()} &nbsp;|&nbsp; <strong>FIT MODE:</strong> ${profile.fit_mode.toUpperCase()}<br/>
              <strong>MARGIN (T/R/B/L):</strong> ${profile.margin_top_mm} / ${profile.margin_right_mm} / ${profile.margin_bottom_mm} / ${profile.margin_left_mm} mm
            </div>

            <div class="footer-note">
              Ukur kotak terluar dengan penggaris fisik untuk memastikan skala 100%. Jika ada garis terpotong, sesuaikan margin di menu Setting &gt; Printer.
            </div>
          </div>
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            try {
              document.body.removeChild(iframe);
            } catch {}
            resolve(true);
          }, 600);
        } catch {
          try {
            document.body.removeChild(iframe);
          } catch {}
          resolve(false);
        }
      }, 350);
    });
  },
};
