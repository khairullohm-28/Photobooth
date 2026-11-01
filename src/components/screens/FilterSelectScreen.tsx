import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Frame, Filter, ScreenBackground, CapturedPhoto } from '../../types/photobooth';
import { ScreenContainer } from '../ScreenContainer';
import { FrameCanvasPreview } from '../FrameCanvasPreview';
import { getCssFilterString } from '../../utils/canvas';
import { applyLut } from '../../lib/lut';
import { ArrowLeft, Check, Sparkles, Loader2 } from 'lucide-react';

interface FilterSelectScreenProps {
  frame: Frame;
  photos: CapturedPhoto[];
  filters: Filter[];
  selectedFilter: Filter;
  mirror: boolean;
  background?: ScreenBackground;
  onSelectFilter: (filter: Filter) => void;
  onBack: () => void;
  onProceedToSave: (filter: Filter) => Promise<void>;
}

export const FilterSelectScreen: React.FC<FilterSelectScreenProps> = ({
  frame,
  photos,
  filters,
  selectedFilter,
  mirror,
  background,
  onSelectFilter,
  onBack,
  onProceedToSave,
}) => {
  const [activeFilter, setActiveFilter] = useState<Filter>(selectedFilter);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>('');

  const samplePhotoUrl =
    photos.find((p) => !p.is_discarded)?.data_url ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';

  const previewPhotos = Array.from({ length: frame.photo_count }).map((_, i) => {
    const found = photos.find((p) => p.shot_index === i && !p.is_discarded);
    return found ? found.data_url : null;
  });

  const handleDownloadClick = async () => {
    setIsProcessing(true);
    setProcessingStep('Menyiapkan file foto...');

    try {
      await onProceedToSave(activeFilter);
    } catch (err) {
      console.error('Error during generation:', err);
      setIsProcessing(false);
    }
  };

  // Build full list of filters with "Normal / Asli" as first card
  const NORMAL_FILTER: Filter = {
    id: 'flt_normal_asli',
    name: 'Normal / Asli',
    sort_order: 0,
    is_active: true,
  };

  const filterList = [
    NORMAL_FILTER,
    ...filters.filter((f) => f.id !== 'flt_normal_asli' && f.name.toLowerCase() !== 'normal'),
  ];

  // Pre-generate WebGL thumbnails for each filter using the guest's photo
  const [filterThumbs, setFilterThumbs] = useState<Record<string, string>>({});

  React.useEffect(() => {
    let isMounted = true;
    const generateThumbs = async () => {
      const thumbs: Record<string, string> = {
        flt_normal_asli: samplePhotoUrl,
      };

      for (const flt of filterList) {
        if (!flt.lut_png_url) {
          thumbs[flt.id] = samplePhotoUrl;
          continue;
        }

        try {
          const canvas = await applyLut(
            samplePhotoUrl,
            flt.lut_png_url,
            flt.intensity_default ?? 100,
            flt.extra_effects,
            flt.lut_size ?? 33
          );
          thumbs[flt.id] = canvas.toDataURL('image/jpeg', 0.85);
        } catch (e) {
          console.warn(`Error generating thumbnail for ${flt.name}:`, e);
          thumbs[flt.id] = samplePhotoUrl;
        }
      }

      if (isMounted) {
        setFilterThumbs(thumbs);
      }
    };

    generateThumbs();
    return () => {
      isMounted = false;
    };
  }, [samplePhotoUrl, filters]);

  return (
    <ScreenContainer background={background}>
      <div className="flex flex-col justify-between h-full py-3 px-2">
        {/* Top Bar */}
        <div className="flex items-center justify-between pt-1 pb-1">
          <div>
            <h2 className="font-serif font-bold text-2xl text-white tracking-tight leading-none">
              Pilih Filter
            </h2>
            <p className="text-[11px] text-amber-200/80 mt-1">
              Sentuhan tone warna 3D LUT
            </p>
          </div>
          <button
            onClick={onBack}
            disabled={isProcessing}
            className="w-8 h-8 rounded-full glass-panel-subtle flex items-center justify-center text-white/90 active:scale-95 cursor-pointer"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Live Frame Preview */}
        <div className="my-auto px-2 w-full flex items-center justify-center">
          <div className="p-1 glass-card shadow-2xl max-w-[310px] w-full">
            <FrameCanvasPreview
              frame={frame}
              photos={previewPhotos}
              filter={activeFilter}
              mirror={mirror}
              className="max-h-[48vh] object-contain"
            />
          </div>
        </div>

        {/* Bottom Filter Strip */}
        <div className="pt-1 pb-1">
          <div className="flex items-center space-x-2.5 overflow-x-auto no-scrollbar px-1 py-1.5">
            {filterList.map((flt) => {
              const isSelected = flt.id === activeFilter.id || (activeFilter.id === 'flt_normal' && flt.id === 'flt_normal_asli');
              const thumbSrc = filterThumbs[flt.id] || flt.thumbnail_url || samplePhotoUrl;

              return (
                <button
                  key={flt.id}
                  onClick={() => {
                    setActiveFilter(flt);
                    onSelectFilter(flt);
                  }}
                  className={`flex flex-col items-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
                    isSelected ? 'scale-105' : 'opacity-70 hover:opacity-100'
                  }`}
                  aria-label={`Pilih ${flt.name}`}
                >
                  <div
                    className={`relative w-13 h-13 rounded-xl overflow-hidden border transition-all ${
                      isSelected
                        ? 'border-amber-400 ring-2 ring-amber-300/60 shadow-lg'
                        : 'border-white/25'
                    }`}
                  >
                    <img
                      src={thumbSrc}
                      alt={flt.name}
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute top-1 right-1 p-0.5 rounded-full bg-amber-400 text-stone-900">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium tracking-wide mt-1 max-w-[65px] truncate text-center ${
                      isSelected ? 'text-amber-200 font-semibold' : 'text-white/70'
                    }`}
                  >
                    {flt.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* CTA: Lanjut Unduh */}
          <div className="pt-2">
            <button
              onClick={handleDownloadClick}
              disabled={isProcessing}
              className="glass-pill-btn w-full !min-h-[44px] py-2.5 px-5 flex items-center justify-center space-x-1.5 text-xs font-bold active:scale-95 cursor-pointer shadow-lg"
            >
              <Sparkles className="w-4 h-4 text-amber-700" />
              <span>Simpan &amp; Unduh</span>
            </button>
          </div>
        </div>

        {/* Minimalist Processing Overlay */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            >
              <div className="glass-card max-w-[280px] w-full p-5 text-center flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
                <h4 className="font-semibold text-white text-sm mb-1">
                  Menyiapkan Foto
                </h4>
                <p className="text-[11px] text-white/70 mb-3">{processingStep}</p>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full w-full animate-pulse" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ScreenContainer>
  );
};
