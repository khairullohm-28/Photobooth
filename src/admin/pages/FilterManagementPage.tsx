import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Sparkles,
  Upload,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Sliders,
  Check,
  X,
  AlertCircle,
  Eye,
  Loader2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import { Filter, FilterExtraEffects } from '../../types/photobooth';
import { FilterService, SAMPLE_FILTER_IMAGES } from '../../services/filterService';
import { applyLut } from '../../lib/lut';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface SortableFilterCardProps {
  filter: Filter;
  onEdit: (filter: Filter) => void;
  onDelete: (filter: Filter) => void;
  onToggleActive: (id: string, current: boolean) => void;
}

const SortableFilterCard: React.FC<SortableFilterCardProps> = ({
  filter,
  onEdit,
  onDelete,
  onToggleActive,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: filter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const isActive = filter.is_active !== false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-2xl border-2 border-black p-4 flex flex-col justify-between shadow-sm transition-all hover:shadow-md ${
        !isActive ? 'opacity-70 bg-stone-50' : ''
      }`}
    >
      <div>
        {/* Top bar with drag handle and LUT size badge */}
        <div className="flex items-center justify-between mb-3">
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-stone-400 hover:text-stone-800 cursor-grab active:cursor-grabbing rounded hover:bg-stone-100"
            title="Tarik untuk mengubah urutan"
            aria-label="Tarik urutan"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="flex items-center space-x-1.5">
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 border border-stone-300 text-stone-700">
              {filter.lut_size ? `${filter.lut_size}³` : '33³'} LUT
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-stone-100 text-stone-500 border-stone-300'
              }`}
            >
              {isActive ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
        </div>

        {/* Thumbnail Preview */}
        <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden border border-stone-200 bg-stone-100 mb-3 group">
          {filter.thumbnail_url ? (
            <img
              src={filter.thumbnail_url}
              alt={filter.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-stone-400">
              <Sparkles className="w-6 h-6 mb-1 opacity-50" />
              <span className="text-[10px]">Preview LUT</span>
            </div>
          )}

          {/* Intensity Overlay Badge */}
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-white font-mono text-[10px] font-semibold">
            {filter.intensity_default ?? 100}%
          </div>

          {filter.extra_effects && (filter.extra_effects.grain || filter.extra_effects.vignette || filter.extra_effects.softness) ? (
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-sm text-amber-300 text-[9px] font-bold">
              FX
            </div>
          ) : null}
        </div>

        {/* Filter Name & Details */}
        <h3 className="font-serif font-bold text-base text-stone-900 tracking-tight truncate">
          {filter.name}
        </h3>
        <p className="text-[11px] text-stone-500 font-sans mt-0.5">
          Urutan #{filter.sort_order ?? 1} • {filter.lut_url ? '.cube format' : 'Preset'}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-4 mt-2 border-t border-stone-100">
        <label className="flex items-center space-x-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isActive}
            onChange={() => onToggleActive(filter.id, isActive)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-stone-900 relative border border-stone-300" />
          <span className="text-xs text-stone-600 font-medium hidden sm:inline">
            {isActive ? 'Aktif' : 'Mati'}
          </span>
        </label>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => onEdit(filter)}
            className="p-1.5 rounded-lg border border-stone-300 hover:border-black hover:bg-stone-50 text-stone-700 transition-colors"
            title="Edit Filter & Preview"
            aria-label="Edit Filter"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(filter)}
            className="p-1.5 rounded-lg border border-stone-300 hover:border-rose-600 hover:bg-rose-50 text-stone-700 hover:text-rose-600 transition-colors"
            title="Hapus Filter"
            aria-label="Hapus Filter"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const FilterManagementPage: React.FC = () => {
  const { addToast } = useToast();
  const [filters, setFilters] = useState<Filter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // File Upload State
  const [uploadErrors, setUploadErrors] = useState<{ filename: string; message: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter Edit Modal State
  const [editingFilter, setEditingFilter] = useState<Filter | null>(null);
  const [editName, setEditName] = useState('');
  const [editIntensity, setEditIntensity] = useState(100);
  const [editEffects, setEditEffects] = useState<FilterExtraEffects>({ grain: 0, softness: 0, vignette: 0 });
  const [showEffectsAccordion, setShowEffectsAccordion] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Interactive Before/After Split Preview
  const [splitPosition, setSplitPosition] = useState(50); // percentage 0 - 100
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [activeSampleImage, setActiveSampleImage] = useState<string>(SAMPLE_FILTER_IMAGES[0].url);
  const [customTestImage, setCustomTestImage] = useState<string | null>(null);
  const [previewFilteredUrl, setPreviewFilteredUrl] = useState<string | null>(null);
  const [isPreviewRendering, setIsPreviewRendering] = useState(false);
  const testFileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirm Dialog
  const [filterToDelete, setFilterToDelete] = useState<Filter | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sensors for dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await FilterService.getAllAdminFilters();
      setFilters(data);
    } catch (err) {
      console.error('Failed to load filters:', err);
      addToast('Gagal memuat filter', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Drag Reorder
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filters.findIndex((f) => f.id === active.id);
    const newIndex = filters.findIndex((f) => f.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(filters, oldIndex, newIndex);
      setFilters(reordered);

      try {
        await FilterService.reorderFilters(reordered.map((f) => f.id));
        addToast('Urutan filter berhasil disimpan', 'success');
      } catch (err) {
        console.error('Failed to save reorder:', err);
        addToast('Gagal menyimpan urutan filter', 'error');
        loadData();
      }
    }
  };

  // Toggle Active/Inactive
  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      const next = !current;
      setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, is_active: next } : f)));
      await FilterService.updateFilter(id, { is_active: next });
      addToast(next ? 'Filter diaktifkan' : 'Filter dinonaktifkan', 'info');
    } catch (err) {
      console.error('Failed to toggle status:', err);
      addToast('Gagal mengubah status filter', 'error');
      loadData();
    }
  };

  // Process uploaded .cube files
  const handleFilesUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    const errors: { filename: string; message: string }[] = [];
    let successCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        await FilterService.processCubeFile(file);
        successCount++;
      } catch (err: any) {
        console.error(`Error processing ${file.name}:`, err);
        errors.push({
          filename: file.name,
          message: err.message || 'Format file .cube tidak valid atau korup',
        });
      }
    }

    setUploadErrors(errors);
    setIsUploading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (successCount > 0) {
      addToast(`${successCount} filter .cube berhasil ditambahkan`, 'success');
      loadData();
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (filter: Filter) => {
    setEditingFilter(filter);
    setEditName(filter.name);
    setEditIntensity(filter.intensity_default ?? 100);
    setEditEffects(filter.extra_effects || { grain: 0, softness: 0, vignette: 0 });
    setSplitPosition(50);
  };

  // Render live WebGL preview for Before/After split slider
  useEffect(() => {
    if (!editingFilter) return;

    let isMounted = true;
    const renderPreview = async () => {
      setIsPreviewRendering(true);
      const testImg = customTestImage || activeSampleImage;
      try {
        if (editingFilter.lut_png_url) {
          const canvas = await applyLut(
            testImg,
            editingFilter.lut_png_url,
            editIntensity,
            editEffects,
            editingFilter.lut_size || 33
          );
          if (isMounted) {
            setPreviewFilteredUrl(canvas.toDataURL('image/jpeg', 0.88));
          }
        } else {
          setPreviewFilteredUrl(testImg);
        }
      } catch (err) {
        console.warn('Failed to render live preview:', err);
      } finally {
        if (isMounted) {
          setIsPreviewRendering(false);
        }
      }
    };

    const timer = setTimeout(renderPreview, 60);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [editingFilter, editIntensity, editEffects, activeSampleImage, customTestImage]);

  // Handle Dragging Split Divider
  const handleSplitMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingSplit || !splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const offsetX = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
    setSplitPosition(pct);
  };

  // Handle Save Filter Changes
  const handleSaveFilter = async () => {
    if (!editingFilter) return;
    if (!editName.trim()) {
      addToast('Nama filter tidak boleh kosong', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await FilterService.updateFilter(editingFilter.id, {
        name: editName.trim(),
        intensity_default: editIntensity,
        extra_effects: editEffects,
      });

      addToast('Filter berhasil diperbarui', 'success');
      setEditingFilter(null);
      loadData();
    } catch (err) {
      console.error('Failed to update filter:', err);
      addToast('Gagal menyimpan perubahan filter', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Soft Delete
  const handleConfirmDelete = async () => {
    if (!filterToDelete) return;
    setIsDeleting(true);
    try {
      await FilterService.deleteFilter(filterToDelete.id);
      addToast(`Filter "${filterToDelete.name}" dihapus`, 'success');
      setFilterToDelete(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete filter:', err);
      addToast('Gagal menghapus filter', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Custom Test Photo Upload
  const handleTestImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setCustomTestImage(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h1 className="font-serif font-bold text-2xl text-stone-900 tracking-tight">
            Filter &amp; Efek Kamera
          </h1>
          <p className="font-sans text-xs text-stone-500 mt-1">
            Kelola filter warna 3D LUT (.cube) untuk preview tamu dan cetak foto
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFilesUpload(e.target.files)}
            accept=".cube,text/plain"
            multiple
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 rounded-full border-2 border-black bg-stone-900 hover:bg-black text-white text-xs font-bold font-sans flex items-center space-x-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>Upload File .cube</span>
          </button>
        </div>
      </div>

      {/* Upload Errors Banner */}
      {uploadErrors.length > 0 && (
        <div className="p-4 rounded-xl border-2 border-rose-300 bg-rose-50 text-rose-900 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 font-bold text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Beberapa file .cube gagal diproses:</span>
            </div>
            <button
              onClick={() => setUploadErrors([])}
              className="text-stone-400 hover:text-stone-800"
              aria-label="Tutup error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ul className="text-[11px] list-disc list-inside space-y-1 font-mono text-rose-800 pl-1">
            {uploadErrors.map((err, i) => (
              <li key={i}>
                <span className="font-semibold">{err.filename}</span>: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFilesUpload(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-stone-300 hover:border-black rounded-2xl p-6 text-center bg-stone-50/70 hover:bg-stone-50 cursor-pointer transition-colors group"
      >
        <div className="w-10 h-10 rounded-full bg-white border border-stone-300 flex items-center justify-center mx-auto mb-2 text-stone-600 group-hover:scale-105 transition-transform shadow-xs">
          <Upload className="w-5 h-5" />
        </div>
        <p className="font-serif font-bold text-sm text-stone-800">
          Tarik &amp; Lepaskan file .cube di sini, atau Klik untuk Memilih
        </p>
        <p className="text-[11px] text-stone-500 font-sans mt-1">
          Mendukung multi-upload file 3D LUT (.cube ukuran 2 sampai 65). File 1D LUT akan ditolak.
        </p>
      </div>

      {/* Filter Grid */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-stone-500">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <span className="font-serif text-xs">Memuat daftar filter...</span>
        </div>
      ) : filters.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-stone-200 rounded-2xl p-8">
          <Sparkles className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <h3 className="font-serif font-bold text-base text-stone-800">Belum Ada Filter</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Upload file .cube atau gunakan tombol upload di atas untuk menambahkan filter warna ke photobooth.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filters.map((f) => f.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filters.map((filter) => (
                <SortableFilterCard
                  key={filter.id}
                  filter={filter}
                  onEdit={handleOpenEdit}
                  onDelete={setFilterToDelete}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Edit Filter & Before/After Split Modal */}
      {editingFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border-2 border-black max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h2 className="font-serif font-bold text-lg text-stone-900 tracking-tight">
                  Edit Pengaturan Filter
                </h2>
                <p className="font-sans text-[11px] text-stone-500">
                  Uji coba warna dengan slider Before/After interaktif
                </p>
              </div>
              <button
                onClick={() => setEditingFilter(null)}
                className="w-8 h-8 rounded-full border border-stone-300 hover:border-black flex items-center justify-center text-stone-500 hover:text-black cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-6">
              {/* Top: Interactive Before/After Split Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-serif font-bold text-xs text-stone-800">
                    Preview Live (Geser garis pembagi)
                  </span>
                  <div className="flex items-center space-x-1.5">
                    {/* Sample images switcher */}
                    {SAMPLE_FILTER_IMAGES.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => {
                          setActiveSampleImage(img.url);
                          setCustomTestImage(null);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-sans font-medium transition-all cursor-pointer ${
                          activeSampleImage === img.url && !customTestImage
                            ? 'bg-stone-900 text-white border-black font-semibold'
                            : 'bg-stone-100 text-stone-600 border-stone-200 hover:border-stone-400'
                        }`}
                      >
                        {img.label}
                      </button>
                    ))}
                    <input
                      type="file"
                      ref={testFileInputRef}
                      onChange={handleTestImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => testFileInputRef.current?.click()}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-sans font-medium flex items-center space-x-1 transition-all cursor-pointer ${
                        customTestImage
                          ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold'
                          : 'bg-stone-100 text-stone-600 border-stone-200 hover:border-stone-400'
                      }`}
                      title="Upload foto uji coba sendiri"
                    >
                      <ImageIcon className="w-2.5 h-2.5" />
                      <span>{customTestImage ? 'Foto Custom' : '+ Foto'}</span>
                    </button>
                  </div>
                </div>

                {/* Split Canvas Container */}
                <div
                  ref={splitContainerRef}
                  onMouseDown={() => setIsDraggingSplit(true)}
                  onMouseUp={() => setIsDraggingSplit(false)}
                  onMouseLeave={() => setIsDraggingSplit(false)}
                  onMouseMove={handleSplitMouseMove}
                  onTouchStart={() => setIsDraggingSplit(true)}
                  onTouchEnd={() => setIsDraggingSplit(false)}
                  onTouchMove={handleSplitMouseMove}
                  className="relative aspect-16/10 sm:aspect-16/9 w-full rounded-2xl overflow-hidden border-2 border-black bg-stone-900 select-none cursor-ew-resize shadow-inner"
                >
                  {/* Under layer: Filtered WebGL image */}
                  <img
                    src={previewFilteredUrl || activeSampleImage}
                    alt="Filtered"
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />

                  {/* Over layer: Original Image clipped by split percentage */}
                  <div
                    className="absolute inset-0 overflow-hidden pointer-events-none"
                    style={{ width: `${splitPosition}%` }}
                  >
                    <img
                      src={customTestImage || activeSampleImage}
                      alt="Original"
                      className="absolute inset-0 w-full h-full object-cover max-w-none"
                      style={{
                        width: splitContainerRef.current?.offsetWidth || '100%',
                        height: '100%',
                      }}
                    />
                  </div>

                  {/* Vertical Divider Line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
                    style={{ left: `${splitPosition}%` }}
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-black shadow-md flex items-center justify-center text-stone-900 text-[10px] font-bold">
                      ↔
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white text-[10px] font-mono pointer-events-none">
                    Sebelum (Asli)
                  </div>
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-amber-400 text-stone-900 text-[10px] font-mono font-bold pointer-events-none">
                    Sesudah (LUT {editIntensity}%)
                  </div>

                  {isPreviewRendering && (
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 text-white text-[10px] flex items-center space-x-1">
                      <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                      <span>Memproses WebGL...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Controls */}
              <div className="space-y-4">
                {/* 1. Filter Name */}
                <div>
                  <label className="block font-serif font-bold text-xs text-stone-800 mb-1">
                    Nama Filter
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Contoh: Wedding Warmth"
                    className="w-full px-3.5 py-2 rounded-xl border-2 border-black font-sans text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* 2. Intensity Slider */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-serif font-bold text-xs text-stone-800">
                      Intensitas Warna (Mix Default)
                    </label>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-stone-100 border border-stone-300">
                      {editIntensity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editIntensity}
                    onChange={(e) => setEditIntensity(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-black"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 font-mono mt-0.5">
                    <span>0% (Asli)</span>
                    <span>50%</span>
                    <span>100% (Penuh)</span>
                  </div>
                </div>

                {/* 3. Extra Effects Accordion */}
                <div className="border border-stone-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowEffectsAccordion(!showEffectsAccordion)}
                    className="w-full px-4 py-2.5 bg-stone-50 hover:bg-stone-100 flex items-center justify-between text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-3.5 h-3.5 text-stone-700" />
                      <span className="font-serif font-bold text-xs text-stone-800">
                        Efek Tambahan (Film Grain, Softness, Vignette)
                      </span>
                    </div>
                    {showEffectsAccordion ? (
                      <ChevronUp className="w-4 h-4 text-stone-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-stone-500" />
                    )}
                  </button>

                  {showEffectsAccordion && (
                    <div className="p-4 bg-white space-y-4 border-t border-stone-200">
                      {/* Film Grain */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-stone-700">Film Grain (Bintik Film)</span>
                          <span className="font-mono text-xs text-stone-600 font-semibold">
                            {editEffects.grain ?? 0}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={editEffects.grain ?? 0}
                          onChange={(e) =>
                            setEditEffects((prev) => ({ ...prev, grain: parseInt(e.target.value, 10) }))
                          }
                          className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-black"
                        />
                      </div>

                      {/* Softness */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-stone-700">Kelembutan Kulit (Softness)</span>
                          <span className="font-mono text-xs text-stone-600 font-semibold">
                            {editEffects.softness ?? 0}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={editEffects.softness ?? 0}
                          onChange={(e) =>
                            setEditEffects((prev) => ({ ...prev, softness: parseInt(e.target.value, 10) }))
                          }
                          className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-black"
                        />
                      </div>

                      {/* Vignette */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-stone-700">Vignette (Bayangan Sudut)</span>
                          <span className="font-mono text-xs text-stone-600 font-semibold">
                            {editEffects.vignette ?? 0}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={editEffects.vignette ?? 0}
                          onChange={(e) =>
                            setEditEffects((prev) => ({ ...prev, vignette: parseInt(e.target.value, 10) }))
                          }
                          className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-black"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-end space-x-2 rounded-b-3xl">
              <button
                type="button"
                onClick={() => setEditingFilter(null)}
                className="px-4 py-2 rounded-full border border-stone-300 hover:border-black font-sans text-xs font-bold text-stone-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveFilter}
                disabled={isSaving}
                className="px-5 py-2 rounded-full border-2 border-black bg-stone-900 hover:bg-black text-white font-sans text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Soft Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!filterToDelete}
        title="Hapus Filter"
        message={`Apakah Anda yakin ingin menghapus filter "${filterToDelete?.name}"? Filter tidak akan muncul lagi di pilihan tamu.`}
        confirmLabel="Hapus Filter"
        cancelLabel="Batal"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setFilterToDelete(null)}
      />
    </div>
  );
};
