import React from 'react';
import { motion } from 'motion/react';
import { Event, ScreenBackground } from '../../types/photobooth';
import { ScreenContainer } from '../ScreenContainer';
import { Sparkles, Heart } from 'lucide-react';

interface LandingScreenProps {
  event: Event;
  background?: ScreenBackground;
  onStart: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  event,
  background,
  onStart,
}) => {
  // Extract date pieces if formatted e.g. "28 Oktober 2026"
  const dateStr = event.event_date || '28 Oktober 2026';
  const parts = dateStr.split(' ');
  const dayMonth = parts.length >= 2 ? `${parts[0]} ${parts[1].slice(0, 3)}` : '28/10';
  const year = parts.length >= 3 ? parts[parts.length - 1] : '2026';

  return (
    <ScreenContainer background={background}>
      <div className="flex flex-col justify-between h-full py-4 text-center">
        {/* Top Section: Date, Header, Script Names, Ornament */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="flex flex-col items-center pt-6 px-4"
        >
          {/* Date Left / Right banner */}
          <div className="flex items-center justify-between w-full max-w-[320px] px-2 mb-4">
            <span className="font-serif text-sm tracking-widest text-amber-200/90 uppercase">
              {dayMonth}
            </span>
            <span className="h-px w-10 bg-amber-200/40" />
            <Heart className="w-3.5 h-3.5 text-amber-300 fill-amber-300/40 mx-1" />
            <span className="h-px w-10 bg-amber-200/40" />
            <span className="font-serif text-sm tracking-widest text-amber-200/90 uppercase">
              {year}
            </span>
          </div>

          <p className="font-sans text-xs tracking-[0.35em] text-white/80 uppercase font-semibold mb-2">
            THE WEDDING OF
          </p>

          <h1 className="font-script text-6xl md:text-7xl text-white tracking-wide drop-shadow-md my-1 leading-tight">
            {event.couple_names}
          </h1>

          {/* Delicate ornament line */}
          <div className="flex items-center justify-center space-x-2 mt-2 opacity-80">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-amber-200" />
            <div className="w-1.5 h-1.5 rotate-45 border border-amber-300 bg-amber-100" />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-amber-200" />
          </div>
        </motion.div>

        {/* Center / Action Area: Mulai button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col items-center justify-center px-6 my-auto"
        >
          <button
            onClick={onStart}
            className="glass-pill-btn w-full max-w-[280px] py-4 px-8 flex items-center justify-center space-x-3 text-lg font-bold shadow-2xl active:scale-95 transition-all cursor-pointer group"
          >
            <Sparkles className="w-5 h-5 text-amber-600 transition-transform group-hover:rotate-12" />
            <span>Mulai</span>
          </button>
          <span className="mt-3 text-xs tracking-wider text-white/70 font-serif italic">
            Sentuh untuk memulai foto kenangan
          </span>
        </motion.div>

        {/* Bottom Section: Quote and Source in subtle glass card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="px-2 pb-2"
        >
          <div className="glass-panel-subtle rounded-2xl p-4 text-center max-w-[420px] mx-auto">
            <p className="font-serif text-[12px] leading-relaxed text-white/90 italic mb-2 line-clamp-3">
              "{event.quote_text}"
            </p>
            <p className="font-sans text-[11px] font-semibold text-amber-200/90 tracking-wider uppercase">
              — {event.quote_source}
            </p>
          </div>
        </motion.div>
      </div>
    </ScreenContainer>
  );
};
