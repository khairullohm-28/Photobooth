/**
 * Pure math and utility functions for canvas rendering, aspect ratio cropping,
 * filter style generation, and expiration formatting.
 */
import { FilterParams, FrameSlot } from '../types/photobooth';

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Calculates cover crop rectangles for an image of sourceWidth x sourceHeight
 * fitting into a target slot of targetWidth x targetHeight.
 */
export function calculateCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): CropRect {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(1, sourceWidth), sh: Math.max(1, sourceHeight) };
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  let sw = sourceWidth;
  let sh = sourceHeight;
  let sx = 0;
  let sy = 0;

  if (sourceRatio > targetRatio) {
    // Source is wider than target: crop left & right
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    // Source is taller than target: crop top & bottom
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  return { sx, sy, sw, sh };
}

/**
 * Calculates absolute pixel bounds of a frame slot.
 * Supports both normalized coordinates (0 to 1) and legacy percentage coordinates (0 to 100).
 */
export function calculateSlotPixels(
  slot: FrameSlot,
  canvasWidth: number,
  canvasHeight: number
) {
  // If slot width or height is <= 1.0 (and > 0), treat as normalized 0-1
  const isNormalized =
    (slot.w <= 1.0 && slot.h <= 1.0) || (slot.x <= 1.0 && slot.y <= 1.0 && slot.w <= 1.0);

  const factorX = isNormalized ? canvasWidth : canvasWidth / 100;
  const factorY = isNormalized ? canvasHeight : canvasHeight / 100;

  return {
    x: Math.round(slot.x * factorX),
    y: Math.round(slot.y * factorY),
    w: Math.round(slot.w * factorX),
    h: Math.round(slot.h * factorY),
    rotation: slot.rotation || 0,
  };
}

/**
 * Generates CSS filter string from FilterParams
 */
export function getCssFilterString(params: FilterParams = {}): string {
  const parts: string[] = [];

  if (params.brightness !== undefined && params.brightness !== 100) {
    parts.push(`brightness(${params.brightness}%)`);
  }
  if (params.contrast !== undefined && params.contrast !== 100) {
    parts.push(`contrast(${params.contrast}%)`);
  }
  if (params.saturate !== undefined && params.saturate !== 100) {
    parts.push(`saturate(${params.saturate}%)`);
  }
  if (params.grayscale !== undefined && params.grayscale > 0) {
    parts.push(`grayscale(${params.grayscale}%)`);
  }
  if (params.sepia !== undefined && params.sepia > 0) {
    parts.push(`sepia(${params.sepia}%)`);
  }
  if (params.hue !== undefined && params.hue !== 0) {
    parts.push(`hue-rotate(${params.hue}deg)`);
  }
  if (params.blur !== undefined && params.blur > 0) {
    parts.push(`blur(${params.blur}px)`);
  }

  return parts.length > 0 ? parts.join(' ') : 'none';
}

/**
 * Computes expiration ISO timestamp given created_at and retention hours
 */
export function calculateExpirationDate(
  createdAtIso: string,
  retentionHours: number = 120
): string {
  const created = new Date(createdAtIso);
  const expiry = new Date(created.getTime() + retentionHours * 60 * 60 * 1000);
  return expiry.toISOString();
}

/**
 * Formats remaining milliseconds into HH:MM:SS format
 * (e.g. 120:00:00, 48:15:22)
 */
export function formatCountdownTimer(remainingMs: number): {
  formatted: string;
  isExpired: boolean;
  hours: number;
  minutes: number;
  seconds: number;
} {
  if (remainingMs <= 0) {
    return { formatted: '00:00:00', isExpired: true, hours: 0, minutes: 0, seconds: 0 };
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');

  return {
    formatted: `${hh}:${mm}:${ss}`,
    isExpired: false,
    hours,
    minutes,
    seconds,
  };
}

/**
 * Helper to load an image into an HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image from src: ${src}`));
    img.src = src;
  });
}
