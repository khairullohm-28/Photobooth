import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  Save,
  Check,
  AlertCircle,
  FileImage,
  Loader2,
  Sparkles,
  Info,
} from 'lucide-react';
import { Frame, FrameSlot, TemplateCategory } from '../../types/photobooth';
import { StudioService, generateWebpAndThumb } from '../../services/studioService';
import { FrameCanvasEditor } from '../components/FrameCanvasEditor';
import { useToast } from '../components/Toast';
import { SEED_FRAMES } from '../../data/seedData';

interface FrameEditorPageProps {
  templateId?: string | null;
  onNavigate: (path: string) => void;
}

export const FrameEditorPage: React.FC<FrameEditorPageProps> = ({
  templateId,
  onNavigate,
}) => {
  const { addToast } = useToast();

  // Form states
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [badge, setBadge] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);

  // Canvas & Image states
  const [frameImageUrl, setFrameImageUrl] = useState<string | null>(null);
  const [frameImageEl, setFrameImageEl] = useState<HTMLImageElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(1800);
  const [slots, setSlots] = useState<FrameSlot[]>([]);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);

  // Loading & Saving states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load Categories & Existing Template if editing
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const cats = await StudioService.getCategories();
        setCategories(cats);

        if (templateId) {
          const frame = await StudioService.getFrameById(templateId);
          if (frame) {
            setName(frame.name);
            setCategoryId(frame.category_id || cats[0]?.id || '');
            setBadge(frame.badge || '');
            setIsActive(frame.is_active ?? true);
            setCanvasWidth(frame.canvas_width || 1200);
            setCanvasHeight(frame.canvas_height || 1800);
            setSlots(frame.slots || []);
            setFrameImageUrl(frame.image_url);

            // Pre-load HTMLImageElement
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => setFrameImageEl(img);
            img.src = frame.image_url;
          } else {
            addToast('Template frame tidak ditemukan', 'error');
            onNavigate('/admin/studio/templates');
          }
        } else {
          // New template defaults
          if (cats.length > 0) {
            setCategoryId(cats[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to init FrameEditorPage:', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [templateId, onNavigate, addToast]);

  // Handle PNG Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('png')) {
      addToast('File harus bertipe PNG transparan', 'error');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      addToast('Ukuran file maksimal 20 MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        setCanvasWidth(w);
        setCanvasHeight(h);
        setFrameImageEl(img);
        setFrameImageUrl(dataUrl);

        // If no name entered, suggest filename
        if (!name) {
          const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          setName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
        }

        // Auto default slot if none exist
        if (slots.length === 0) {
          const defaultSlot: FrameSlot = {
            id: `slot_${Date.now()}_1`,
            x: 0.1,
            y: 0.1,
            w: 0.8,
            h: 0.4,
            rotation: 0,
            shot_index: 1,
          };
          setSlots([defaultSlot]);
        }

        addToast(`Frame PNG berhasil dimuat (${w}x${h}px)`, 'success');
      };
      img.onerror = () => addToast('Gagal membaca gambar PNG', 'error');
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Use Sample Preset Frame
  const handleUseSampleFrame = (sampleIndex: number) => {
    const sample = SEED_FRAMES[sampleIndex] || SEED_FRAMES[0];
    setCanvasWidth(sample.canvas_width);
    setCanvasHeight(sample.canvas_height);
    setFrameImageUrl(sample.image_url);
    if (!name) setName(`${sample.name} Custom`);

    // Copy slots
    const clonedSlots: FrameSlot[] = sample.slots.map((s, idx) => {
      const isNorm = s.w <= 1.0;
      return {
        id: `slot_${Date.now()}_${idx + 1}`,
        x: isNorm ? s.x : s.x / 100,
        y: isNorm ? s.y : s.y / 100,
        w: isNorm ? s.w : s.w / 100,
        h: isNorm ? s.h : s.h / 100,
        rotation: s.rotation || 0,
        shot_index: s.shot_index >= 1 ? s.shot_index : s.shot_index + 1,
      };
    });
    setSlots(clonedSlots);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setFrameImageEl(img);
    img.src = sample.image_url;

    addToast(`Sample frame "${sample.name}" berhasil diterapkan`, 'success');
  };

  // Pre-save Validation & Save Action
  const handleSave = async () => {
    // 1. Validations
    if (!name.trim()) {
      addToast('Nama template tidak boleh kosong', 'error');
      return;
    }
    if (!categoryId) {
      addToast('Pilih kategori template terlebih dahulu', 'error');
      return;
    }
    if (!frameImageUrl || !frameImageEl) {
      addToast('Silakan unggah gambar frame PNG terlebih dahulu', 'error');
      return;
    }
    if (slots.length === 0) {
      addToast('Minimal harus ada 1 slot foto di template', 'error');
      return;
    }

    // Check all slots within canvas
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s.w <= 0 || s.h <= 0) {
        addToast(`Slot #${s.shot_index} memiliki ukuran tidak valid`, 'error');
        return;
      }
      if (s.x < -0.05 || s.y < -0.05 || s.x + s.w > 1.05 || s.y + s.h > 1.05) {
        addToast(`Slot #${s.shot_index} berada di luar batas kanvas frame`, 'error');
        return;
      }
    }

    setIsSaving(true);
    try {
      // 2. Generate WebP preview (max 1000px) and thumbnail (max 320px)
      const { previewUrl, thumbUrl } = await generateWebpAndThumb(frameImageEl, 1000, 320);

      // 3. Compute unique shots count
      const uniqueShots = new Set(slots.map((s) => s.shot_index));
      const photoCount = uniqueShots.size;

      // 4. Calculate aspect ratio label
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const divisor = gcd(canvasWidth, canvasHeight);
      const ratioLabel =
        divisor > 10
          ? `${Math.round(canvasWidth / divisor)}:${Math.round(canvasHeight / divisor)}`
          : `${canvasWidth}:${canvasHeight}`;

      if (templateId) {
        // Update existing frame
        const res = await StudioService.updateFrame(templateId, {
          name: name.trim(),
          category_id: categoryId,
          image_url: frameImageUrl,
          preview_url: previewUrl,
          thumbnail_url: thumbUrl,
          canvas_width: canvasWidth,
          canvas_height: canvasHeight,
          slots: slots,
          badge: badge.trim() || undefined,
          is_active: isActive,
          aspect_ratio: ratioLabel,
        });

        if (res.success) {
          addToast(`Template "${name}" berhasil diperbarui`, 'success');
          onNavigate('/admin/studio/templates');
        } else {
          addToast(res.error || 'Gagal memperbarui template', 'error');
        }
      } else {
        // Create new frame
        const res = await StudioService.createFrame({
          name: name.trim(),
          category_id: categoryId,
          image_url: frameImageUrl,
          preview_url: previewUrl,
          thumbnail_url: thumbUrl,
          canvas_width: canvasWidth,
          canvas_height: canvasHeight,
          slots: slots,
          badge: badge.trim() || undefined,
          is_active: isActive,
          aspect_ratio: ratioLabel,
        });

        if (res.success) {
          addToast(`Template "${name}" dengan ${photoCount} pose berhasil disimpan!`, 'success');
          onNavigate('/admin/studio/templates');
        } else {
          addToast(res.error || 'Gagal menyimpan template', 'error');
        }
      }
    } catch (err: any) {
      console.error('Failed to save frame template:', err);
      addToast(err?.message || 'Terjadi kesalahan sistem saat menyimpan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center">
        <Loader2 className="w-8 h-8 text-stone-900 animate-spin mx-auto mb-2" />
        <span className="text-xs font-serif text-stone-600">Memuat editor template...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Save Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stone-200">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => onNavigate('/admin/studio/templates')}
            className="p-2 rounded-xl border border-stone-300 text-stone-700 hover:text-black hover:bg-stone-100 hover:border-black transition-all cursor-pointer"
            title="Kembali ke Daftar Template"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-serif font-bold text-stone-950 tracking-tight">
              {templateId ? 'Edit Template Frame' : 'Tambah Template Frame Baru'}
            </h1>
            <p className="text-xs text-stone-500 font-sans mt-0.5">
              Sesuaikan rotasi sudut, aspect ratio, dan urutan slot foto pada frame.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => onNavigate('/admin/studio/templates')}
            className="px-4 py-2 rounded-full border border-stone-300 text-stone-700 text-xs font-serif hover:bg-stone-100 transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="inline-flex items-center space-x-1.5 px-6 py-2.5 rounded-full border-2 border-black bg-stone-900 hover:bg-black text-white text-xs font-serif font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{templateId ? 'Perbarui Template' : 'Simpan Template'}</span>
          </button>
        </div>
      </div>

      {/* Basic Metadata Form (Name, Category, Badge, Status) */}
      <div className="p-5 bg-stone-50 rounded-3xl border-2 border-stone-200 grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Name Input */}
        <div className="md:col-span-5">
          <label className="block text-xs font-serif font-bold text-stone-900 mb-1">
            Nama Template <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Classic White 3-Strip"
            className="w-full px-3.5 py-2 rounded-xl border-2 border-black bg-white text-xs font-sans text-stone-950 focus:outline-hidden"
          />
        </div>

        {/* Category Select */}
        <div className="md:col-span-4">
          <label className="block text-xs font-serif font-bold text-stone-900 mb-1">
            Kategori User / Acara <span className="text-red-500">*</span>
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border-2 border-black bg-white text-xs font-sans text-stone-950 focus:outline-hidden"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Badge (Optional) */}
        <div className="md:col-span-2">
          <label className="block text-xs font-serif font-bold text-stone-900 mb-1">
            Label Badge (Opsional)
          </label>
          <input
            type="text"
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            placeholder="Favorit, New, dsb."
            className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-sans text-stone-900 focus:outline-hidden focus:border-stone-900"
          />
        </div>

        {/* Active Toggle */}
        <div className="md:col-span-1 flex flex-col justify-end pb-1">
          <label className="text-[11px] font-serif font-bold text-stone-700 mb-1 block">
            Status
          </label>
          <button
            type="button"
            onClick={() => setIsActive((prev) => !prev)}
            className={`w-full py-1.5 px-2 rounded-xl border text-[11px] font-bold font-mono transition-all ${
              isActive
                ? 'bg-emerald-600 border-emerald-700 text-white'
                : 'bg-stone-200 border-stone-300 text-stone-600'
            }`}
          >
            {isActive ? 'Aktif' : 'Nonaktif'}
          </button>
        </div>
      </div>

      {/* Main Content: Upload Box or Konva Canvas Editor */}
      {!frameImageUrl || !frameImageEl ? (
        /* Upload Frame PNG Prompt */
        <div className="space-y-6">
          <div className="p-12 text-center bg-stone-50 rounded-3xl border-2 border-dashed border-stone-300 hover:border-black transition-colors space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center mx-auto">
              <Upload className="w-8 h-8 stroke-[1.8]" />
            </div>

            <div className="max-w-md mx-auto space-y-1">
              <h3 className="font-serif font-bold text-base text-stone-950">
                Unggah File Frame PNG Transparan
              </h3>
              <p className="text-xs text-stone-500">
                Format PNG dengan lubang transparan (alpha channel) di area foto. Maksimal 20 MB.
              </p>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center space-x-2 px-6 py-3 rounded-full border-2 border-black bg-stone-900 hover:bg-black text-white text-xs font-serif font-bold shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <FileImage className="w-4 h-4" />
                <span>Pilih File Frame PNG</span>
              </button>
            </div>
          </div>

          {/* Quick Demo Pre-seed Presets */}
          <div className="p-5 bg-white rounded-3xl border-2 border-stone-200 space-y-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <h4 className="font-serif font-bold text-xs text-stone-900 uppercase tracking-wider">
                Atau Gunakan Contoh Frame Template Bawaan
              </h4>
            </div>
            <p className="text-xs text-stone-500">
              Pilih salah satu frame template transparan di bawah ini untuk langsung menguji editor rotasi kanvas:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {SEED_FRAMES.map((f, idx) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleUseSampleFrame(idx)}
                  className="flex flex-col items-center p-3 rounded-2xl border-2 border-stone-200 hover:border-black bg-stone-50 hover:bg-stone-100 transition-all text-center group cursor-pointer"
                >
                  <div className="w-full aspect-2/3 bg-white rounded-xl overflow-hidden border border-stone-200 mb-2 p-1">
                    <img
                      src={f.image_url}
                      alt={f.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <span className="font-serif font-bold text-xs text-stone-900 group-hover:underline">
                    {f.name}
                  </span>
                  <span className="text-[10px] text-stone-500 font-mono mt-0.5">
                    {f.photo_count} Pose &bull; {f.canvas_width}x{f.canvas_height}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Interactive Konva Canvas Editor */
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-serif font-bold text-stone-900">
              Kanvas Frame Editor
            </span>
            <button
              type="button"
              onClick={() => {
                setFrameImageUrl(null);
                setFrameImageEl(null);
              }}
              className="text-xs text-stone-500 hover:text-black underline font-serif cursor-pointer"
            >
              Ganti File Frame PNG
            </button>
          </div>

          <FrameCanvasEditor
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            frameImage={frameImageEl}
            slots={slots}
            onSlotsChange={(newSlots) => setSlots(newSlots)}
            showPhotoPreview={showPhotoPreview}
            onTogglePhotoPreview={() => setShowPhotoPreview((prev) => !prev)}
          />
        </div>
      )}
    </div>
  );
};
