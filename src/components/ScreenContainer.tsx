import React from 'react';
import { ScreenBackground } from '../types/photobooth';

interface ScreenContainerProps {
  background?: ScreenBackground;
  children: React.ReactNode;
  className?: string;
  enableScroll?: boolean;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  background,
  children,
  className = '',
  enableScroll = false,
}) => {
  const blurPx = background?.blur_px ?? 8;
  const overlayOpacity = background?.overlay_opacity ?? 0.5;
  const mediaUrl =
    background?.media_url ||
    'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80';
  const mediaType = background?.media_type || 'image';

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-stone-950 flex justify-center items-center select-none font-sans">
      {/* Full-bleed desktop background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {mediaType === 'video' ? (
          <video
            src={mediaUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover scale-105"
            style={{
              filter: `blur(${blurPx}px)`,
              opacity: 0.9,
            }}
          />
        ) : (
          <img
            src={mediaUrl}
            alt="Wedding Backdrop"
            className="w-full h-full object-cover scale-105 transition-all duration-700 ease-out"
            style={{
              filter: `blur(${blurPx}px)`,
            }}
          />
        )}
        {/* Darkening tint overlay */}
        <div
          className="absolute inset-0 bg-stone-950 transition-opacity duration-500"
          style={{ opacity: overlayOpacity }}
        />
        {/* Subtle vignette gradient */}
        <div className="absolute inset-0 bg-radial from-transparent via-stone-950/40 to-stone-950/90 pointer-events-none" />
      </div>

      {/* Mobile container: max 480px, 9:16 portrait feel on desktop, full screen on mobile */}
      <main
        className={`relative z-10 w-full max-w-[480px] h-[100dvh] flex flex-col justify-between ${
          enableScroll ? 'overflow-y-auto overflow-x-hidden no-scrollbar' : 'overflow-hidden'
        } ${className}`}
        style={{
          paddingTop: 'env(safe-area-inset-top, 16px)',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
          paddingLeft: 'env(safe-area-inset-left, 16px)',
          paddingRight: 'env(safe-area-inset-right, 16px)',
        }}
      >
        {children}
      </main>
    </div>
  );
};
