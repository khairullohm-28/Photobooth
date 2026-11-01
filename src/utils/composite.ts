/**
 * High-resolution canvas compositing engine
 */
import { Frame, CapturedPhoto, Filter } from '../types/photobooth';
import { calculateCoverCrop, calculateSlotPixels, getCssFilterString, loadImage } from './canvas';
import { applyLut } from '../lib/lut';

export async function renderFrameComposite(
  frame: Frame,
  photos: CapturedPhoto[],
  filter: Filter,
  mirror: boolean = false
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = frame.canvas_width;
  canvas.height = frame.canvas_height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Fill canvas base with white or dark neutral
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Group latest non-discarded photos by shot_index
  const photoMap = new Map<number, CapturedPhoto>();
  for (const photo of photos) {
    if (!photo.is_discarded) {
      photoMap.set(photo.shot_index, photo);
    }
  }

  // Pre-load and apply WebGL 3D LUT filter to all photos
  const filteredPhotos = new Map<number, CanvasImageSource>();
  for (const [shotIndex, photo] of photoMap.entries()) {
    try {
      const img = await loadImage(photo.data_url);
      if (filter && filter.lut_png_url) {
        const lutCanvas = await applyLut(
          img,
          filter.lut_png_url,
          filter.intensity_default ?? 100,
          filter.extra_effects,
          filter.lut_size ?? 33
        );
        filteredPhotos.set(shotIndex, lutCanvas);
      } else {
        filteredPhotos.set(shotIndex, img);
      }
    } catch (err) {
      console.warn(`Failed to process photo for shot ${shotIndex}:`, err);
    }
  }

  // 1. Draw each slot's photo with filter applied and rotation around center
  for (const slot of frame.slots) {
    // Flexible shot index lookup (1-based, 0-based, or direct index)
    let imgSource =
      filteredPhotos.get(slot.shot_index) ||
      filteredPhotos.get(slot.shot_index - 1) ||
      filteredPhotos.get(slot.shot_index + 1) ||
      (filteredPhotos.size > 0 ? filteredPhotos.values().next().value : null);

    if (!imgSource && photos[slot.shot_index]) {
      try {
        const rawImg = await loadImage(photos[slot.shot_index].data_url);
        if (filter?.lut_png_url) {
          imgSource = await applyLut(
            rawImg,
            filter.lut_png_url,
            filter.intensity_default ?? 100,
            filter.extra_effects,
            filter.lut_size ?? 33
          );
        } else {
          imgSource = rawImg;
        }
      } catch {}
    }

    const bounds = calculateSlotPixels(slot, canvas.width, canvas.height);
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;

    ctx.save();
    ctx.translate(cx, cy);

    if (bounds.rotation) {
      ctx.rotate((bounds.rotation * Math.PI) / 180);
    }

    // Clip to rounded slot centered at origin
    ctx.beginPath();
    const radius = 8;
    ctx.roundRect(-bounds.w / 2, -bounds.h / 2, bounds.w, bounds.h, radius);
    ctx.clip();

    if (imgSource) {
      const srcW = (imgSource as any).width || (imgSource as any).naturalWidth || 800;
      const srcH = (imgSource as any).height || (imgSource as any).naturalHeight || 600;

      // Legacy fallback filter string if no LUT strip was provided
      if (!filter?.lut_png_url && filter?.params) {
        const filterStr = getCssFilterString(filter.params);
        if (filterStr !== 'none') {
          ctx.filter = filterStr;
        }
      } else {
        ctx.filter = 'none';
      }

      // Calculate cover crop so photo fills the slot without stretching
      const crop = calculateCoverCrop(srcW, srcH, bounds.w, bounds.h);

      if (mirror) {
        ctx.scale(-1, 1);
      }

      ctx.drawImage(
        imgSource as any,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        -bounds.w / 2,
        -bounds.h / 2,
        bounds.w,
        bounds.h
      );
    } else {
      // Empty slot placeholder
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(-bounds.w / 2, -bounds.h / 2, bounds.w, bounds.h);
    }

    ctx.restore();
  }

  // 2. Draw Frame transparent overlay on top (frame is NOT filtered)
  try {
    const frameOverlay = await loadImage(frame.image_url);
    ctx.filter = 'none';
    ctx.drawImage(frameOverlay, 0, 0, canvas.width, canvas.height);
  } catch (err) {
    console.warn('Could not load frame overlay image:', err);
  }

  return canvas.toDataURL('image/png', 0.95);
}
