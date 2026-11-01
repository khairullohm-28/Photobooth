/**
 * Data structures and types for Wedding Photobooth
 */

export type EventStatus = 'aktif' | 'nonaktif' | 'selesai';

export interface Event {
  id: string;
  name: string; // e.g. "Monika & David" or "Wedding Khai & Lila"
  slug: string; // unique URL identifier
  code_prefix: string; // 2-4 uppercase characters, globally unique
  event_date: string;
  couple_names: string;
  quote_text: string;
  quote_source: string;
  template_category_id?: string;
  active_from?: string; // ISO datetime
  active_until?: string; // ISO datetime
  status: EventStatus;
  is_demo?: boolean;
  is_active?: boolean; // legacy compatibility
  created_at?: string;
}

export interface EventFilter {
  id?: string;
  event_id: string;
  filter_id: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  created_at: string;
}

export interface EventTheme {
  primary_color?: string;
  font_family?: string;
  button_radius?: string;
  accent_color?: string;
}

export interface EventSettings {
  event_id: string;
  retention_hours: number; // default 120 (5 days)
  countdown_seconds: number; // default 3
  default_mirror: boolean;
  theme?: EventTheme;
}

export type ScreenKey = 'landing' | 'howto' | 'frame' | 'camera' | 'filter' | 'result';

export interface ScreenBackground {
  id?: string;
  event_id: string;
  screen_key: ScreenKey;
  media_url: string;
  media_type: 'image' | 'gif' | 'video';
  blur_px: number; // 0-20
  overlay_opacity: number; // 0-0.8 (0-80%)
}

export interface FrameSlot {
  id?: string;
  x: number; // 0-1 (normalized) or 0-100 percent
  y: number; // 0-1 (normalized) or 0-100 percent
  w: number; // 0-1 (normalized) or 0-100 percent
  h: number; // 0-1 (normalized) or 0-100 percent
  rotation?: number; // degrees clockwise around slot center
  shot_index: number; // 1-based (or 0-based legacy)
}

export interface Frame {
  id: string;
  category_id?: string;
  event_id?: string;
  name: string;
  description?: string;
  image_url: string; // transparent PNG overlay
  preview_url?: string; // WebP, longest side max 1000px
  thumbnail_url?: string;
  canvas_width: number; // e.g. 1200
  canvas_height: number; // e.g. 1800
  slots: FrameSlot[];
  photo_count: number; // number of unique shots required
  sort_order: number;
  is_active?: boolean;
  is_archived?: boolean;
  aspect_ratio?: string; // e.g. "2:3", "9:16", "3:4"
  badge?: string;
  created_at?: string;
}

export interface FilterParams {
  brightness?: number; // 100 is normal
  contrast?: number; // 100 is normal
  saturate?: number; // 100 is normal
  hue?: number; // deg
  sepia?: number; // percent 0-100
  grayscale?: number; // percent 0-100
  blur?: number; // px
  grain?: number; // 0-100
  vignette?: number; // 0-100
  tint?: string; // hex or rgba
  blend?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';
  temp?: number; // warm/cool shift
}

export interface FilterExtraEffects {
  grain?: number; // 0-100
  softness?: number; // 0-100
  vignette?: number; // 0-100
}

export interface Filter {
  id: string;
  event_id?: string;
  name: string;
  lut_url?: string;
  lut_png_url?: string;
  lut_size?: number; // e.g. 16, 33
  intensity_default?: number; // 0-100, default 100
  thumbnail_url?: string;
  is_active?: boolean;
  is_archived?: boolean;
  sort_order: number;
  extra_effects?: FilterExtraEffects;
  created_at?: string;
  params?: FilterParams; // Legacy fallback
}

export interface Session {
  id: string; // UUID
  event_id: string;
  session_code: string; // e.g. "MND-0042" or "KL-0001"
  frame_id: string;
  filter_id: string;
  mirror: boolean;
  status?: 'aktif' | 'kedaluwarsa';
  printed_count?: number;
  files_deleted_at?: string | null;
  is_demo?: boolean;
  created_at: string;
  expires_at: string;
}

export type AssetType =
  | 'raw_photo'
  | 'retake_discarded'
  | 'frame_result'
  | 'live_photo'
  | 'gif'
  | 'gif_mp4';

export interface SessionAsset {
  id?: string;
  session_id: string;
  type: AssetType;
  url: string; // Data URL or storage URL
  shot_index?: number;
  created_at?: string;
}

export interface CapturedPhoto {
  id: string;
  shot_index: number;
  data_url: string;
  video_clip_url?: string; // Live Photo WebM clip
  is_discarded?: boolean;
  timestamp: number;
}

// --------------------------------------------------------------------------
// Print Profiles & Jobs
// --------------------------------------------------------------------------

export type PrintPreset = '4r' | '5r' | 'a6' | 'a5' | 'a4' | 'strip_2x6' | 'custom';
export type PrintOrientation = 'portrait' | 'landscape';
export type PrintFitMode = 'fit' | 'fill' | 'actual';

export interface PrintProfile {
  id: string;
  name: string;
  paper_preset: PrintPreset;
  paper_width_mm: number;
  paper_height_mm: number;
  orientation: PrintOrientation;
  margin_top_mm: number;
  margin_right_mm: number;
  margin_bottom_mm: number;
  margin_left_mm: number;
  fit_mode: PrintFitMode;
  is_default: boolean;
  created_at?: string;
}

export interface PrintJob {
  id: string;
  session_id: string;
  profile_id?: string;
  copies: number;
  printed_by?: string;
  printed_at: string;
  // Display / joined fields
  session_code?: string;
  event_id?: string;
  event_name?: string;
  profile_name?: string;
  operator_name?: string;
}

export interface EventCounter {
  event_id: string;
  last_number: number;
}

// --------------------------------------------------------------------------
// Analytics & Dashboard / Reports RPC Types
// --------------------------------------------------------------------------

export type AnalyticsStep = 'start' | 'frame' | 'photos_done' | 'filter' | 'download';

export interface AnalyticsEvent {
  id?: string;
  event_id: string;
  session_id?: string;
  step: AnalyticsStep;
  device_os: string;
  camera_facing: string;
  created_at?: string;
}

export interface DashboardSummary {
  active_events_count: number;
  total_sessions: number;
  total_photos: number;
  total_prints: number;
  avg_retakes: number;
  storage_used_bytes: number;
  expiring_in_24h_count: number;
}

export interface SessionsPerDay {
  date_label: string;
  sessions_count: number;
  photos_count: number;
}

export interface SessionsPerHour {
  hour_of_day: number;
  sessions_count: number;
}

export interface TopTemplate {
  template_id: string;
  template_name: string;
  thumbnail_url?: string;
  usage_count: number;
}

export interface TopFilter {
  filter_id: string;
  filter_name: string;
  usage_count: number;
}

export interface FunnelStep {
  step: string;
  step_label: string;
  step_order: number;
  count: number;
  drop_off_pct: number;
}

export interface DownloadByType {
  asset_type: string;
  label: string;
  count: number;
}

export interface PrintsPerDay {
  date_label: string;
  jobs_count: number;
  copies_count: number;
}

export interface StorageByEvent {
  event_id: string;
  event_name: string;
  event_date: string;
  sessions_count: number;
  expired_sessions_count: number;
  expiring_24h_count: number;
  expiring_72h_count: number;
  total_files: number;
  storage_bytes: number;
}
