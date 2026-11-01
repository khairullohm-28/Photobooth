import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import {
  Event,
  Frame,
  Filter,
  Session,
  SessionAsset,
  ScreenBackground,
} from '../../types/photobooth';
import { ScreenContainer } from '../ScreenContainer';
import { FrameCanvasPreview } from '../FrameCanvasPreview';
import { formatCountdownTimer } from '../../utils/canvas';
import { PhotoboothService } from '../../services/supabase';
import { detectDeviceOS } from '../../utils/device';
import {
  Download,
  Share2,
  QrCode,
  Clock,
  RotateCcw,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';

interface ResultScreenProps {
  event: Event;
  frame: Frame;
  filter: Filter;
  session: Session;
  assets: SessionAsset[];
  background?: ScreenBackground;
  onNewSession: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  event,
  frame,
  filter,
  session,
  assets,
  background,
  onNewSession,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    return new Date(session.expires_at).getTime() - Date.now();
  });
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [copyToast, setCopyToast] = useState<boolean>(false);

  const displayCode = session.session_code || `${event.code_prefix || 'KL'}-0001`;

  const frameResultAsset = assets.find((a) => a.type === 'frame_result');
  const gifAsset = assets.find((a) => a.type === 'gif');
  const gifMp4Asset = assets.find((a) => a.type === 'gif_mp4');
  const liveClips = assets
    .filter((a) => a.type === 'live_photo')
    .sort((a, b) => (a.shot_index ?? 0) - (b.shot_index ?? 0))
    .map((a) => a.url);
  const rawPhotos = assets.filter((a) => a.type === 'raw_photo');
  const discardedPhotos = assets.filter((a) => a.type === 'retake_discarded');

  useEffect(() => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.5 },
        colors: ['#d4af37', '#ffffff', '#fbbf24'],
      });
    } catch {}
  }, []);

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareableUrl = `${currentUrl}/e/${event.slug}/s/${session.id}`;

  useEffect(() => {
    QRCode.toDataURL(shareableUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: '#1c1917',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.warn('QR error:', err));
  }, [shareableUrl]);

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = new Date(session.expires_at).getTime() - Date.now();
      setRemainingMs(diff);
    }, 1000);
    return () => clearInterval(timer);
  }, [session.expires_at]);

  const countdown = formatCountdownTimer(remainingMs);

  const downloadFile = (url: string, filename: string) => {
    try {
      PhotoboothService.trackAnalyticsEvent({
        event_id: event.id,
        session_id: session.id,
        step: 'download',
        device_os: detectDeviceOS(),
        camera_facing: session.mirror ? 'user' : 'environment',
      });
    } catch {}
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /**
   * Generates a composite PNG containing QR Code + Event Title + Photo Code
   * so the guest keeps the code even when the website is closed!
   */
  const handleDownloadQrWithCode = async () => {
    if (!qrDataUrl) return;

    try {
      PhotoboothService.trackAnalyticsEvent({
        event_id: event.id,
        session_id: session.id,
        step: 'download',
        device_os: detectDeviceOS(),
        camera_facing: session.mirror ? 'user' : 'environment',
      });
    } catch {}

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 760;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 600, 760);

    // Decorative border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, 568, 728);

    // Header: Event Title
    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 22px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '2px';
    ctx.fillText('WEDDING PHOTOBOOTH', 300, 64);

    ctx.font = 'italic 34px "Pinyon Script", cursive';
    ctx.fillStyle = '#1c1917';
    ctx.fillText(event.couple_names, 300, 108);

    // Load QR Image
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.onload = () => {
      ctx.drawImage(qrImg, 120, 140, 360, 360);

      // Photo Code Box at bottom
      ctx.fillStyle = '#f8f8f8';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(100, 520, 400, 100, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#666666';
      ctx.font = 'bold 13px "Inter", sans-serif';
      ctx.fillText('KODE FOTO ANDA', 300, 552);

      ctx.fillStyle = '#111111';
      ctx.font = 'bold 36px "Libre Baskerville", serif';
      ctx.fillText(displayCode, 300, 596);

      ctx.fillStyle = '#888888';
      ctx.font = '12px "Inter", sans-serif';
      ctx.fillText('Sebutkan kode ini ke operator untuk mencetak', 300, 650);
      ctx.fillText(event.event_date || '2026', 300, 680);

      const compositePngUrl = canvas.toDataURL('image/png');
      downloadFile(compositePngUrl, `qr-code-${displayCode}-${event.slug}.png`);
    };
    qrImg.src = qrDataUrl;
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setIsCopied(true);
      setCopyToast(true);
      setTimeout(() => setIsCopied(false), 2000);
      setTimeout(() => setCopyToast(false), 3000);
    } catch {
      // Fallback
    }
  };

  const shareOrDownload = async (url: string, title: string, filename: string) => {
    if (navigator.share) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: blob.type });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: title,
            text: `Wedding ${event.couple_names}`,
          });
          return;
        } else {
          await navigator.share({
            title: title,
            url: shareableUrl,
          });
          return;
        }
      } catch {}
    }
    downloadFile(url, filename);
  };

  // If expired: show notice and still show code!
  if (countdown.isExpired) {
    return (
      <ScreenContainer background={background}>
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <div className="glass-card p-6 max-w-[320px] w-full flex flex-col items-center shadow-2xl">
            <AlertTriangle className="w-10 h-10 text-rose-400 mb-3" />
            <h3 className="font-serif font-bold text-white text-base mb-1">
              Foto Sudah Dihapus
            </h3>
            <p className="text-[11px] text-white/70 mb-4 leading-relaxed">
              Masa simpan file untuk sesi ini telah berakhir sesuai batas waktu retensi.
            </p>

            {/* Still display code! */}
            <div className="p-3 rounded-xl bg-white/10 border-2 border-white/40 w-full mb-5">
              <span className="block text-[10px] tracking-widest text-amber-200 uppercase font-mono mb-0.5">
                KODE FOTO
              </span>
              <span className="font-serif font-bold text-xl text-white tracking-widest">
                {displayCode}
              </span>
            </div>

            <button
              onClick={onNewSession}
              className="glass-pill-btn w-full !min-h-[40px] text-xs font-semibold"
            >
              Mulai Sesi Baru
            </button>
          </div>
        </div>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer background={background} enableScroll={true}>
      <div className="w-full space-y-10 pb-12 pt-3 px-1 snap-y-mandatory">
        {/* Floating Copy Toast */}
        {copyToast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-stone-900 border-2 border-white text-white text-xs font-serif font-bold shadow-2xl animate-in fade-in slide-in-from-top-2 flex items-center space-x-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
            <span>Kode disalin</span>
          </div>
        )}

        {/* ==============================================================
            BAGIAN 6: DOWNLOAD SOFTFILE & QR CODE & KODE FOTO
           ============================================================== */}
        <section className="snap-start-section min-h-[92dvh] flex flex-col justify-between py-2">
          {/* 1. Judul */}
          <div className="text-center pt-1">
            <h2 className="font-sans font-extrabold italic text-2xl text-white tracking-tight">
              Download Softfile Foto Kamu
            </h2>
          </div>

          <div className="my-auto max-w-[320px] mx-auto w-full space-y-3">
            {/* 2. Kartu countdown hapus otomatis */}
            <div className="flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-200 text-center">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[11px] font-medium">Foto ini akan diHAPUS dalam:</span>
              <span className="font-mono font-bold text-xs tracking-wider text-rose-100">
                {countdown.formatted}
              </span>
            </div>

            {/* 3. Teks petunjuk */}
            <p className="text-center text-xs font-serif italic text-white/90">
              Simpan &amp; Scan untuk mengunduh semua file fotomu nanti!
            </p>

            {/* 4. Kartu glass QR code */}
            <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-white/60 text-center max-w-[240px] mx-auto">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code Softfile"
                  className="w-44 h-44 object-contain mx-auto"
                />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center bg-stone-100">
                  <QrCode className="w-10 h-10 text-stone-400 animate-pulse" />
                </div>
              )}
            </div>

            {/* 5. BARU: Blok "Kode Foto" tepat di bawah kartu QR */}
            <div className="glass-card p-3.5 text-center border-2 border-white/60 shadow-xl space-y-1">
              <span className="block text-[10px] font-mono uppercase tracking-[0.25em] text-amber-200 font-bold">
                KODE FOTO
              </span>

              <div className="flex items-center justify-center space-x-2 py-0.5">
                <span className="font-serif font-bold text-2xl text-white tracking-widest drop-shadow-sm">
                  {displayCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-lg border border-white/40 hover:bg-white/10 active:scale-95 text-white/90 transition-all cursor-pointer"
                  title="Salin kode foto"
                  aria-label="Salin kode foto"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <p className="text-[10px] text-white/80 font-sans leading-tight pt-0.5">
                Sebutkan kode ini ke operator untuk mencetak fotomu.
              </p>
            </div>

            {/* 6. Tombol Unduh Qr-Code (memuat kode foto di dalam PNG) */}
            <button
              onClick={handleDownloadQrWithCode}
              className="glass-pill-btn w-full !min-h-[44px] py-2.5 px-4 flex items-center justify-center space-x-2 text-xs font-bold active:scale-95 cursor-pointer shadow-xl"
            >
              <Download className="w-4 h-4 text-stone-900" />
              <span>Unduh Qr-Code</span>
            </button>
          </div>

          <div className="text-center pt-1">
            <span className="text-[10px] text-white/50 tracking-wider">
              ↓ Gulir untuk melihat semua hasil foto
            </span>
          </div>
        </section>

        {/* ==============================================================
            BAGIAN 7: HASIL FOTO FRAME
           ============================================================== */}
        <section className="snap-start-section min-h-[88dvh] flex flex-col justify-between py-4">
          <div className="text-center">
            <span className="text-[10px] font-mono text-amber-300 uppercase tracking-widest">
              HASIL FRAME • KODE {displayCode}
            </span>
            <h3 className="font-sans font-extrabold italic text-xl text-white tracking-tight mt-0.5">
              Hasil Foto Frame
            </h3>
          </div>

          <div className="my-auto max-w-[290px] mx-auto w-full p-1.5 glass-card shadow-2xl">
            {frameResultAsset ? (
              <img
                src={frameResultAsset.url}
                alt="Hasil Foto Frame"
                className="w-full rounded-lg object-contain shadow-md"
              />
            ) : (
              <FrameCanvasPreview
                frame={frame}
                photos={rawPhotos.map((p) => p.url)}
                filter={filter}
                mirror={session.mirror}
                className="w-full"
              />
            )}
          </div>

          <div className="px-3 pt-1">
            <button
              onClick={() => {
                const targetUrl = frameResultAsset?.url || '';
                if (targetUrl) {
                  shareOrDownload(
                    targetUrl,
                    `Foto Wedding ${event.couple_names} (${displayCode})`,
                    `frame-${displayCode}-${event.slug}.png`
                  );
                }
              }}
              className="glass-pill-btn w-full !min-h-[44px] py-2.5 px-5 flex items-center justify-center space-x-1.5 text-xs font-bold active:scale-95 cursor-pointer shadow-lg"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-700" />
              <span>Unduh &amp; Bagikan</span>
            </button>
          </div>
        </section>

        {/* ==============================================================
            BAGIAN 8: HASIL LIVE FOTO
           ============================================================== */}
        <section className="snap-start-section min-h-[88dvh] flex flex-col justify-between py-4">
          <div className="text-center">
            <h3 className="font-sans font-extrabold italic text-xl text-white tracking-tight">
              Live Foto
            </h3>
            <p className="text-[10px] text-white/60">
              Klip bergerak di setiap slot frame
            </p>
          </div>

          <div className="my-auto max-w-[290px] mx-auto w-full p-1.5 glass-card shadow-2xl">
            <FrameCanvasPreview
              frame={frame}
              photos={rawPhotos.map((p) => p.url)}
              filter={filter}
              mirror={session.mirror}
              isLivePhotoView={true}
              liveClips={liveClips}
              className="w-full"
            />
          </div>

          <div className="px-3 pt-1">
            <button
              onClick={() => {
                const clipUrl = liveClips[0] || frameResultAsset?.url;
                if (clipUrl) {
                  shareOrDownload(
                    clipUrl,
                    `Live Foto Wedding ${event.couple_names} (${displayCode})`,
                    `livephoto-${displayCode}-${event.slug}.webm`
                  );
                }
              }}
              className="glass-pill-btn w-full !min-h-[44px] py-2.5 px-5 flex items-center justify-center space-x-1.5 text-xs font-bold active:scale-95 cursor-pointer shadow-lg"
            >
              <Download className="w-3.5 h-3.5 text-amber-700" />
              <span>Unduh Live Foto</span>
            </button>
          </div>
        </section>

        {/* ==============================================================
            BAGIAN 9: HASIL GIF
           ============================================================== */}
        <section className="snap-start-section min-h-[88dvh] flex flex-col justify-between py-4">
          <div className="text-center">
            <h3 className="font-sans font-extrabold italic text-xl text-white tracking-tight">
              Animasi GIF
            </h3>
            <p className="text-[10px] text-white/60">
              Loop otomatis dari seluruh pose
            </p>
          </div>

          <div className="my-auto max-w-[270px] mx-auto w-full p-1.5 glass-card shadow-xl">
            {gifAsset ? (
              <img
                src={gifAsset.url}
                alt="GIF Photobooth"
                className="w-full aspect-[4/5] object-cover rounded-lg shadow-md mx-auto"
              />
            ) : gifMp4Asset ? (
              <video
                src={gifMp4Asset.url}
                autoPlay
                loop
                muted
                playsInline
                className="w-full aspect-[4/5] object-cover rounded-lg shadow-md mx-auto"
              />
            ) : (
              <div className="w-full aspect-[4/5] flex items-center justify-center bg-stone-900 rounded-lg text-stone-400 text-xs">
                Menyiapkan GIF...
              </div>
            )}
          </div>

          <div className="px-3 pt-1">
            <button
              onClick={() => {
                const url = gifAsset?.url || gifMp4Asset?.url || '';
                if (url) {
                  downloadFile(url, `wedding-loop-${displayCode}-${event.slug}.gif`);
                }
              }}
              className="glass-pill-btn w-full !min-h-[44px] py-2.5 px-5 flex items-center justify-center space-x-1.5 text-xs font-bold active:scale-95 cursor-pointer shadow-lg"
            >
              <Download className="w-3.5 h-3.5 text-amber-700" />
              <span>Unduh GIF</span>
            </button>
          </div>
        </section>

        {/* ==============================================================
            BAGIAN 10+: RAW PHOTOS
           ============================================================== */}
        <section className="snap-start-section min-h-[88dvh] flex flex-col justify-between py-4">
          <div className="text-center mb-3">
            <h3 className="font-sans font-extrabold italic text-xl text-white tracking-tight">
              Foto Satuan
            </h3>
            <p className="text-[10px] text-white/60">
              Semua file foto mentah resolusi asli
            </p>
          </div>

          <div className="space-y-2.5 max-w-[310px] mx-auto w-full px-1">
            {rawPhotos.map((photo, i) => (
              <div
                key={`raw-${photo.id || i}`}
                className="glass-card p-2.5 flex items-center justify-between gap-2.5"
              >
                <div className="relative w-12 h-14 rounded-md overflow-hidden bg-stone-900 shrink-0 border border-white/20">
                  <img
                    src={photo.url}
                    alt={`Foto ${i + 1}`}
                    className="w-full h-full object-cover"
                    style={{ transform: session.mirror ? 'scaleX(-1)' : 'none' }}
                  />
                </div>
                <div className="flex-1 text-left">
                  <span className="font-semibold text-xs text-white">
                    Pose #{(photo.shot_index ?? i) + 1}
                  </span>
                  <span className="block text-[9px] text-amber-200">Foto Utama</span>
                </div>
                <button
                  onClick={() =>
                    downloadFile(
                      photo.url,
                      `foto-${displayCode}-${i + 1}-${event.slug}.jpg`
                    )
                  }
                  className="glass-outline-btn !min-h-[32px] !py-1 !px-3 text-[11px] flex items-center space-x-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Unduh</span>
                </button>
              </div>
            ))}

            {/* Retake discarded photos */}
            {discardedPhotos.length > 0 && (
              <div className="pt-2">
                <span className="block text-[9px] font-semibold text-rose-300 uppercase tracking-wider mb-1.5">
                  Foto Retake:
                </span>
                {discardedPhotos.map((disc, idx) => (
                  <div
                    key={`disc-${idx}`}
                    className="glass-card p-2 mb-1.5 flex items-center justify-between gap-2 opacity-85"
                  >
                    <div className="w-10 h-12 rounded-md overflow-hidden bg-stone-900 shrink-0 border border-rose-400/30">
                      <img
                        src={disc.url}
                        alt={`Retake ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-[11px] text-white">
                        Retake Pose #{(disc.shot_index ?? 0) + 1}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        downloadFile(
                          disc.url,
                          `retake-${displayCode}-${idx + 1}-${event.slug}.jpg`
                        )
                      }
                      className="glass-outline-btn !min-h-[28px] !py-1 !px-2.5 text-[10px]"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 px-2">
            <button
              onClick={onNewSession}
              className="glass-outline-btn w-full !min-h-[42px] py-2 px-5 flex items-center justify-center space-x-1.5 text-xs font-semibold active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mulai Sesi Baru</span>
            </button>
          </div>
        </section>
      </div>
    </ScreenContainer>
  );
};
