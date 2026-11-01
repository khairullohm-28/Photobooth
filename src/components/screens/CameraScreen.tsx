import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Frame, ScreenBackground, CapturedPhoto } from '../../types/photobooth';
import { ScreenContainer } from '../ScreenContainer';
import { FrameCanvasPreview } from '../FrameCanvasPreview';
import {
  Camera as CameraIcon,
  RotateCcw,
  FlipHorizontal,
  Zap,
  ZapOff,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Check,
} from 'lucide-react';

interface CameraScreenProps {
  frame: Frame;
  background?: ScreenBackground;
  initialMirror?: boolean;
  countdownSeconds?: number;
  onBack: () => void;
  onPhotosComplete: (photos: CapturedPhoto[], mirror: boolean) => void;
}

type FlashMode = 'auto' | 'on' | 'off';

export const CameraScreen: React.FC<CameraScreenProps> = ({
  frame,
  background,
  initialMirror = true,
  countdownSeconds = 3,
  onBack,
  onPhotosComplete,
}) => {
  // Camera settings
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flashMode, setFlashMode] = useState<FlashMode>('auto');
  const [mirror, setMirror] = useState<boolean>(initialMirror);

  // Stream & Video refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Camera states
  const [cameraState, setCameraState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isInAppBrowser, setIsInAppBrowser] = useState<boolean>(false);

  // Shooting states
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [activeShotIndex, setActiveShotIndex] = useState<number>(0);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [countdownNumber, setCountdownNumber] = useState<number>(countdownSeconds);
  const [showScreenFlash, setShowScreenFlash] = useState<boolean>(false);
  const [retakeTargetIndex, setRetakeTargetIndex] = useState<number | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const totalShots = frame.photo_count;

  // Detect in-app browser
  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isIAB = /FBAN|FBAV|Instagram|Line|Twitter|MicroMessenger/i.test(ua);
    setIsInAppBrowser(isIAB);
  }, []);

  // Initialize Camera
  const startCamera = useCallback(async () => {
    setCameraState('loading');
    setErrorMessage('');

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamera tidak didukung');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('ready');
    } catch (err: any) {
      console.warn('Camera notice:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Izin kamera ditolak');
      } else {
        setErrorMessage('Kamera tidak dapat diakses');
      }
      setCameraState('error');
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera]);

  // Flash luminance check
  const checkLowLuminance = (): boolean => {
    if (!videoRef.current) return false;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.drawImage(videoRef.current, 0, 0, 48, 48);
      const imgData = ctx.getImageData(0, 0, 48, 48);
      let totalLuminance = 0;
      for (let i = 0; i < imgData.data.length; i += 4) {
        totalLuminance +=
          0.299 * imgData.data[i] +
          0.587 * imgData.data[i + 1] +
          0.114 * imgData.data[i + 2];
      }
      return totalLuminance / (48 * 48) < 85;
    } catch {
      return false;
    }
  };

  const triggerFlash = async () => {
    const shouldFlash =
      flashMode === 'on' || (flashMode === 'auto' && checkLowLuminance());

    if (!shouldFlash) return;

    if (facingMode === 'environment' && streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as any;
      if (capabilities && 'torch' in capabilities) {
        try {
          await (track as any).applyConstraints({ advanced: [{ torch: true }] });
          setTimeout(async () => {
            try {
              await (track as any).applyConstraints({ advanced: [{ torch: false }] });
            } catch {}
          }, 300);
          return;
        } catch {}
      }
    }

    setShowScreenFlash(true);
    setTimeout(() => setShowScreenFlash(false), 200);
  };

  // Record 1.5s Live Photo
  const recordLivePhotoClip = (): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (!streamRef.current) return resolve(undefined);

      try {
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4';

        const recorder = new MediaRecorder(streamRef.current, { mimeType });
        recordedChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          resolve(URL.createObjectURL(blob));
        };

        recorder.start();
        setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, 1500);
      } catch {
        resolve(undefined);
      }
    });
  };

  // Capture still image
  const captureStillPhoto = (): string => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');

    if (video && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.92);
      }
    }

    // Mock photo generator for testing / headless simulation
    canvas.width = 720;
    canvas.height = 960;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 720, 960);
      gradient.addColorStop(0, '#1c1917');
      gradient.addColorStop(0.5, '#44403c');
      gradient.addColorStop(1, '#1c1917');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 720, 960);

      ctx.fillStyle = '#f5eedb';
      ctx.font = 'bold 36px "Libre Baskerville", serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Khai & Lila`, 360, 440);
      ctx.font = '22px "Inter", sans-serif';
      ctx.fillStyle = '#d4af37';
      ctx.fillText(`Pose #${(retakeTargetIndex ?? activeShotIndex) + 1}`, 360, 490);
      return canvas.toDataURL('image/jpeg', 0.92);
    }

    return '';
  };

  // Take photo sequence
  const takeShot = async (targetShot: number) => {
    setIsCountingDown(true);
    let count = countdownSeconds;
    setCountdownNumber(count);

    const clipPromise = recordLivePhotoClip();

    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownNumber(count);
      } else {
        clearInterval(interval);
        triggerFlash();
        const photoData = captureStillPhoto();

        clipPromise.then((clipUrl) => {
          const newPhoto: CapturedPhoto = {
            id: `photo_${Date.now()}_${targetShot}`,
            shot_index: targetShot,
            data_url: photoData,
            video_clip_url: clipUrl,
            timestamp: Date.now(),
          };

          setCapturedPhotos((prev) => {
            const updated = prev.map((p) => {
              if (p.shot_index === targetShot && !p.is_discarded) {
                return { ...p, is_discarded: true };
              }
              return p;
            });
            return [...updated, newPhoto];
          });

          setIsCountingDown(false);

          if (retakeTargetIndex !== null) {
            setRetakeTargetIndex(null);
          } else {
            const nextShot = targetShot + 1;
            if (nextShot < totalShots) {
              setActiveShotIndex(nextShot);
              setTimeout(() => {
                takeShot(nextShot);
              }, 1000);
            } else {
              setActiveShotIndex(totalShots);
            }
          }
        });
      }
    }, 1000);
  };

  const handleStartCapture = () => {
    if (isCountingDown) return;
    const target = retakeTargetIndex !== null ? retakeTargetIndex : activeShotIndex;
    if (target < totalShots || retakeTargetIndex !== null) {
      takeShot(target);
    }
  };

  // Group latest photos
  const uniquePhotosMap = new Map<number, CapturedPhoto>();
  capturedPhotos.forEach((p) => {
    if (!p.is_discarded) {
      uniquePhotosMap.set(p.shot_index, p);
    }
  });

  const allShotsTaken = Array.from({ length: totalShots }).every((_, i) =>
    uniquePhotosMap.has(i)
  );

  const miniPreviewPhotos = Array.from({ length: totalShots }).map(
    (_, i) => uniquePhotosMap.get(i)?.data_url || null
  );

  const handleResetAll = () => {
    setCapturedPhotos([]);
    setActiveShotIndex(0);
    setRetakeTargetIndex(null);
  };

  const handleBackClick = () => {
    if (capturedPhotos.length > 0) {
      setShowExitConfirm(true);
    } else {
      onBack();
    }
  };

  const cycleFlash = () => {
    setFlashMode((prev) => (prev === 'auto' ? 'on' : prev === 'on' ? 'off' : 'auto'));
  };

  const toggleFacing = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  return (
    <ScreenContainer background={background}>
      <div className="relative flex flex-col justify-between h-full py-2 px-1">
        {/* Flash screen overlay */}
        {showScreenFlash && (
          <div className="fixed inset-0 z-50 bg-white pointer-events-none transition-opacity duration-150" />
        )}

        {/* 1. Sleek Top Bar (Minimalist, compact, non-intrusive) */}
        <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-1 z-20">
          <button
            onClick={handleBackClick}
            className="w-9 h-9 rounded-full glass-panel-subtle flex items-center justify-center text-white/90 active:scale-90 transition-transform cursor-pointer"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Quick controls pill */}
          <div className="flex items-center space-x-1.5 p-1 rounded-full glass-panel-subtle">
            {/* Camera facing */}
            <button
              onClick={toggleFacing}
              className="px-2.5 py-1 rounded-full flex items-center space-x-1 text-[11px] font-medium text-white/90 active:scale-95 transition-all cursor-pointer hover:bg-white/10"
              aria-label="Ganti kamera"
            >
              <RefreshCw className="w-3 h-3 text-amber-300" />
              <span>{facingMode === 'user' ? 'Depan' : 'Belakang'}</span>
            </button>

            {/* Flash toggle */}
            <button
              onClick={cycleFlash}
              className="px-2.5 py-1 rounded-full flex items-center space-x-1 text-[11px] font-medium text-white/90 active:scale-95 transition-all cursor-pointer hover:bg-white/10"
              aria-label="Atur flash"
            >
              {flashMode === 'auto' ? (
                <>
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Auto</span>
                </>
              ) : flashMode === 'on' ? (
                <>
                  <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>Aktif</span>
                </>
              ) : (
                <>
                  <ZapOff className="w-3 h-3 text-stone-400" />
                  <span className="text-white/60">Off</span>
                </>
              )}
            </button>

            {/* Mirror toggle */}
            <button
              onClick={() => setMirror(!mirror)}
              className={`px-2.5 py-1 rounded-full flex items-center space-x-1 text-[11px] font-medium transition-all active:scale-95 cursor-pointer ${
                mirror ? 'bg-white/15 text-amber-200' : 'text-white/60 hover:bg-white/10'
              }`}
              aria-label="Toggle cermin"
            >
              <FlipHorizontal className="w-3 h-3" />
              <span>{mirror ? 'Mirror' : 'Asli'}</span>
            </button>
          </div>
        </div>

        {/* 2. Main Viewport Area (Clean, spacious, high-end frame crop) */}
        <div
          onClick={handleStartCapture}
          className="relative w-full my-auto flex items-center justify-center cursor-pointer group px-2"
        >
          <div className="relative w-full max-w-[340px] aspect-[3/4] overflow-hidden rounded-2xl glass-panel shadow-2xl bg-black border border-white/20 flex items-center justify-center">
            {/* Live Camera Stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transition-transform duration-200"
              style={{
                transform: mirror ? 'scaleX(-1)' : 'none',
              }}
            />

            {/* Concise Overlay Prompt */}
            {cameraState === 'ready' && !isCountingDown && (
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-5 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none">
                <div className="px-3.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-center">
                  <span className="text-xs text-white/90 font-medium">
                    {retakeTargetIndex !== null
                      ? `Ambil ulang pose ${retakeTargetIndex + 1}`
                      : allShotsTaken
                      ? 'Semua pose siap • Tap Lanjut'
                      : `Pose ${activeShotIndex + 1} dari ${totalShots} • Ketuk untuk foto`}
                  </span>
                </div>
              </div>
            )}

            {/* Countdown Overlay */}
            <AnimatePresence>
              {isCountingDown && (
                <motion.div
                  key="countdown"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.4, opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/35 z-30 pointer-events-none"
                >
                  <span className="font-serif italic font-bold text-7xl text-white drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]">
                    {countdownNumber}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Minimalist Error / Simulation Fallback */}
            {cameraState === 'error' && (
              <div className="absolute inset-0 p-5 flex flex-col items-center justify-center text-center bg-stone-950/95 z-30">
                <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
                <h4 className="font-semibold text-white text-sm mb-1">
                  Kamera Perlu Izin
                </h4>
                <p className="text-[11px] text-white/70 mb-4 max-w-[220px]">
                  {errorMessage || 'Aktifkan izin kamera pada browser.'}
                </p>
                {isInAppBrowser && (
                  <div className="p-2 mb-3 rounded-lg bg-amber-500/10 border border-amber-400/20 text-amber-200 text-[10px] max-w-[240px]">
                    Buka di <strong>Safari</strong> atau <strong>Chrome</strong>.
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startCamera();
                    }}
                    className="glass-pill-btn !min-h-[36px] px-3.5 py-1 text-xs"
                  >
                    Coba Lagi
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCameraState('ready');
                    }}
                    className="glass-outline-btn !min-h-[36px] px-3.5 py-1 text-xs"
                  >
                    Mode Simulasi
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Bottom Area (Neat 2-layer layout: Retake & Mini-Preview, then Controls) */}
        <div className="flex flex-col gap-2.5 px-3 pt-1 pb-1">
          {/* Layer A: Compact Retake Tray + Clean Mini Preview */}
          <div className="flex items-center justify-between gap-3">
            {/* Retake thumbnails */}
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-semibold text-amber-200/90 tracking-wider uppercase">
                Pose:
              </span>
              <div className="flex items-center space-x-1.5">
                {Array.from({ length: totalShots }).map((_, shotIdx) => {
                  const photo = uniquePhotosMap.get(shotIdx);
                  const isSelectedForRetake = retakeTargetIndex === shotIdx;

                  return (
                    <button
                      key={`retake-${shotIdx}`}
                      onClick={() => {
                        if (photo) setRetakeTargetIndex(shotIdx);
                      }}
                      className={`relative w-10 h-11 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                        isSelectedForRetake
                          ? 'border-amber-400 ring-2 ring-amber-300/60 scale-105'
                          : photo
                          ? 'border-white/40 hover:border-amber-200'
                          : 'border-white/15 bg-stone-900/80'
                      }`}
                      aria-label={`Retake pose ${shotIdx + 1}`}
                    >
                      {photo ? (
                        <img
                          src={photo.data_url}
                          alt={`Pose ${shotIdx + 1}`}
                          className="w-full h-full object-cover"
                          style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-white/40 font-mono">
                          #{shotIdx + 1}
                        </div>
                      )}
                      {isSelectedForRetake && (
                        <div className="absolute inset-0 bg-amber-500/40 flex items-center justify-center">
                          <RotateCcw className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mini preview */}
            <div className="w-11 shrink-0 rounded-lg overflow-hidden shadow-lg border border-white/20">
              <FrameCanvasPreview
                frame={frame}
                photos={miniPreviewPhotos}
                mirror={mirror}
                className="w-full"
              />
            </div>
          </div>

          {/* Layer B: Action Controls (Ulang - Luxury Shutter Button - Lanjut) */}
          <div className="flex items-center justify-between px-2 pt-1 pb-1">
            {/* Ulang Semua */}
            <div className="w-20 flex justify-start">
              {capturedPhotos.length > 0 && (
                <button
                  onClick={handleResetAll}
                  disabled={isCountingDown}
                  className="w-9 h-9 rounded-full glass-outline-btn !p-0 flex items-center justify-center text-white/80 hover:text-white cursor-pointer active:scale-90"
                  aria-label="Ulang semua foto"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Center: Luxury Camera Shutter Button */}
            <div className="flex flex-col items-center">
              <button
                onClick={handleStartCapture}
                disabled={isCountingDown}
                className="shutter-btn group"
                aria-label="Ambil foto"
              >
                <div className="shutter-btn-inner" />
              </button>
            </div>

            {/* Lanjut */}
            <div className="w-20 flex justify-end">
              <button
                onClick={() => onPhotosComplete(capturedPhotos, mirror)}
                disabled={!allShotsTaken || isCountingDown}
                className={`glass-pill-btn !min-h-[38px] !px-3.5 !py-1.5 flex items-center space-x-1 text-xs font-semibold cursor-pointer shadow-lg transition-all ${
                  !allShotsTaken
                    ? 'opacity-30 pointer-events-none'
                    : 'hover:scale-105 active:scale-95'
                }`}
              >
                <span>Lanjut</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Exit Confirmation Dialog */}
        <AnimatePresence>
          {showExitConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <div className="glass-card max-w-[280px] w-full p-4 text-center">
                <h4 className="font-serif font-bold text-white text-sm mb-1">
                  Kembali ke Frame?
                </h4>
                <p className="text-[11px] text-white/70 mb-4 leading-relaxed">
                  Foto yang telah diambil akan diulang.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowExitConfirm(false)}
                    className="glass-outline-btn flex-1 !min-h-[36px] py-1 text-xs"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => {
                      setShowExitConfirm(false);
                      onBack();
                    }}
                    className="glass-pill-btn flex-1 !min-h-[36px] py-1 text-xs !bg-stone-100 !text-stone-900"
                  >
                    Ya, Keluar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ScreenContainer>
  );
};
