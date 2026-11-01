import React, { useState, useEffect, useCallback } from 'react';
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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Search,
  Filter as FilterIcon,
  Pencil,
  Copy,
  Trash2,
  GripVertical,
  Layers,
  Image as ImageIcon,
  Check,
  X,
  AlertCircle,
  Archive,
  Loader2,
} from 'lucide-react';
import { Frame, TemplateCategory } from '../../types/photobooth';
import { StudioService } from '../../services/studioService';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface TemplatesListPageProps {
  onNavigate: (path: string) => void;
}

// Draggable Sortable Row Component for Desktop Table
interface SortableRowProps {
  frame: Frame;
  index: number;
  categoryName: string;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (frame: Frame) => void;
  onToggleStatus: (id: string, current: boolean) => void;
}

const SortableTableRow: React.FC<SortableRowProps> = ({
  frame,
  index,
  categoryName,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleStatus,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: frame.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 99 : 'auto',
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-stone-50/80 transition-colors group ${
        isDragging ? 'bg-amber-50 shadow-lg' : ''
      }`}
    >
      {/* Drag Handle */}
      <td className="py-3 px-3 w-10 text-center">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1 rounded text-stone-400 hover:text-black cursor-grab active:cursor-grabbing hover:bg-stone-200"
          title="Geser untuk mengatur urutan"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>

      {/* No */}
      <td className="py-3 px-3 text-center font-mono text-stone-400 font-semibold w-10">
        {index + 1}
      </td>

      {/* Thumbnail */}
      <td className="py-3 px-3 w-20">
        <div className="w-14 h-20 bg-stone-100 rounded-xl overflow-hidden border border-stone-300 p-0.5 flex items-center justify-center shadow-xs">
          <img
            src={frame.thumbnail_url || frame.preview_url || frame.image_url}
            alt={frame.name}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        </div>
      </td>

      {/* Template Name & Details */}
      <td className="py-3 px-4 font-serif">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-stone-950 text-sm">{frame.name}</span>
            {frame.badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                {frame.badge}
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono text-stone-400 block">
            {frame.canvas_width} &times; {frame.canvas_height} px &bull; {frame.slots?.length || 0} slot
          </span>
        </div>
      </td>

      {/* Category */}
      <td className="py-3 px-4">
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-serif font-medium bg-stone-100 text-stone-800 border border-stone-300">
          <span>{categoryName}</span>
        </span>
      </td>

      {/* Photo Count */}
      <td className="py-3 px-4 text-center">
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-50 text-blue-900 border border-blue-200">
          <Layers className="w-3 h-3 text-blue-600" />
          <span>{frame.photo_count} Foto</span>
        </span>
      </td>

      {/* Status Toggle */}
      <td className="py-3 px-4 text-center">
        <button
          type="button"
          onClick={() => onToggleStatus(frame.id, frame.is_active ?? true)}
          className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold border transition-all cursor-pointer ${
            frame.is_active !== false
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
              : 'bg-stone-100 text-stone-500 border-stone-300 hover:bg-stone-200'
          }`}
        >
          {frame.is_active !== false ? 'Aktif' : 'Nonaktif'}
        </button>
      </td>

      {/* Actions */}
      <td className="py-3 px-4 text-right">
        <div className="inline-flex items-center justify-end space-x-1">
          <button
            onClick={() => onEdit(frame.id)}
            className="p-1.5 rounded-lg border border-stone-300 text-stone-700 hover:text-black hover:bg-stone-100 hover:border-black transition-all cursor-pointer"
            title="Edit Frame di Canvas Editor"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDuplicate(frame.id)}
            className="p-1.5 rounded-lg border border-stone-300 text-stone-700 hover:text-black hover:bg-stone-100 hover:border-black transition-all cursor-pointer"
            title="Duplikasi Template"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(frame)}
            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:text-white hover:bg-red-600 hover:border-red-600 transition-all cursor-pointer"
            title="Hapus atau Arsipkan"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export const TemplatesListPage: React.FC<TemplatesListPageProps> = ({ onNavigate }) => {
  const { addToast } = useToast();
  const [frames, setFrames] = useState<Frame[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Delete modal state
  const [frameToDelete, setFrameToDelete] = useState<Frame | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Setup DnD sensors
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
      const [cats, frms] = await Promise.all([
        StudioService.getCategories(),
        StudioService.getFrames({ includeArchived: false }),
      ]);
      setCategories(cats);
      setFrames(frms);
    } catch (err) {
      console.error('Failed to load frames:', err);
      addToast('Gagal memuat daftar template frame', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle DnD Drag End (Reorder)
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = frames.findIndex((f) => f.id === active.id);
    const newIndex = frames.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(frames, oldIndex, newIndex);
    setFrames(reordered);

    try {
      const orderedIds = reordered.map((f) => f.id);
      await StudioService.reorderFrames(orderedIds);
      addToast('Urutan template berhasil diperbarui', 'success');
    } catch (err) {
      console.error('Reorder error:', err);
      addToast('Gagal menyimpan urutan template', 'error');
      loadData();
    }
  };

  // Toggle Frame Active/Inactive Status
  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    try {
      const res = await StudioService.toggleFrameStatus(id, newStatus);
      if (res.success) {
        setFrames((prev) =>
          prev.map((f) => (f.id === id ? { ...f, is_active: newStatus } : f))
        );
        addToast(
          `Status template diubah menjadi ${newStatus ? 'Aktif' : 'Nonaktif'}`,
          'success'
        );
      }
    } catch {
      addToast('Gagal mengubah status template', 'error');
    }
  };

  // Duplicate Frame
  const handleDuplicate = async (id: string) => {
    try {
      const res = await StudioService.duplicateFrame(id);
      if (res.success && res.frame) {
        addToast(`Template "${res.frame.name}" berhasil diduplikasi`, 'success');
        await loadData();
      } else {
        addToast(res.error || 'Gagal menduplikasi template', 'error');
      }
    } catch {
      addToast('Gagal menduplikasi template', 'error');
    }
  };

  // Confirm Delete / Archive
  const handleConfirmDelete = async () => {
    if (!frameToDelete) return;
    setIsDeleting(true);
    try {
      const res = await StudioService.deleteFrame(frameToDelete.id);
      if (res.success) {
        if (res.softDeleted) {
          addToast(
            `Template "${frameToDelete.name}" telah digunakan di sesi tamu, dipindahkan ke arsip.`,
            'info'
          );
        } else {
          addToast(`Template "${frameToDelete.name}" berhasil dihapus`, 'success');
        }
        setFrameToDelete(null);
        await loadData();
      } else {
        addToast(res.error || 'Gagal menghapus template', 'error');
      }
    } catch (err: any) {
      addToast(err?.message || 'Gagal menghapus template', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Map category ID to name
  const getCategoryName = (catId?: string) => {
    if (!catId) return 'Tanpa Kategori';
    const found = categories.find((c) => c.id === catId);
    return found ? found.name : catId;
  };

  // Filtered frames by search and category dropdown
  const filteredFrames = frames.filter((f) => {
    const matchesCategory =
      selectedCategoryFilter === 'all' || f.category_id === selectedCategoryFilter;
    const matchesSearch =
      !searchTerm.trim() ||
      f.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      getCategoryName(f.category_id).toLowerCase().includes(searchTerm.toLowerCase().trim());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">
            Template Frame
          </h1>
          <p className="text-xs text-stone-500 font-sans mt-1">
            Kelola layout frame, rasio kanvas, slot foto, dan urutan tampilan untuk tamu.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/admin/studio/templates/new')}
          className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-full border-2 border-black bg-stone-900 hover:bg-black text-white text-xs font-serif font-bold shadow-sm active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Template</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-3 rounded-2xl border-2 border-stone-200">
        <div className="flex flex-1 items-center space-x-3">
          {/* Category Filter Dropdown */}
          <div className="flex items-center space-x-2 shrink-0">
            <FilterIcon className="w-4 h-4 text-stone-500" />
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-white rounded-xl border border-stone-300 text-xs font-sans text-stone-900 focus:outline-hidden focus:border-stone-900"
            >
              <option value="all">Semua Kategori ({frames.length})</option>
              {categories.map((c) => {
                const count = frames.filter((f) => f.category_id === c.id).length;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama template..."
              className="w-full pl-9 pr-4 py-1.5 bg-white rounded-xl border border-stone-300 text-xs font-sans text-stone-900 focus:outline-hidden focus:border-stone-900"
            />
          </div>
        </div>

        <div className="text-xs font-mono text-stone-500 font-medium px-2 shrink-0">
          Menampilkan: {filteredFrames.length} dari {frames.length} template
        </div>
      </div>

      {/* Content Table / Drag-and-drop */}
      {isLoading ? (
        <div className="p-12 text-center bg-stone-50 rounded-2xl border border-stone-200">
          <Loader2 className="w-8 h-8 text-stone-900 animate-spin mx-auto mb-2" />
          <span className="text-xs font-serif text-stone-600">Memuat template frame...</span>
        </div>
      ) : filteredFrames.length === 0 ? (
        <div className="p-12 text-center bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200">
          <ImageIcon className="w-10 h-10 text-stone-400 mx-auto mb-2" />
          <h3 className="font-serif font-bold text-sm text-stone-900">Belum ada Template Frame</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            {searchTerm || selectedCategoryFilter !== 'all'
              ? 'Tidak ada template yang cocok dengan filter pencarian.'
              : 'Buat template frame baru untuk mulai menyediakan photobooth untuk tamu.'}
          </p>
          <button
            onClick={() => onNavigate('/admin/studio/templates/new')}
            className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 rounded-full border-2 border-black bg-white hover:bg-stone-100 text-stone-900 text-xs font-serif font-bold shadow-xs active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Template Sekarang</span>
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table with DnD Reordering */}
          <div className="hidden md:block overflow-hidden rounded-2xl border-2 border-stone-200 shadow-xs bg-white">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-stone-100/90 text-stone-700 font-serif uppercase tracking-wider text-[11px] border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center font-bold"></th>
                    <th className="py-3 px-3 w-10 text-center font-bold">No</th>
                    <th className="py-3 px-3 w-20 font-bold">Thumbnail</th>
                    <th className="py-3 px-4 font-bold">Nama Template</th>
                    <th className="py-3 px-4 font-bold">Kategori User</th>
                    <th className="py-3 px-4 font-bold text-center">Jumlah Foto</th>
                    <th className="py-3 px-4 font-bold text-center">Status</th>
                    <th className="py-3 px-4 w-32 text-right font-bold">Aksi</th>
                  </tr>
                </thead>
                <SortableContext
                  items={filteredFrames.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody className="divide-y divide-stone-100">
                    {filteredFrames.map((frame, index) => (
                      <SortableTableRow
                        key={frame.id}
                        frame={frame}
                        index={index}
                        categoryName={getCategoryName(frame.category_id)}
                        onEdit={(id) => onNavigate(`/admin/studio/templates/edit/${id}`)}
                        onDuplicate={handleDuplicate}
                        onDelete={(f) => setFrameToDelete(f)}
                        onToggleStatus={handleToggleStatus}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
          </div>

          {/* Mobile Card List (< 768px) */}
          <div className="md:hidden space-y-3">
            {filteredFrames.map((frame, index) => (
              <div
                key={frame.id}
                className="p-4 bg-white rounded-2xl border-2 border-stone-200 shadow-xs space-y-3"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-16 h-24 bg-stone-100 rounded-xl overflow-hidden border border-stone-300 p-1 shrink-0 flex items-center justify-center">
                    <img
                      src={frame.thumbnail_url || frame.preview_url || frame.image_url}
                      alt={frame.name}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex-1 overflow-hidden space-y-1">
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block">
                        #{index + 1} &bull; {frame.canvas_width}x{frame.canvas_height}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(frame.id, frame.is_active ?? true)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          frame.is_active !== false
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-stone-100 text-stone-500 border-stone-300'
                        }`}
                      >
                        {frame.is_active !== false ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </div>

                    <h4 className="font-serif font-bold text-sm text-stone-950 truncate">
                      {frame.name}
                    </h4>

                    <div className="flex flex-wrap gap-1 text-[11px]">
                      <span className="px-2 py-0.5 rounded-full bg-stone-100 border border-stone-300 text-stone-700 font-serif">
                        {getCategoryName(frame.category_id)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-900 font-mono font-bold">
                        {frame.photo_count} Foto
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-100">
                  <button
                    onClick={() => onNavigate(`/admin/studio/templates/edit/${frame.id}`)}
                    className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-800 text-xs font-serif font-bold hover:bg-stone-100 flex items-center space-x-1"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDuplicate(frame.id)}
                    className="p-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100"
                    title="Duplikasi"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setFrameToDelete(frame)}
                    className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Confirm Delete Dialog (Soft-delete or Permanent) */}
      <ConfirmDialog
        isOpen={!!frameToDelete}
        title="Hapus Template Frame?"
        message={
          frameToDelete ? (
            <div className="space-y-2">
              <p>
                Apakah Anda yakin ingin menghapus template{' '}
                <strong className="text-stone-950">"{frameToDelete.name}"</strong>?
              </p>
              <div className="p-3 bg-stone-100 rounded-xl border border-stone-200 text-stone-700 text-xs space-y-1">
                <p>
                  <strong>Perlindungan Data:</strong> Jika template ini sudah pernah digunakan dalam sesi
                  foto tamu, sistem akan melakukan <strong>arsip (soft-delete)</strong> agar riwayat hasil foto tamu tidak rusak.
                </p>
                <p>
                  Jika belum pernah dipakai sama sekali, template akan dihapus secara permanen.
                </p>
              </div>
            </div>
          ) : (
            ''
          )
        }
        confirmText="Hapus / Arsipkan"
        cancelText="Batal"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setFrameToDelete(null)}
      />
    </div>
  );
};
