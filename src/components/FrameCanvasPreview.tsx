import React, { useState, useEffect } from 'react';
import { Frame, Filter, CapturedPhoto } from '../types/photobooth';
import { getCssFilterString } from '../utils/canvas';
import { applyLut } from '../lib/lut';

interface FrameCanvasPreviewProps {
  frame: Frame;
  photos?: (CapturedPhoto | string | null)[];
  filter?: Filter;
  mirror?: boolean;
  className?: string;
  isLivePhotoView?: boolean;
  liveClips?: (string | null)[];
}

export const FrameCanvasPreview: React.FC<FrameCanvasPreviewProps> = ({
  frame,
  photos = [],
  filter,
  mirror = false,
  className = '',
  isLivePhotoView = false,
  liveClips = [],
}) => {
  const [lutProcessedUrls, setLutProcessedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!filter || !filter.lut_png_url) {
      setLutProcessedUrls({});
      return;
    }

    let isMounted = true;
    const processAll = async () => {
      const results: Record<string, string> = {};
      for (const item of photos) {
        let src: string | null = null;
        if (typeof item === 'string') src = item;
        else if (item && 'data_url' in item) src = item.data_url;

        if (src && !results[src]) {
          try {
            const canvas = await applyLut(
              src,
              filter.lut_png_url!,
              filter.intensity_default ?? 100,
              filter.extra_effects,
              filter.lut_size ?? 33
            );
            results[src] = canvas.toDataURL('image/jpeg', 0.88);
          } catch (e) {
            console.warn('Lut preview apply error:', e);
          }
        }
      }
      if (isMounted) {
        setLutProcessedUrls(results);
      }
    };

    processAll();

    return () => {
      isMounted = false;
    };
  }, [filter, photos]);

  const filterStyle = !filter?.lut_png_url && filter ? getCssFilterString(filter.params) : 'none';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl shadow-2xl select-none mx-auto ${className}`}
      style={{
        aspectRatio: `${frame.canvas_width} / ${frame.canvas_height}`,
        width: '100%',
        maxWidth: '100%',
        backgroundColor: '#ffffff',
      }}
    >
      {/* 1. Photo Slots Layer (underneath the frame overlay) */}
      <div className="absolute inset-0 z-0">
        {frame.slots.map((slot, index) => {
          const photoItem = photos[slot.shot_index] ?? photos[slot.shot_index - 1] ?? photos[0];
          let photoSrc: string | null = null;
          if (typeof photoItem === 'string') {
            photoSrc = photoItem;
          } else if (photoItem && 'data_url' in photoItem) {
            photoSrc = photoItem.data_url;
          }

          const liveClipSrc = liveClips[slot.shot_index] ?? liveClips[slot.shot_index - 1];

          // Normalize percentage (support 0-1 and 0-100)
          const isNorm = (slot.w <= 1.0 && slot.h <= 1.0) || (slot.x <= 1.0 && slot.y <= 1.0 && slot.w <= 1.0);
          const leftPct = isNorm ? slot.x * 100 : slot.x;
          const topPct = isNorm ? slot.y * 100 : slot.y;
          const widthPct = isNorm ? slot.w * 100 : slot.w;
          const heightPct = isNorm ? slot.h * 100 : slot.h;
          const rotationDeg = slot.rotation || 0;

          return (
            <div
              key={`slot-${index}-${slot.shot_index}`}
              className="absolute overflow-hidden rounded-md bg-stone-900"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                transform: rotationDeg ? `rotate(${rotationDeg}deg)` : undefined,
                transformOrigin: 'center center',
              }}
            >
              {isLivePhotoView && liveClipSrc ? (
                <video
                  src={liveClipSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover transition-transform duration-300"
                  style={{
                    filter: filterStyle,
                    transform: mirror ? 'scaleX(-1)' : 'none',
                  }}
                />
              ) : photoSrc ? (
                <img
                  src={lutProcessedUrls[photoSrc] || photoSrc}
                  alt={`Slot ${index + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300"
                  style={{
                    filter: filterStyle,
                    transform: mirror ? 'scaleX(-1)' : 'none',
                  }}
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900/90 text-stone-500 text-xs">
                  <span className="font-mono text-stone-400 font-semibold">
                    #{slot.shot_index >= 1 ? slot.shot_index : slot.shot_index + 1}
                  </span>
                  <span className="text-[10px] opacity-70">Pose</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. Transparent Frame Overlay (on top of photos, unaffected by filter) */}
      <img
        src={frame.image_url}
        alt={frame.name}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
      />
    </div>
  );
};
