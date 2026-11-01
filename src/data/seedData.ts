import { Event, EventSettings, ScreenBackground, Frame, Filter, TemplateCategory } from '../types/photobooth';

export const SEED_CATEGORIES: TemplateCategory[] = [
  {
    id: 'cat_khai_lila',
    name: 'Wedding Khai & Lila',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 'cat_monika_david',
    name: 'Monika & David',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'cat_classic',
    name: 'Classic Elegance Series',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

export const SEED_EVENT: Event = {
  id: 'evt_khai_lila_2026',
  name: 'Wedding Khai & Lila',
  slug: 'khai-lila',
  couple_names: 'Khai & Lila',
  code_prefix: 'KL',
  event_date: '28 Oktober 2026',
  quote_text: 'Dan di antara tanda-tanda (kebesaran)-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang.',
  quote_source: 'QS. Ar-Rum: 21',
  is_active: true,
  status: 'aktif',
  is_demo: true,
  active_from: '2026-01-01T00:00:00Z',
  active_until: '2028-12-31T23:59:59Z',
  template_category_id: 'cat_khai_lila',
};

export const SEED_SETTINGS: EventSettings = {
  event_id: 'evt_khai_lila_2026',
  retention_hours: 120, // 5 hari
  countdown_seconds: 3,
  default_mirror: true,
  theme: {
    primary_color: '#ffffff',
    accent_color: '#d4af37', // Gold
    font_family: 'Pinyon Script',
    button_radius: '9999px',
  },
};

// High quality wedding backgrounds with elegant moody tones
export const SEED_BACKGROUNDS: ScreenBackground[] = [
  {
    event_id: 'evt_khai_lila_2026',
    screen_key: 'landing',
    // Elegant warm candlelight floral wedding setup
    media_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
    media_type: 'image',
    blur_px: 0, // Layar 1 tanpa blur sesuai spesifikasi!
    overlay_opacity: 0.42,
  },
  {
    event_id: 'evt_khai_lila_2026',
    screen_key: 'howto',
    media_url: 'https://images.unsplash.com/photo-1519225429980-715cb0215aed?auto=format&fit=crop&w=1200&q=80',
    media_type: 'image',
    blur_px: 8, // Layar 2-11 blur default 8px sesuai spesifikasi!
    overlay_opacity: 0.55,
  },
  {
    event_id: 'evt_khai_lila_2026',
    screen_key: 'frame',
    media_url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
    media_type: 'image',
    blur_px: 8,
    overlay_opacity: 0.58,
  },
  {
    event_id: 'evt_khai_lila_2026',
    screen_key: 'camera',
    media_url: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
    media_type: 'image',
    blur_px: 8,
    overlay_opacity: 0.65,
  },
  {
    event_id: 'evt_khai_lila_2026',
    screen_key: 'filter',
    media_url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=1200&q=80',
    media_type: 'image',
    blur_px: 8,
    overlay_opacity: 0.60,
  },
  {
    event_id: 'evt_khai_lila_2026',
    screen_key: 'result',
    media_url: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
    media_type: 'image',
    blur_px: 8,
    overlay_opacity: 0.65,
  },
];

// Helper to generate elegant SVG frame overlays with transparent cutouts
function generateFrameSvgDataUrl(
  w: number,
  h: number,
  title: string,
  couple: string,
  date: string,
  slots: { x: number; y: number; w: number; h: number }[],
  style: 'classic' | 'vintage-gold' | 'minimalist' | 'botanical'
): string {
  // We build an SVG mask where white = visible frame, black = transparent photo slots
  const rects = slots
    .map(
      (s) =>
        `<rect x="${(s.x / 100) * w}" y="${(s.y / 100) * h}" width="${
          (s.w / 100) * w
        }" height="${(s.h / 100) * h}" rx="8" fill="black" />`
    )
    .join('');

  const slotBorders = slots
    .map(
      (s) =>
        `<rect x="${(s.x / 100) * w}" y="${(s.y / 100) * h}" width="${
          (s.w / 100) * w
        }" height="${
          (s.h / 100) * h
        }" rx="8" fill="none" stroke="${style === 'vintage-gold' ? '#d4af37' : '#e5e5e5'}" stroke-width="2.5" />`
    )
    .join('');

  const bgColor = style === 'vintage-gold' ? '#1c1917' : '#ffffff';
  const textColor = style === 'vintage-gold' ? '#f5eedb' : '#262626';
  const accentColor = style === 'vintage-gold' ? '#d4af37' : '#a3a3a3';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <mask id="cutout-mask">
        <rect width="${w}" height="${h}" fill="white" />
        ${rects}
      </mask>
      <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fdf0cd" />
        <stop offset="50%" stop-color="#d4af37" />
        <stop offset="100%" stop-color="#aa7c11" />
      </linearGradient>
    </defs>

    <!-- Base Frame with cutout holes -->
    <rect width="${w}" height="${h}" fill="${bgColor}" mask="url(#cutout-mask)" />

    <!-- Slot borders -->
    ${slotBorders}

    <!-- Frame Borders -->
    <rect x="16" y="16" width="${w - 32}" height="${h - 32}" fill="none" stroke="${accentColor}" stroke-width="1.5" stroke-opacity="0.6" rx="12" />

    <!-- Top & Bottom Typography & Ornaments -->
    <text x="${w / 2}" y="56" text-anchor="middle" font-family="'Inter', sans-serif" font-size="16" font-weight="700" letter-spacing="4" fill="${accentColor}">${title.toUpperCase()}</text>
    
    <text x="${w / 2}" y="${h - 75}" text-anchor="middle" font-family="'Pinyon Script', cursive" font-size="52" fill="${textColor}">${couple}</text>
    
    <line x1="${w / 2 - 120}" y1="${h - 52}" x2="${w / 2 + 120}" y2="${h - 52}" stroke="${accentColor}" stroke-width="1" stroke-opacity="0.5" />
    
    <text x="${w / 2}" y="${h - 32}" text-anchor="middle" font-family="'Libre Baskerville', serif" font-size="16" font-style="italic" fill="${accentColor}" letter-spacing="2">${date}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SEED_FRAMES: Frame[] = [
  {
    id: 'frm_strip_3',
    category_id: 'cat_khai_lila',
    event_id: 'evt_khai_lila_2026',
    name: 'Classic White Strip',
    description: '3 Pose Vertikal Elegan',
    canvas_width: 1000,
    canvas_height: 1600,
    aspect_ratio: '5:8',
    sort_order: 1,
    photo_count: 3,
    is_active: true,
    is_archived: false,
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    badge: 'Favorit',
    slots: [
      { id: 's1', x: 10, y: 7, w: 80, h: 26, rotation: 0, shot_index: 1 },
      { id: 's2', x: 10, y: 35, w: 80, h: 26, rotation: 0, shot_index: 2 },
      { id: 's3', x: 10, y: 63, w: 80, h: 26, rotation: 0, shot_index: 3 },
    ],
    image_url: generateFrameSvgDataUrl(
      1000,
      1600,
      'Wedding Celebration',
      'Khai &amp; Lila',
      '28 . 10 . 2026',
      [
        { x: 10, y: 7, w: 80, h: 26 },
        { x: 10, y: 35, w: 80, h: 26 },
        { x: 10, y: 63, w: 80, h: 26 },
      ],
      'classic'
    ),
  },
  {
    id: 'frm_grid_4',
    category_id: 'cat_khai_lila',
    event_id: 'evt_khai_lila_2026',
    name: 'Romantic Gold 2x2',
    description: '4 Pose Kotak Modern',
    canvas_width: 1200,
    canvas_height: 1500,
    aspect_ratio: '4:5',
    sort_order: 2,
    photo_count: 4,
    is_active: true,
    is_archived: false,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    badge: 'Popular',
    slots: [
      { id: 'g1', x: 8, y: 8, w: 40, h: 37, rotation: 0, shot_index: 1 },
      { id: 'g2', x: 52, y: 8, w: 40, h: 37, rotation: 0, shot_index: 2 },
      { id: 'g3', x: 8, y: 48, w: 40, h: 37, rotation: 0, shot_index: 3 },
      { id: 'g4', x: 52, y: 48, w: 40, h: 37, rotation: 0, shot_index: 4 },
    ],
    image_url: generateFrameSvgDataUrl(
      1200,
      1500,
      'The Wedding Of',
      'Khai &amp; Lila',
      '28 Oktober 2026',
      [
        { x: 8, y: 8, w: 40, h: 37 },
        { x: 52, y: 8, w: 40, h: 37 },
        { x: 8, y: 48, w: 40, h: 37 },
        { x: 52, y: 48, w: 40, h: 37 },
      ],
      'vintage-gold'
    ),
  },
  {
    id: 'frm_duo_2',
    category_id: 'cat_khai_lila',
    event_id: 'evt_khai_lila_2026',
    name: 'Minimalist Duo',
    description: '2 Pose Portrait Luas',
    canvas_width: 1000,
    canvas_height: 1500,
    aspect_ratio: '2:3',
    sort_order: 3,
    photo_count: 2,
    is_active: true,
    is_archived: false,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    badge: 'Simple',
    slots: [
      { id: 'd1', x: 10, y: 8, w: 80, h: 38, rotation: 0, shot_index: 1 },
      { id: 'd2', x: 10, y: 49, w: 80, h: 38, rotation: 0, shot_index: 2 },
    ],
    image_url: generateFrameSvgDataUrl(
      1000,
      1500,
      'Timeless Moments',
      'Khai &amp; Lila',
      '28 . 10 . 2026',
      [
        { x: 10, y: 8, w: 80, h: 38 },
        { x: 10, y: 49, w: 80, h: 38 },
      ],
      'minimalist'
    ),
  },
  {
    id: 'frm_repeat_strip',
    category_id: 'cat_khai_lila',
    event_id: 'evt_khai_lila_2026',
    name: 'Double Strip 2-Col',
    description: '2 Foto Diulang 4 Slot',
    canvas_width: 1200,
    canvas_height: 1500,
    aspect_ratio: '4:5',
    sort_order: 4,
    photo_count: 2,
    is_active: true,
    is_archived: false,
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    badge: 'Twin Strip',
    slots: [
      { id: 'r1', x: 8, y: 8, w: 40, h: 37, rotation: 0, shot_index: 1 },
      { id: 'r2', x: 52, y: 8, w: 40, h: 37, rotation: 0, shot_index: 1 },
      { id: 'r3', x: 8, y: 48, w: 40, h: 37, rotation: 0, shot_index: 2 },
      { id: 'r4', x: 52, y: 48, w: 40, h: 37, rotation: 0, shot_index: 2 },
    ],
    image_url: generateFrameSvgDataUrl(
      1200,
      1500,
      'Two of A Kind',
      'Khai &amp; Lila',
      'October 28, 2026',
      [
        { x: 8, y: 8, w: 40, h: 37 },
        { x: 52, y: 8, w: 40, h: 37 },
        { x: 8, y: 48, w: 40, h: 37 },
        { x: 52, y: 48, w: 40, h: 37 },
      ],
      'classic'
    ),
  },
];

export const SEED_FILTERS: Filter[] = [
  {
    id: 'flt_normal',
    event_id: 'evt_khai_lila_2026',
    name: 'Normal',
    sort_order: 1,
    params: { brightness: 100, contrast: 100, saturate: 100 },
  },
  {
    id: 'flt_noir',
    event_id: 'evt_khai_lila_2026',
    name: 'Noir',
    sort_order: 2,
    params: { grayscale: 100, contrast: 130, brightness: 95 },
  },
  {
    id: 'flt_vhs',
    event_id: 'evt_khai_lila_2026',
    name: 'VHS',
    sort_order: 3,
    params: { saturate: 140, contrast: 115, sepia: 20, hue: -10 },
  },
  {
    id: 'flt_beauty',
    event_id: 'evt_khai_lila_2026',
    name: 'Beauty',
    sort_order: 4,
    params: { brightness: 108, saturate: 105, contrast: 95, sepia: 10 },
  },
  {
    id: 'flt_klasik',
    event_id: 'evt_khai_lila_2026',
    name: 'Klasik',
    sort_order: 5,
    params: { sepia: 40, contrast: 108, brightness: 102, saturate: 90 },
  },
  {
    id: 'flt_warm',
    event_id: 'evt_khai_lila_2026',
    name: 'Warm Sun',
    sort_order: 6,
    params: { sepia: 25, saturate: 120, brightness: 106, hue: -5 },
  },
  {
    id: 'flt_cool',
    event_id: 'evt_khai_lila_2026',
    name: 'Cool Breeze',
    sort_order: 7,
    params: { hue: 15, saturate: 85, contrast: 110, brightness: 102 },
  },
  {
    id: 'flt_film_grain',
    event_id: 'evt_khai_lila_2026',
    name: 'Film Grain',
    sort_order: 8,
    params: { contrast: 125, saturate: 92, sepia: 15, brightness: 100 },
  },
  {
    id: 'flt_soft_glow',
    event_id: 'evt_khai_lila_2026',
    name: 'Soft Glow',
    sort_order: 9,
    params: { brightness: 112, contrast: 92, saturate: 110 },
  },
  {
    id: 'flt_fade',
    event_id: 'evt_khai_lila_2026',
    name: 'Fade Matte',
    sort_order: 10,
    params: { contrast: 85, brightness: 106, saturate: 88 },
  },
];

// Sample placeholder photos for frame preview before user takes photos
export const SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=600&q=80',
];
