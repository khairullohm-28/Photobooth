import React from 'react';
import { motion } from 'motion/react';
import { ScreenBackground } from '../../types/photobooth';
import { ScreenContainer } from '../ScreenContainer';
import { LayoutGrid, FlipHorizontal, Camera, Wand2, Download, ArrowLeft, ArrowRight } from 'lucide-react';

interface HowToScreenProps {
  background?: ScreenBackground;
  onBack: () => void;
  onNext: () => void;
}

const STEPS = [
  { num: '01', title: 'Pilih Frame', desc: 'Pilih desain bingkai', icon: LayoutGrid },
  { num: '02', title: 'Mirror', desc: 'Atur cermin foto', icon: FlipHorizontal },
  { num: '03', title: 'Ambil Pose', desc: 'Ketuk untuk berfoto', icon: Camera },
  { num: '04', title: 'Pilih Filter', desc: 'Tentukan tone warna', icon: Wand2 },
  { num: '05', title: 'Simpan & QR', desc: 'Unduh softfile hasil', icon: Download },
];

export const HowToScreen: React.FC<HowToScreenProps> = ({
  background,
  onBack,
  onNext,
}) => {
  return (
    <ScreenContainer background={background}>
      <div className="flex flex-col justify-between h-full py-4 px-2">
        {/* Header - Concise & Clean */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-2"
        >
          <span className="text-[10px] font-semibold tracking-[0.25em] text-amber-200/90 uppercase">
            Panduan
          </span>
          <h2 className="font-sans font-extrabold italic text-2xl text-white tracking-tight mt-0.5">
            Cara Menggunakan
          </h2>
        </motion.div>

        {/* 5 Minimalist Glass Cards */}
        <div className="grid grid-cols-2 gap-2.5 my-auto py-2">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === 4;

            return (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.05 }}
                className={`glass-panel rounded-xl p-3 flex flex-col justify-between transition-all ${
                  isLast ? 'col-span-2 max-w-[210px] mx-auto w-full' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-amber-200">
                    {step.num}
                  </span>
                  <div className="p-1.5 rounded-lg bg-white/5 text-amber-200">
                    <Icon className="w-4 h-4 stroke-[2]" />
                  </div>
                </div>
                <div>
                  <h3 className="font-sans font-semibold text-xs text-white">
                    {step.title}
                  </h3>
                  <p className="text-[10px] text-white/60 leading-normal mt-0.5">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between gap-3 pt-2 pb-1">
          <button
            onClick={onBack}
            className="glass-outline-btn flex-1 !min-h-[42px] py-2 px-4 flex items-center justify-center space-x-1.5 text-xs font-semibold active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali</span>
          </button>
          <button
            onClick={onNext}
            className="glass-pill-btn flex-1 !min-h-[42px] py-2 px-4 flex items-center justify-center space-x-1.5 text-xs font-bold active:scale-95 cursor-pointer"
          >
            <span>Lanjut</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </ScreenContainer>
  );
};
