/**
 * Standard Built-in 3D LUT Presets (.cube format)
 * Generated with mathematical color grading transforms for instant offline testing
 * and default wedding filter presets.
 */

import { parseCubeFile, createLutStripDataUrl } from './lut';
import { Filter } from '../types/photobooth';

function generateCubeString(
  title: string,
  size: number,
  transform: (r: number, g: number, b: number) => [number, number, number]
): string {
  const lines: string[] = [
    `# Built-in Wedding Preset: ${title}`,
    `TITLE "${title}"`,
    `LUT_3D_SIZE ${size}`,
    `DOMAIN_MIN 0.0 0.0 0.0`,
    `DOMAIN_MAX 1.0 1.0 1.0`,
  ];

  for (let b = 0; b < size; b++) {
    const normB = b / (size - 1);
    for (let g = 0; g < size; g++) {
      const normG = g / (size - 1);
      for (let r = 0; r < size; r++) {
        const normR = r / (size - 1);
        const [outR, outG, outB] = transform(normR, normG, normB);
        lines.push(
          `${Math.max(0, Math.min(1, outR)).toFixed(6)} ${Math.max(0, Math.min(1, outG)).toFixed(6)} ${Math.max(
            0,
            Math.min(1, outB)
          ).toFixed(6)}`
        );
      }
    }
  }

  return lines.join('\n');
}

// 1. Wedding Warmth: warm highlights, rich skin tones, slightly lifted shadows
export const PRESET_CUBE_WARM = generateCubeString('Wedding Warmth', 16, (r, g, b) => {
  // Lift shadows slightly
  let nr = Math.pow(r, 0.92) * 1.05 + 0.03;
  let ng = Math.pow(g, 0.95) * 1.02 + 0.02;
  let nb = Math.pow(b, 1.05) * 0.92;
  return [nr, ng, nb];
});

// 2. Noir Film: rich monochrome black & white with high contrast
export const PRESET_CUBE_NOIR = generateCubeString('Noir Film', 16, (r, g, b) => {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  // S-curve contrast
  const c = Math.pow(luma, 1.18);
  return [c, c, c];
});

// 3. Vintage Sepia: romantic earthy sepia tone
export const PRESET_CUBE_SEPIA = generateCubeString('Vintage Sepia', 16, (r, g, b) => {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  const sr = luma * 1.15 + 0.04;
  const sg = luma * 0.95 + 0.02;
  const sb = luma * 0.75;
  return [sr, sg, sb];
});

// 4. Velvet Rose: soft blush romance tone
export const PRESET_CUBE_ROSE = generateCubeString('Velvet Rose', 16, (r, g, b) => {
  let nr = Math.pow(r, 0.90) * 1.08 + 0.03;
  let ng = Math.pow(g, 0.98) * 0.96;
  let nb = Math.pow(b, 0.95) * 1.02 + 0.02;
  return [nr, ng, nb];
});

/**
 * Builds standard default Filter objects with pre-rendered strip PNGs
 */
export function buildDefaultLutFilters(): Filter[] {
  const configs = [
    {
      id: 'flt_preset_warm',
      name: 'Wedding Warmth',
      cube: PRESET_CUBE_WARM,
      intensity: 100,
      extra: { grain: 15, softness: 10, vignette: 20 },
      sort: 1,
    },
    {
      id: 'flt_preset_noir',
      name: 'Noir Film',
      cube: PRESET_CUBE_NOIR,
      intensity: 100,
      extra: { grain: 25, softness: 0, vignette: 30 },
      sort: 2,
    },
    {
      id: 'flt_preset_rose',
      name: 'Velvet Rose',
      cube: PRESET_CUBE_ROSE,
      intensity: 95,
      extra: { grain: 10, softness: 15, vignette: 15 },
      sort: 3,
    },
    {
      id: 'flt_preset_sepia',
      name: 'Vintage Sepia',
      cube: PRESET_CUBE_SEPIA,
      intensity: 90,
      extra: { grain: 20, softness: 5, vignette: 25 },
      sort: 4,
    },
  ];

  return configs.map((cfg) => {
    let lutPngUrl: string | undefined;
    let lutSize = 16;
    try {
      if (typeof document !== 'undefined') {
        const parsed = parseCubeFile(cfg.cube);
        const { dataUrl, finalSize } = createLutStripDataUrl(parsed);
        lutPngUrl = dataUrl;
        lutSize = finalSize;
      }
    } catch (e) {
      console.warn(`Could not render strip for preset ${cfg.name}:`, e);
    }

    return {
      id: cfg.id,
      name: cfg.name,
      lut_url: `data:text/plain;charset=utf-8,${encodeURIComponent(cfg.cube)}`,
      lut_png_url: lutPngUrl,
      lut_size: lutSize,
      intensity_default: cfg.intensity,
      is_active: true,
      is_archived: false,
      sort_order: cfg.sort,
      extra_effects: cfg.extra,
      created_at: new Date().toISOString(),
    };
  });
}
