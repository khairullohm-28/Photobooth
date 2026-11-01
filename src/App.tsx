/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Event,
  EventSettings,
  ScreenBackground,
  Frame,
  Filter,
  Session,
  SessionAsset,
  CapturedPhoto,
} from './types/photobooth';
import { PhotoboothService } from './services/supabase';
import { LandingScreen } from './components/screens/LandingScreen';
import { HowToScreen } from './components/screens/HowToScreen';
import { FrameSelectScreen } from './components/screens/FrameSelectScreen';
import { CameraScreen } from './components/screens/CameraScreen';
import { FilterSelectScreen } from './components/screens/FilterSelectScreen';
import { ResultScreen } from './components/screens/ResultScreen';
import { EventInactiveScreen } from './components/screens/EventInactiveScreen';
import { renderFrameComposite } from './utils/composite';
import { createGifFromImages, createWebmFromImages } from './utils/gif';
import { calculateExpirationDate } from './utils/canvas';
import { applyLut } from './lib/lut';
import { AdminApp } from './admin/AdminApp';
import { detectDeviceOS } from './utils/device';
import { Loader2 } from 'lucide-react';

type FlowScreen = 'landing' | 'howto' | 'frame' | 'camera' | 'filter' | 'result';

export default function App() {
  // Routing state parsed from URL path: /e/:slug and /e/:slug/s/:sessionId
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() =>
    window.location.pathname.startsWith('/admin')
  );
  const [eventSlug, setEventSlug] = useState<string>('khai-lila');
  const [urlSessionId, setUrlSessionId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(() =>
    new URLSearchParams(window.location.search).get('preview') === 'true'
  );

  // Loaded database entities
  const [event, setEvent] = useState<Event | null>(null);
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [backgrounds, setBackgrounds] = useState<ScreenBackground[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Photobooth Flow State
  const [currentScreen, setCurrentScreen] = useState<FlowScreen>('landing');
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<Filter | null>(null);
  const [mirror, setMirror] = useState<boolean>(true);
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);

  // Result Session State
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessionAssets, setSessionAssets] = useState<SessionAsset[]>([]);
  const [isSavingSession, setIsSavingSession] = useState<boolean>(false);
  const [saveSessionError, setSaveSessionError] = useState<string | null>(null);
  const [pendingFilter, setPendingFilter] = useState<Filter | null>(null);

  // Parse URL on mount and handle popstate
  useEffect(() => {
    const parseUrl = () => {
      const path = window.location.pathname;
      if (path.startsWith('/admin')) {
        setIsAdminRoute(true);
        return;
      }
      setIsAdminRoute(false);

      // Matches /e/:slug/s/:sessionId
      const sessionMatch = path.match(/\/e\/([^\/]+)\/s\/([^\/]+)/);
      if (sessionMatch) {
        setEventSlug(sessionMatch[1]);
        setUrlSessionId(sessionMatch[2]);
        return;
      }

      // Matches /e/:slug
      const eventMatch = path.match(/\/e\/([^\/]+)/);
      if (eventMatch) {
        setEventSlug(eventMatch[1]);
        setUrlSessionId(null);
        return;
      }

      // Default fallback: route to /e/khai-lila
      window.history.replaceState({}, '', '/e/khai-lila');
      setEventSlug('khai-lila');
      setUrlSessionId(null);
    };

    parseUrl();
    window.addEventListener('popstate', parseUrl);
    return () => window.removeEventListener('popstate', parseUrl);
  }, []);

  // Fetch Event Data from Supabase / Seed
  const loadEventData = useCallback(async () => {
    setIsLoading(true);
    try {
      const evt = await PhotoboothService.getEvent(eventSlug);
      setEvent(evt);

      const [stg, bgs, frms, flts] = await Promise.all([
        PhotoboothService.getSettings(evt.id),
        PhotoboothService.getBackgrounds(evt.id),
        PhotoboothService.getFrames(evt.id, evt.template_category_id),
        PhotoboothService.getFilters(evt.id),
      ]);

      setSettings(stg);
      setBackgrounds(bgs);
      setFrames(frms);
      setFilters(flts);

      if (frms.length > 0 && !selectedFrame) {
        setSelectedFrame(frms[0]);
      }
      if (flts.length > 0 && !selectedFilter) {
        setSelectedFilter(flts[0]);
      }
      if (stg) {
        setMirror(stg.default_mirror);
      }

      // If a sessionId was in the URL, load that session directly
      if (urlSessionId) {
        const { session: sess, assets: asts } =
          await PhotoboothService.getSession(urlSessionId);
        if (sess) {
          setActiveSession(sess);
          setSessionAssets(asts);
          const foundFrame = frms.find((f) => f.id === sess.frame_id) || frms[0];
          const foundFilter =
            flts.find((f) => f.id === sess.filter_id) || flts[0];
          setSelectedFrame(foundFrame);
          setSelectedFilter(foundFilter);
          setCurrentScreen('result');
        }
      }
    } catch (err) {
      console.error('Failed to load event data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [eventSlug, urlSessionId]);

  useEffect(() => {
    loadEventData();
  }, [loadEventData]);

  // Find background by screen_key
  const getScreenBackground = (key: string): ScreenBackground | undefined => {
    return backgrounds.find((b) => b.screen_key === key);
  };

  // Flow Step 4 to 5: Camera completes photo burst
  const handlePhotosComplete = (photos: CapturedPhoto[], isMirrored: boolean) => {
    setCapturedPhotos(photos);
    setMirror(isMirrored);
    if (event) {
      PhotoboothService.trackAnalyticsEvent({
        event_id: event.id,
        step: 'photos_done',
        device_os: detectDeviceOS(),
        camera_facing: isMirrored ? 'user' : 'environment',
      });
    }
    setCurrentScreen('filter');
  };

  // Flow Step 5 to 6-11: Filter chosen, generate all assets & session
  const handleProceedToSave = async (filter: Filter) => {
    if (!event || !selectedFrame) return;

    setSelectedFilter(filter);
    setPendingFilter(filter);
    setIsSavingSession(true);
    setSaveSessionError(null);

    try {
      // 1. Render high-res composite frame PNG
      const frameResultDataUrl = await renderFrameComposite(
        selectedFrame,
        capturedPhotos,
        filter,
        mirror
      );

      // 2. Prepare raw photo URLs and apply selected LUT filter for GIF/WebM
      const nonDiscardedPhotos = capturedPhotos
        .filter((p) => !p.is_discarded)
        .sort((a, b) => a.shot_index - b.shot_index);

      const rawImageUrls = nonDiscardedPhotos.map((p) => p.data_url);

      // Apply 3D LUT to images for GIF / WebM if LUT exists
      let imageUrlsForGif = rawImageUrls;
      if (filter && filter.lut_png_url) {
        try {
          imageUrlsForGif = await Promise.all(
            rawImageUrls.map(async (url) => {
              const canvas = await applyLut(
                url,
                filter.lut_png_url!,
                filter.intensity_default ?? 100,
                filter.extra_effects,
                filter.lut_size ?? 33
              );
              return canvas.toDataURL('image/jpeg', 0.88);
            })
          );
        } catch (err) {
          console.warn('Failed to apply LUT to GIF frames:', err);
        }
      }

      // 3. Create Animated GIF
      let gifUrl = '';
      try {
        gifUrl = await createGifFromImages(imageUrlsForGif, 400, 500, 600);
      } catch (e) {
        console.warn('GIF creation fallback:', e);
      }

      // 4. Create WebM loop video
      let webmUrl = '';
      try {
        webmUrl = await createWebmFromImages(imageUrlsForGif, 400, 500, 2);
      } catch (e) {
        console.warn('WebM creation fallback:', e);
      }

      // 5. Create atomic session with create_session function
      const newSession = await PhotoboothService.createSession({
        eventId: event.id,
        frameId: selectedFrame.id,
        filterId: filter.id,
        mirror: mirror,
        retentionHours: settings?.retention_hours ?? 120,
        codePrefix: event.code_prefix || 'KL',
        isDemo: !!event.is_demo,
      });

      // Track filter completion in analytics
      PhotoboothService.trackAnalyticsEvent({
        event_id: event.id,
        session_id: newSession.id,
        step: 'filter',
        device_os: detectDeviceOS(),
        camera_facing: mirror ? 'user' : 'environment',
      });

      // 6. Build SessionAsset array
      const assetsToSave: SessionAsset[] = [];

      // Frame Result
      assetsToSave.push({
        session_id: newSession.id,
        type: 'frame_result',
        url: frameResultDataUrl,
      });

      // GIF and GIF MP4
      if (gifUrl) {
        assetsToSave.push({
          session_id: newSession.id,
          type: 'gif',
          url: gifUrl,
        });
      }
      if (webmUrl) {
        assetsToSave.push({
          session_id: newSession.id,
          type: 'gif_mp4',
          url: webmUrl,
        });
      }

      // Raw photos & live clips
      capturedPhotos.forEach((photo) => {
        assetsToSave.push({
          session_id: newSession.id,
          type: photo.is_discarded ? 'retake_discarded' : 'raw_photo',
          url: photo.data_url,
          shot_index: photo.shot_index,
        });

        if (photo.video_clip_url && !photo.is_discarded) {
          assetsToSave.push({
            session_id: newSession.id,
            type: 'live_photo',
            url: photo.video_clip_url,
            shot_index: photo.shot_index,
          });
        }
      });

      // Save to Supabase and LocalStorage
      await PhotoboothService.saveSession(newSession, assetsToSave);

      setActiveSession(newSession);
      setSessionAssets(assetsToSave);

      // Update URL to /e/:slug/s/:sessionId
      const nextPath = `/e/${event.slug}/s/${newSession.id}`;
      window.history.pushState({}, '', nextPath);

      setIsSavingSession(false);
      // Advance to Layar 6-11
      setCurrentScreen('result');
    } catch (err: any) {
      console.error('Failed to create session:', err);
      setIsSavingSession(false);
      setSaveSessionError(err?.message || 'Gagal menyimpan sesi foto. Silakan coba lagi.');
    }
  };

  // Reset to Layar 1 for next wedding guest
  const handleNewSession = () => {
    setCapturedPhotos([]);
    setActiveSession(null);
    setSessionAssets([]);
    if (event) {
      window.history.pushState({}, '', `/e/${event.slug}`);
    }
    setCurrentScreen('landing');
  };

  // If on /admin route, render the complete Admin Portal
  if (isAdminRoute) {
    return <AdminApp />;
  }

  if (isLoading || !event) {
    return (
      <div className="w-full h-[100dvh] flex flex-col items-center justify-center bg-stone-950 text-white">
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-3" />
        <span className="font-serif italic text-sm text-stone-300">
          Memuat Wedding Photobooth...
        </span>
      </div>
    );
  }

  // Check event active window & status
  let inactiveReason: 'not_started' | 'ended' | 'inactive' | null = null;
  if (!isPreviewMode && event) {
    const now = new Date();
    if (event.status === 'nonaktif' || event.is_active === false) {
      inactiveReason = 'inactive';
    } else if (event.status === 'selesai') {
      inactiveReason = 'ended';
    } else if (event.active_from && now < new Date(event.active_from)) {
      inactiveReason = 'not_started';
    } else if (event.active_until && now > new Date(event.active_until)) {
      inactiveReason = 'ended';
    }
  }

  if (inactiveReason && event) {
    return (
      <EventInactiveScreen
        event={event}
        background={getScreenBackground('landing')}
        reason={inactiveReason}
        onForcePreview={() => setIsPreviewMode(true)}
      />
    );
  }

  // 11-Screen Flow Navigation
  return (
    <>
      {/* Session Creation Loading & Error Retry Overlay */}
      {(isSavingSession || saveSessionError) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/85 backdrop-blur-md p-4 text-white">
          <div className="glass-card max-w-sm w-full p-6 text-center space-y-4 border-2 border-white/40 shadow-2xl">
            {isSavingSession ? (
              <>
                <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
                <h3 className="font-serif font-bold text-lg text-white">
                  Menyiapkan Softfile Kamu
                </h3>
                <p className="text-xs text-stone-300">
                  Membuat kode foto unik, live photo, dan animasi frame...
                </p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center mx-auto text-rose-300 font-bold text-xl">
                  !
                </div>
                <h3 className="font-serif font-bold text-lg text-white">
                  Gagal Menyimpan Sesi
                </h3>
                <p className="text-xs text-rose-200">
                  {saveSessionError}
                </p>
                <div className="flex items-center space-x-3 pt-2">
                  <button
                    onClick={() => {
                      setSaveSessionError(null);
                      setIsSavingSession(false);
                    }}
                    className="flex-1 py-2 px-3 rounded-full border border-white/40 hover:bg-white/10 text-xs font-semibold cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    onClick={() => {
                      if (pendingFilter) {
                        handleProceedToSave(pendingFilter);
                      }
                    }}
                    className="flex-1 py-2 px-3 rounded-full border-2 border-black bg-amber-400 text-stone-950 hover:bg-amber-300 font-bold text-xs cursor-pointer shadow-md"
                  >
                    Coba Lagi
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {currentScreen === 'landing' && (
        <LandingScreen
          event={event}
          background={getScreenBackground('landing')}
          onStart={() => {
            if (event) {
              PhotoboothService.trackAnalyticsEvent({
                event_id: event.id,
                step: 'start',
                device_os: detectDeviceOS(),
                camera_facing: 'user',
              });
            }
            setCurrentScreen('howto');
          }}
        />
      )}

      {currentScreen === 'howto' && (
        <HowToScreen
          background={getScreenBackground('howto')}
          onBack={() => setCurrentScreen('landing')}
          onNext={() => setCurrentScreen('frame')}
        />
      )}

      {currentScreen === 'frame' && frames.length > 0 && (
        <FrameSelectScreen
          frames={frames}
          selectedFrame={selectedFrame || frames[0]}
          background={getScreenBackground('frame')}
          onSelectFrame={(f) => setSelectedFrame(f)}
          onBack={() => setCurrentScreen('howto')}
          onNext={() => {
            if (event) {
              PhotoboothService.trackAnalyticsEvent({
                event_id: event.id,
                step: 'frame',
                device_os: detectDeviceOS(),
                camera_facing: 'user',
              });
            }
            setCurrentScreen('camera');
          }}
        />
      )}

      {currentScreen === 'camera' && selectedFrame && (
        <CameraScreen
          frame={selectedFrame}
          background={getScreenBackground('camera')}
          initialMirror={mirror}
          countdownSeconds={settings?.countdown_seconds ?? 3}
          onBack={() => setCurrentScreen('frame')}
          onPhotosComplete={handlePhotosComplete}
        />
      )}

      {currentScreen === 'filter' && selectedFrame && filters.length > 0 && (
        <FilterSelectScreen
          frame={selectedFrame}
          photos={capturedPhotos}
          filters={filters}
          selectedFilter={selectedFilter || filters[0]}
          mirror={mirror}
          background={getScreenBackground('filter')}
          onSelectFilter={(f) => setSelectedFilter(f)}
          onBack={() => setCurrentScreen('camera')}
          onProceedToSave={handleProceedToSave}
        />
      )}

      {currentScreen === 'result' &&
        selectedFrame &&
        selectedFilter &&
        activeSession && (
          <ResultScreen
            event={event}
            frame={selectedFrame}
            filter={selectedFilter}
            session={activeSession}
            assets={sessionAssets}
            background={getScreenBackground('result')}
            onNewSession={handleNewSession}
          />
        )}
    </>
  );
}
