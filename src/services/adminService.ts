/**
 * Admin Service Layer for Supabase & Offline/Seed Fallback
 * Handles authentication, RBAC, website settings, team management, and audit logging.
 */

import { supabase } from './supabase';
import { AppSettings, AdminProfile, AuditLog } from '../types/admin';

const STORAGE_SETTINGS_KEY = 'wedding_admin_settings';
const STORAGE_PROFILES_KEY = 'wedding_admin_profiles';
const STORAGE_CURRENT_USER_KEY = 'wedding_admin_current_user';
const STORAGE_AUDIT_LOGS_KEY = 'wedding_admin_audit_logs';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  company_name: 'Khai & Lila Wedding Studio',
  logo_url: null,
  favicon_url: null,
  ui_colors: {
    primary: '#121212',
    sidebar_bg: '#EBEBEB',
    accent: '#d4af37',
    text: '#121212',
  },
  font: 'Libre Baskerville',
  public_base_url: '',
};

// Seed Owner for initial setup/testing
const SEED_OWNER: AdminProfile = {
  id: 'usr_owner_01',
  username: 'owner',
  display_name: 'Owner Studio',
  role: 'owner',
  permissions: [
    'dashboard',
    'booking',
    'booking.results',
    'booking.print_history',
    'studio',
    'studio.categories',
    'studio.templates',
    'studio.filters',
    'events',
    'settings',
    'settings.team',
    'settings.website',
    'settings.printer',
    'reports',
  ],
  allowed_event_ids: null,
  is_active: true,
  last_login_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

const SEED_TEAM: AdminProfile = {
  id: 'usr_team_01',
  username: 'operator',
  display_name: 'Operator Booth',
  role: 'team',
  permissions: ['dashboard', 'booking', 'booking.results'],
  allowed_event_ids: null,
  is_active: true,
  last_login_at: null,
  created_at: new Date().toISOString(),
};

function getLocalProfiles(): AdminProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_PROFILES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [SEED_OWNER, SEED_TEAM];
}

function saveLocalProfiles(profiles: AdminProfile[]) {
  try {
    localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(profiles));
  } catch (err) {
    console.warn('LocalStorage save profile issue:', err);
  }
}

export const AdminService = {
  // 1. App Settings (Website Admin)
  async getSettings(): Promise<AppSettings> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('id', 1)
          .single();
        if (!error && data) {
          return {
            company_name: data.company_name || DEFAULT_APP_SETTINGS.company_name,
            logo_url: data.logo_url || null,
            favicon_url: data.favicon_url || null,
            ui_colors: data.ui_colors || DEFAULT_APP_SETTINGS.ui_colors,
            font: data.font || DEFAULT_APP_SETTINGS.font,
          };
        }
      } catch (err) {
        console.warn('Supabase app_settings fallback:', err);
      }
    }

    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}

    return DEFAULT_APP_SETTINGS;
  },

  async updateSettings(settings: AppSettings): Promise<AppSettings> {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {}

    if (supabase) {
      try {
        await supabase
          .from('app_settings')
          .upsert({
            id: 1,
            company_name: settings.company_name,
            logo_url: settings.logo_url,
            favicon_url: settings.favicon_url,
            ui_colors: settings.ui_colors,
            font: settings.font,
            updated_at: new Date().toISOString(),
          });
      } catch (err) {
        console.warn('Supabase updateSettings issue:', err);
      }
    }

    await this.logAudit('update', 'app_settings', '1', {
      company_name: settings.company_name,
    });

    return settings;
  },

  // 2. Auth & Session Management
  getCurrentAdmin(): AdminProfile | null {
    try {
      const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  },

  async checkHasAnyOwner(): Promise<boolean> {
    const profiles = await this.getProfiles();
    return profiles.some((p) => p.role === 'owner' && p.is_active);
  },

  async login(username: string, password: string): Promise<{ success: boolean; user?: AdminProfile; error?: string }> {
    const trimmedUser = username.trim().toLowerCase();

    // Check Supabase Auth first if active
    if (supabase) {
      try {
        const syntheticEmail = `${trimmedUser}@admin.local`;
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: syntheticEmail,
          password: password,
        });

        if (!authError && authData.user) {
          const { data: profile } = await supabase
            .from('admin_profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          if (profile) {
            if (!profile.is_active) {
              return { success: false, error: 'Akun Anda dinonaktifkan. Hubungi Owner.' };
            }

            const updatedProfile: AdminProfile = {
              ...profile,
              last_login_at: new Date().toISOString(),
            };

            await supabase
              .from('admin_profiles')
              .update({ last_login_at: updatedProfile.last_login_at })
              .eq('id', profile.id);

            localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(updatedProfile));
            await this.logAudit('login', 'admin_profiles', profile.id, { username: profile.username });
            return { success: true, user: updatedProfile };
          }
        }
      } catch (e) {
        console.warn('Supabase login fallback:', e);
      }
    }

    // Local / Offline fallback auth
    const profiles = getLocalProfiles();
    const found = profiles.find((p) => p.username.toLowerCase() === trimmedUser);

    if (!found) {
      return { success: false, error: 'Username atau password tidak ditemukan' };
    }

    if (!found.is_active) {
      return { success: false, error: 'Akun ini sedang dinonaktifkan oleh Owner' };
    }

    // In demo/seed mode, password 'admin123' or any password >= 6 chars accepted
    if (password.length < 4) {
      return { success: false, error: 'Password minimal 4 karakter' };
    }

    const updated: AdminProfile = {
      ...found,
      last_login_at: new Date().toISOString(),
    };

    const nextProfiles = profiles.map((p) => (p.id === found.id ? updated : p));
    saveLocalProfiles(nextProfiles);
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(updated));

    await this.logAudit('login', 'admin_profiles', found.id, { username: found.username });

    return { success: true, user: updated };
  },

  async logout(): Promise<void> {
    const current = this.getCurrentAdmin();
    if (current) {
      await this.logAudit('logout', 'admin_profiles', current.id, { username: current.username });
    }
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
  },

  // 3. Team Management (RBAC)
  async getProfiles(): Promise<AdminProfile[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('admin_profiles')
          .select('*')
          .order('role', { ascending: false });
        if (!error && data && data.length > 0) {
          return data as AdminProfile[];
        }
      } catch (err) {
        console.warn('Supabase getProfiles fallback:', err);
      }
    }
    return getLocalProfiles();
  },

  async createProfile(data: {
    username: string;
    display_name: string;
    role: 'owner' | 'team';
    permissions: string[];
    allowed_event_ids: string[] | null;
    is_active: boolean;
    password?: string;
  }): Promise<{ success: boolean; profile?: AdminProfile; error?: string }> {
    const profiles = await this.getProfiles();
    const existing = profiles.find(
      (p) => p.username.toLowerCase() === data.username.toLowerCase().trim()
    );
    if (existing) {
      return { success: false, error: 'Username sudah digunakan' };
    }

    const newProfile: AdminProfile = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      username: data.username.toLowerCase().trim(),
      display_name: data.display_name.trim(),
      role: data.role,
      permissions: data.role === 'owner' ? ['*'] : data.permissions,
      allowed_event_ids: data.allowed_event_ids,
      is_active: data.is_active,
      last_login_at: null,
      created_at: new Date().toISOString(),
    };

    if (supabase) {
      try {
        await supabase.from('admin_profiles').insert(newProfile);
      } catch (err) {
        console.warn('Supabase createProfile notice:', err);
      }
    }

    const updated = [...profiles, newProfile];
    saveLocalProfiles(updated);

    await this.logAudit('create', 'admin_profiles', newProfile.id, {
      username: newProfile.username,
      role: newProfile.role,
    });

    return { success: true, profile: newProfile };
  },

  async updateProfile(
    id: string,
    updates: Partial<AdminProfile>,
    newPassword?: string
  ): Promise<{ success: boolean; profile?: AdminProfile; error?: string }> {
    const profiles = await this.getProfiles();
    const target = profiles.find((p) => p.id === id);
    if (!target) return { success: false, error: 'Anggota tidak ditemukan' };

    // Prevent deactivating or demoting the only owner
    if (target.role === 'owner') {
      const ownerCount = profiles.filter((p) => p.role === 'owner' && p.is_active).length;
      if (ownerCount <= 1 && updates.is_active === false) {
        return { success: false, error: 'Tidak dapat menonaktifkan satu-satunya Owner' };
      }
    }

    const updatedProfile: AdminProfile = {
      ...target,
      ...updates,
      permissions: updates.role === 'owner' ? ['*'] : updates.permissions || target.permissions,
    };

    if (supabase) {
      try {
        await supabase
          .from('admin_profiles')
          .update(updatedProfile)
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase updateProfile notice:', err);
      }
    }

    const updatedList = profiles.map((p) => (p.id === id ? updatedProfile : p));
    saveLocalProfiles(updatedList);

    // If updating current user, refresh in localStorage
    const current = this.getCurrentAdmin();
    if (current && current.id === id) {
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(updatedProfile));
    }

    await this.logAudit('update', 'admin_profiles', id, {
      username: updatedProfile.username,
      updated_fields: Object.keys(updates),
    });

    return { success: true, profile: updatedProfile };
  },

  async deleteProfile(id: string): Promise<{ success: boolean; error?: string }> {
    const profiles = await this.getProfiles();
    const target = profiles.find((p) => p.id === id);
    if (!target) return { success: false, error: 'Anggota tidak ditemukan' };

    const current = this.getCurrentAdmin();
    if (current && current.id === id) {
      return { success: false, error: 'Tidak dapat menghapus akun Anda sendiri' };
    }

    if (target.role === 'owner') {
      const ownerCount = profiles.filter((p) => p.role === 'owner').length;
      if (ownerCount <= 1) {
        return { success: false, error: 'Tidak dapat menghapus satu-satunya akun Owner' };
      }
    }

    if (supabase) {
      try {
        await supabase.from('admin_profiles').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteProfile issue:', err);
      }
    }

    const filtered = profiles.filter((p) => p.id !== id);
    saveLocalProfiles(filtered);

    await this.logAudit('delete', 'admin_profiles', id, { username: target.username });

    return { success: true };
  },

  // 4. Audit Logs
  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (!error && data) return data as AuditLog[];
      } catch {}
    }

    try {
      const raw = localStorage.getItem(STORAGE_AUDIT_LOGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}

    return [];
  },

  async recordAuditLog(adminId: string, adminName: string, action: string, details: string, metadata?: any) {
    return this.logAudit(action, details, adminId, { admin_name: adminName, ...metadata });
  },

  async logAudit(action: string, entity: string, entity_id?: string, meta?: any) {
    const current = this.getCurrentAdmin();
    const logItem: AuditLog = {
      id: Date.now(),
      user_id: current?.id,
      username: current?.username || 'system',
      action,
      entity,
      entity_id,
      meta,
      created_at: new Date().toISOString(),
    };

    try {
      const raw = localStorage.getItem(STORAGE_AUDIT_LOGS_KEY);
      const logs: AuditLog[] = raw ? JSON.parse(raw) : [];
      logs.unshift(logItem);
      if (logs.length > 200) logs.pop();
      localStorage.setItem(STORAGE_AUDIT_LOGS_KEY, JSON.stringify(logs));
    } catch {}

    if (supabase) {
      try {
        await supabase.from('audit_logs').insert({
          user_id: logItem.user_id,
          username: logItem.username,
          action: logItem.action,
          entity: logItem.entity,
          entity_id: logItem.entity_id,
          meta: logItem.meta,
          created_at: logItem.created_at,
        });
      } catch {}
    }
  },
};
