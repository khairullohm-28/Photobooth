/**
 * Client-side animated GIF compilation using gifenc
 */
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export async function createGifFromImages(
  imageUrls: string[],
  width: number = 400,
  height: number = 500,
  delayMs: number = 600
): Promise<string> {
  if (imageUrls.length === 0) return '';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';

  const encoder = GIFEncoder();

  for (const url of imageUrls) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image load failed'));
      el.src = url;
    });

    // Clear and draw image with cover crop
    ctx.clearRect(0, 0, width, height);

    const sRatio = img.width / img.height;
    const tRatio = width / height;
    let sx = 0,
      sy = 0,
      sw = img.width,
      sh = img.height;

    if (sRatio > tRatio) {
      sw = img.height * tRatio;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / tRatio;
      sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

    const { data } = ctx.getImageData(0, 0, width, height);
    // Quantize colors to max 256 palette
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);

    encoder.writeFrame(index, width, height, {
      palette,
      delay: delayMs,
      repeat: 0,
    });
  }

  encoder.finish();
  const bytes = encoder.bytes();
  const blob = new Blob([bytes as any], { type: 'image/gif' });
  return URL.createObjectURL(blob);
}

/**
 * Creates animated WebM loop video from image frames
 */
export async function createWebmFromImages(
  imageUrls: string[],
  width: number = 400,
  height: number = 500,
  fps: number = 2
): Promise<string> {
  return new Promise(async (resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve('');

      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(URL.createObjectURL(blob));
      };

      recorder.start();

      // Draw each image
      for (const url of imageUrls) {
        const img = await new Promise<HTMLImageElement>((res) => {
          const el = new Image();
          el.crossOrigin = 'anonymous';
          el.onload = () => res(el);
          el.src = url;
        });
        ctx.drawImage(img, 0, 0, width, height);
        await new Promise((r) => setTimeout(r, 600));
      }

      recorder.stop();
    } catch {
      resolve('');
    }
  });
}
