import React from 'react';
import { motion } from 'motion/react';
import { Event, ScreenBackground } from '../../types/photobooth';
import { ScreenContainer } from '../ScreenContainer';
import { Clock, AlertCircle, RefreshCw, Eye } from 'lucide-react';

interface EventInactiveScreenProps {
  event: Event;
  background?: ScreenBackground;
  reason: 'not_started' | 'ended' | 'inactive';
  onForcePreview?: () => void;
}

export const EventInactiveScreen: React.FC<EventInactiveScreenProps> = ({
  event,
  background,
  reason,
  onForcePreview,
}) => {
  const getMessage = () => {
    switch (reason) {
      case 'not_started':
        return {
          title: 'Photobooth Belum Aktif',
          desc: `Acara ${event.name} dijadwalkan mulai pada ${
            event.active_from
              ? new Date(event.active_from).toLocaleString('id-ID', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : event.event_date
          }. Silakan kembali lagi nanti!`,
        };
      case 'ended':
        return {
          title: 'Photobooth Sudah Berakhir',
          desc: `Masa aktif photobooth untuk ${event.name} telah selesai. Terima kasih atas partisipasi dan kenangan indah Anda!`,
        };
      case 'inactive':
      default:
        return {
          title: 'Photobooth Sedang Dinonaktifkan',
          desc: `Photobooth untuk ${event.name} saat ini sedang dalam pemeliharaan atau dinonaktifkan oleh penyelenggara acara.`,
        };
    }
  };

  const { title, desc } = getMessage();

  return (
    <ScreenContainer background={background}>
      <div className="flex flex-col justify-between h-full py-8 px-4 text-center">
        <div className="pt-8">
          <p className="font-sans text-xs tracking-[0.3em] text-white/70 uppercase font-semibold">
            THE WEDDING OF
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl text-white font-bold tracking-tight mt-1">
            {event.couple_names}
          </h1>
          <p className="font-sans text-xs text-amber-200/90 mt-1">
            {event.event_date}
          </p>
        </div>

        {/* Center Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="glass-card max-w-[340px] w-full mx-auto p-6 flex flex-col items-center my-auto shadow-2xl"
        >
          <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 mb-4 shadow-inner">
            <Clock className="w-7 h-7" />
          </div>

          <h2 className="font-serif font-bold text-lg text-white mb-2 leading-tight">
            {title}
          </h2>

          <p className="font-sans text-xs text-white/80 leading-relaxed mb-6">
            {desc}
          </p>

          <div className="w-full space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="glass-pill-btn w-full py-2.5 px-4 flex items-center justify-center space-x-2 text-xs font-bold active:scale-95 cursor-pointer shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Muat Ulang Halaman</span>
            </button>

            {onForcePreview && (
              <button
                onClick={onForcePreview}
                className="w-full py-2 px-3 rounded-full border border-white/25 hover:border-white text-white/80 hover:text-white text-[11px] font-sans font-medium flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Masuk Mode Preview (Admin)</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-[11px] text-white/50 font-serif">
          Photobooth Pernikahan • {event.code_prefix}
        </div>
      </div>
    </ScreenContainer>
  );
};
