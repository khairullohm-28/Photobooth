import React, { useRef, useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Event } from '../../types/photobooth';
import { AppSettings } from '../../types/admin';
import { Printer, Download, X, Copy, Check, Sparkles, Camera, QrCode as QrIcon } from 'lucide-react';
import { useToast } from './Toast';

interface QrPosterModalProps {
  isOpen: boolean;
  event: Event;
  appSettings: AppSettings;
  guestUrl: string;
  onClose: () => void;
}

export const QrPosterModal: React.FC<QrPosterModalProps> = ({
  isOpen,
  event,
  appSettings,
  guestUrl,
  onClose,
}) => {
  const { addToast } = useToast();
  const [paperSize, setPaperSize] = useState<'A4' | 'A5'>('A4');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrSvgString, setQrSvgString] = useState<string>('');
  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !guestUrl) return;

    // Generate high resolution PNG QR
    QRCode.toDataURL(guestUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 1024,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((e) => console.warn('QR DataURL error:', e));

    // Generate clean vector SVG QR
    QRCode.toString(guestUrl, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    })
      .then((svg) => setQrSvgString(svg))
      .catch((e) => console.warn('QR SVG error:', e));
  }, [isOpen, guestUrl]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${event.slug}.png`;
    a.click();
    addToast('QR Code PNG berhasil diunduh', 'success');
  };

  const handleDownloadSvg = () => {
    if (!qrSvgString) return;
    const blob = new Blob([qrSvgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR_${event.slug}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('QR Code SVG berhasil diunduh', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto">
      {/* Modal Card */}
      <div className="bg-white rounded-3xl border-2 border-black max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Top Control Bar (Hidden during print) */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 bg-stone-50 print:hidden">
          <div>
            <h2 className="font-serif font-bold text-lg text-stone-900 tracking-tight">
              Poster QR Photobooth
            </h2>
            <p className="font-sans text-xs text-stone-500">
              Format cetak siap pakai untuk diletakkan di meja resepsi atau booth
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Paper Size Switcher */}
            <div className="flex items-center bg-stone-200/80 rounded-full p-0.5 border border-stone-300">
              <button
                type="button"
                onClick={() => setPaperSize('A4')}
                className={`px-3 py-1 rounded-full text-xs font-serif font-bold transition-all cursor-pointer ${
                  paperSize === 'A4'
                    ? 'bg-black text-white shadow-xs'
                    : 'text-stone-700 hover:text-black'
                }`}
              >
                Ukuran A4
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('A5')}
                className={`px-3 py-1 rounded-full text-xs font-serif font-bold transition-all cursor-pointer ${
                  paperSize === 'A5'
                    ? 'bg-black text-white shadow-xs'
                    : 'text-stone-700 hover:text-black'
                }`}
              >
                Ukuran A5
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadPng}
              className="p-2 rounded-full border border-stone-300 hover:border-black bg-white text-stone-700 hover:text-black transition-colors"
              title="Unduh QR PNG"
              aria-label="Unduh QR PNG"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-full border-2 border-black bg-stone-900 hover:bg-black text-white text-xs font-bold font-sans flex items-center space-x-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Poster</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-stone-300 hover:border-black flex items-center justify-center text-stone-500 hover:text-black cursor-pointer ml-1"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Poster Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-stone-200/50 flex justify-center">
          <div
            ref={posterRef}
            id="printable-poster"
            className={`bg-white text-stone-900 border-2 border-black rounded-3xl p-8 sm:p-12 shadow-xl flex flex-col justify-between items-center text-center transition-all ${
              paperSize === 'A4'
                ? 'w-full max-w-[580px] min-h-[820px]'
                : 'w-full max-w-[460px] min-h-[650px]'
            }`}
          >
            {/* Header: Studio Branding & Decorative Border */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-center space-x-2 mb-2">
                {appSettings.logo_url ? (
                  <img
                    src={appSettings.logo_url}
                    alt={appSettings.company_name}
                    className="h-10 w-auto object-contain"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center font-serif font-black text-sm bg-stone-100">
                    PB
                  </div>
                )}
                <span className="font-serif font-bold text-xs uppercase tracking-widest text-stone-500">
                  {appSettings.company_name}
                </span>
              </div>

              <div className="h-0.5 w-16 bg-stone-900 mx-auto" />

              <h1 className="font-serif font-bold text-2xl sm:text-3xl text-stone-950 tracking-tight mt-3">
                {event.name}
              </h1>
              <p className="font-serif italic text-sm text-stone-600">
                {event.couple_names} • {event.event_date}
              </p>
            </div>

            {/* Center: Large High-Res QR Code Card */}
            <div className="my-6 p-5 sm:p-6 rounded-3xl border-2 border-black bg-stone-50 shadow-md flex flex-col items-center">
              <div className="w-48 h-48 sm:w-60 sm:h-60 rounded-2xl overflow-hidden bg-white border border-stone-300 p-2 shadow-inner">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code ${event.name}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400">
                    <QrIcon className="w-12 h-12 animate-pulse" />
                  </div>
                )}
              </div>

              <div className="mt-3 text-center">
                <span className="font-mono text-[11px] font-bold text-stone-600 bg-white px-3 py-1 rounded-full border border-stone-300 inline-block shadow-2xs">
                  {guestUrl}
                </span>
                <p className="font-serif text-[11px] text-stone-500 mt-1.5">
                  Scan kamera ponsel Anda tanpa perlu download aplikasi
                </p>
              </div>
            </div>

            {/* Bottom: 4 Simple Steps */}
            <div className="w-full border-t-2 border-stone-200 pt-6">
              <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-stone-400 mb-4">
                4 Langkah Mudah Berfoto
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-2xl border border-stone-200 bg-stone-50/70">
                  <div className="w-7 h-7 rounded-full bg-stone-900 text-white font-mono font-bold text-xs flex items-center justify-center mx-auto mb-1.5 shadow-2xs">
                    1
                  </div>
                  <h5 className="font-serif font-bold text-[11px] text-stone-900 leading-tight">
                    Scan QR
                  </h5>
                  <p className="text-[10px] text-stone-500 mt-0.5 leading-tight">
                    Buka kamera HP
                  </p>
                </div>

                <div className="p-3 rounded-2xl border border-stone-200 bg-stone-50/70">
                  <div className="w-7 h-7 rounded-full bg-stone-900 text-white font-mono font-bold text-xs flex items-center justify-center mx-auto mb-1.5 shadow-2xs">
                    2
                  </div>
                  <h5 className="font-serif font-bold text-[11px] text-stone-900 leading-tight">
                    Pilih Frame
                  </h5>
                  <p className="text-[10px] text-stone-500 mt-0.5 leading-tight">
                    Desain favorit
                  </p>
                </div>

                <div className="p-3 rounded-2xl border border-stone-200 bg-stone-50/70">
                  <div className="w-7 h-7 rounded-full bg-stone-900 text-white font-mono font-bold text-xs flex items-center justify-center mx-auto mb-1.5 shadow-2xs">
                    3
                  </div>
                  <h5 className="font-serif font-bold text-[11px] text-stone-900 leading-tight">
                    Ambil Pose
                  </h5>
                  <p className="text-[10px] text-stone-500 mt-0.5 leading-tight">
                    Hitungan 3 detik
                  </p>
                </div>

                <div className="p-3 rounded-2xl border border-stone-200 bg-stone-50/70">
                  <div className="w-7 h-7 rounded-full bg-stone-900 text-white font-mono font-bold text-xs flex items-center justify-center mx-auto mb-1.5 shadow-2xs">
                    4
                  </div>
                  <h5 className="font-serif font-bold text-[11px] text-stone-900 leading-tight">
                    Simpan &amp; QR
                  </h5>
                  <p className="text-[10px] text-stone-500 mt-0.5 leading-tight">
                    Unduh softfile
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
