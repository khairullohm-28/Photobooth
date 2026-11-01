import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Frame, ScreenBackground } from '../../types/photobooth';
import { ScreenContainer } from '../ScreenContainer';
import { FrameCanvasPreview } from '../FrameCanvasPreview';
import { SAMPLE_PHOTOS } from '../../data/seedData';
import { ArrowLeft, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface FrameSelectScreenProps {
  frames: Frame[];
  selectedFrame: Frame;
  background?: ScreenBackground;
  onSelectFrame: (frame: Frame) => void;
  onBack: () => void;
  onNext: () => void;
}

export const FrameSelectScreen: React.FC<FrameSelectScreenProps> = ({
  frames,
  selectedFrame,
  background,
  onSelectFrame,
  onBack,
  onNext,
}) => {
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = frames.findIndex((f) => f.id === selectedFrame.id);
    return idx >= 0 ? idx : 0;
  });

  const activeFrame = frames[currentIndex] || selectedFrame;

  const handlePrev = () => {
    if (currentIndex > 0) {
      const newIdx = currentIndex - 1;
      setCurrentIndex(newIdx);
      onSelectFrame(frames[newIdx]);
    }
  };

  const handleNext = () => {
    if (currentIndex < frames.length - 1) {
      const newIdx = currentIndex + 1;
      setCurrentIndex(newIdx);
      onSelectFrame(frames[newIdx]);
    }
  };

  const handleChoose = () => {
    onSelectFrame(activeFrame);
    onNext();
  };

  return (
    <ScreenContainer background={background}>
      <div className="flex flex-col justify-between h-full py-3 px-2">
        {/* Top Header */}
        <div className="flex items-center justify-between pt-1 pb-1">
          <div>
            <h2 className="font-sans font-extrabold italic text-2xl text-white tracking-tight leading-none">
              Pilih Frame
            </h2>
            <p className="text-[11px] text-amber-200/80 mt-1">
              Geser untuk memilih desain
            </p>
          </div>
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full glass-panel-subtle flex items-center justify-center text-white/90 active:scale-95 cursor-pointer"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Carousel Area */}
        <div className="relative my-auto flex flex-col items-center justify-center w-full">
          {/* Active Frame label */}
          <div className="mb-2 text-center">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-white/10 text-amber-200 border border-white/15">
              {activeFrame.name} • {activeFrame.photo_count} Pose
            </span>
          </div>

          <div className="relative w-full max-w-[310px] flex items-center justify-center">
            {/* Left navigation */}
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              aria-label="Sebelumnya"
              className={`absolute -left-2 z-30 w-8 h-8 rounded-full glass-panel flex items-center justify-center text-white transition-all cursor-pointer ${
                currentIndex === 0 ? 'opacity-20 pointer-events-none' : 'hover:scale-110 active:scale-90'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Frame Canvas Preview */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFrame.id}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.25 }}
                onClick={handleChoose}
                className="w-full cursor-pointer"
              >
                <div className="p-1 glass-card shadow-xl hover:border-amber-300/40 transition-colors">
                  <FrameCanvasPreview
                    frame={activeFrame}
                    photos={SAMPLE_PHOTOS}
                    className="max-h-[50vh] object-contain"
                  />
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Right navigation */}
            <button
              onClick={handleNext}
              disabled={currentIndex === frames.length - 1}
              aria-label="Berikutnya"
              className={`absolute -right-2 z-30 w-8 h-8 rounded-full glass-panel flex items-center justify-center text-white transition-all cursor-pointer ${
                currentIndex === frames.length - 1 ? 'opacity-20 pointer-events-none' : 'hover:scale-110 active:scale-90'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center justify-center space-x-1.5 mt-3">
            {frames.map((f, i) => (
              <button
                key={f.id}
                onClick={() => {
                  setCurrentIndex(i);
                  onSelectFrame(frames[i]);
                }}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === currentIndex ? 'w-5 bg-amber-300' : 'w-1.5 bg-white/30'
                }`}
                aria-label={`Frame ${f.name}`}
              />
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="pt-2 pb-1">
          <button
            onClick={handleChoose}
            className="glass-pill-btn w-full !min-h-[44px] py-2.5 px-5 flex items-center justify-center space-x-1.5 text-xs font-bold active:scale-95 cursor-pointer shadow-lg"
          >
            <Check className="w-4 h-4 text-amber-700 stroke-[3]" />
            <span>Pilih Frame Ini</span>
          </button>
        </div>
      </div>
    </ScreenContainer>
  );
};
