export interface UIColors {
  primary: string; // e.g. #121212
  sidebar_bg: string; // e.g. #EBEBEB
  accent: string; // e.g. #d4af37
  text: string; // e.g. #121212
}

export interface AppSettings {
  id?: number;
  company_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  ui_colors: UIColors;
  font: string;
  public_base_url?: string; // e.g. https://photobooth.domainku.com
}

export type AdminRole = 'owner' | 'team';

export interface AdminProfile {
  id: string;
  username: string;
  display_name: string;
  role: AdminRole;
  permissions: string[];
  allowed_event_ids: string[] | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at?: string;
}

export interface AuditLog {
  id: string | number;
  user_id?: string;
  username: string;
  action: string;
  entity: string;
  entity_id?: string;
  meta?: Record<string, any>;
  created_at: string;
}

export interface NavItemConfig {
  id: string;
  label: string;
  icon?: string;
  path?: string;
  permissionKey?: string;
  subItems?: {
    id: string;
    label: string;
    path: string;
    permissionKey: string;
  }[];
}

export const ADMIN_PERMISSIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'booking', label: 'Booking (Semua Submenu)' },
  { id: 'booking.results', label: 'Booking > Hasil per User' },
  { id: 'booking.print_history', label: 'Booking > Riwayat Cetak' },
  { id: 'studio', label: 'Studio Foto (Semua Submenu)' },
  { id: 'studio.categories', label: 'Studio Foto > Kategori Template' },
  { id: 'studio.templates', label: 'Studio Foto > Template' },
  { id: 'studio.filters', label: 'Studio Foto > Filter' },
  { id: 'events', label: 'User (Kelola Acara)' },
  { id: 'settings', label: 'Setting (Semua Submenu)' },
  { id: 'settings.team', label: 'Setting > Team' },
  { id: 'settings.website', label: 'Setting > Website Admin' },
  { id: 'settings.printer', label: 'Setting > Printer' },
  { id: 'reports', label: 'Laporan (Semua Submenu)' },
  { id: 'reports.events', label: 'Laporan > Rekap Per Acara' },
  { id: 'reports.periodic', label: 'Laporan > Penggunaan Periodik' },
  { id: 'reports.templates_filters', label: 'Laporan > Template & Filter' },
  { id: 'reports.prints', label: 'Laporan > Cetak' },
  { id: 'reports.storage', label: 'Laporan > Penyimpanan & Retensi' },
  { id: 'reports.audit_log', label: 'Laporan > Aktivitas Tim' },
] as const;
