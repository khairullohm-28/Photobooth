import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderPlus,
  Search,
  Pencil,
  Trash2,
  FolderOpen,
  Calendar,
  Layers,
  AlertCircle,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { TemplateCategory, Frame } from '../../types/photobooth';
import { StudioService } from '../../services/studioService';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface CategoryWithStats extends TemplateCategory {
  templateCount: number;
  eventsUsedCount: number;
  eventNames: string[];
}

export const TemplateCategoriesPage: React.FC = () => {
  const { addToast } = useToast();
  const [categories, setCategories] = useState<CategoryWithStats[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryWithStats | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirm dialog
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryWithStats | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await StudioService.getCategoriesWithStats();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load template categories:', err);
      addToast('Gagal memuat kategori template', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setCategoryNameInput('');
    setEditingCategory(null);
    setModalMode('create');
  };

  // Open Edit Modal
  const handleOpenEdit = (cat: CategoryWithStats) => {
    setEditingCategory(cat);
    setCategoryNameInput(cat.name);
    setModalMode('edit');
  };

  // Submit Modal Form (Create or Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = categoryNameInput.trim();
    if (!trimmed) {
      addToast('Nama kategori tidak boleh kosong', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === 'create') {
        const res = await StudioService.createCategory(trimmed);
        if (res.success && res.category) {
          addToast(`Kategori "${trimmed}" berhasil ditambahkan`, 'success');
          setModalMode(null);
          await loadData();
        } else {
          addToast(res.error || 'Gagal menambahkan kategori', 'error');
        }
      } else if (modalMode === 'edit' && editingCategory) {
        const res = await StudioService.updateCategory(editingCategory.id, trimmed);
        if (res.success && res.category) {
          addToast(`Kategori berhasil diperbarui menjadi "${trimmed}"`, 'success');
          setModalMode(null);
          await loadData();
        } else {
          addToast(res.error || 'Gagal mengubah kategori', 'error');
        }
      }
    } catch (err: any) {
      addToast(err?.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute Category Deletion (with Guard)
  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);
    try {
      const res = await StudioService.deleteCategory(categoryToDelete.id);
      if (res.success) {
        addToast(`Kategori "${categoryToDelete.name}" berhasil dihapus`, 'success');
        setCategoryToDelete(null);
        await loadData();
      } else {
        // Detailed error message from guard
        addToast(res.error || 'Kategori tidak dapat dihapus', 'error');
      }
    } catch (err: any) {
      addToast(err?.message || 'Gagal menghapus kategori', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered categories by search
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">
            Kategori Template
          </h1>
          <p className="text-xs text-stone-500 font-sans mt-1">
            Kelola pengelompokan frame photobooth berdasarkan pernikahan atau seri tema.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-full border-2 border-black bg-stone-900 hover:bg-black text-white text-xs font-serif font-bold shadow-sm active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Tambah Kategori</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-3 bg-stone-50 p-2.5 rounded-2xl border-2 border-stone-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama kategori..."
            className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-stone-300 text-xs font-sans text-stone-900 focus:outline-hidden focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-all"
          />
        </div>
        <span className="text-xs font-mono text-stone-500 font-medium px-2 shrink-0">
          Total: {categories.length}
        </span>
      </div>

      {/* Main Table / Card List */}
      {isLoading ? (
        <div className="p-12 text-center bg-stone-50 rounded-2xl border border-stone-200">
          <Loader2 className="w-8 h-8 text-stone-900 animate-spin mx-auto mb-2" />
          <span className="text-xs font-serif text-stone-600">Memuat kategori template...</span>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-12 text-center bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200">
          <FolderOpen className="w-10 h-10 text-stone-400 mx-auto mb-2" />
          <h3 className="font-serif font-bold text-sm text-stone-900">Belum ada Kategori</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? `Tidak ada kategori yang cocok dengan pencarian "${searchTerm}".`
              : 'Tambahkan kategori baru untuk mulai mengelompokkan template frame.'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 rounded-full border-2 border-black bg-white hover:bg-stone-100 text-stone-900 text-xs font-serif font-bold shadow-xs active:scale-95 transition-all"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Tambah Kategori Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border-2 border-stone-200 shadow-xs bg-white">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-stone-100/90 text-stone-700 font-serif uppercase tracking-wider text-[11px] border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center font-bold">No</th>
                  <th className="py-3 px-4 font-bold">Nama Kategori</th>
                  <th className="py-3 px-4 font-bold text-center">Jumlah Template</th>
                  <th className="py-3 px-4 font-bold">Dipakai oleh User (Acara)</th>
                  <th className="py-3 px-4 w-28 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredCategories.map((cat, index) => (
                  <tr
                    key={cat.id}
                    className="hover:bg-stone-50/80 transition-colors group"
                  >
                    <td className="py-3.5 px-4 text-center font-mono text-stone-400 font-semibold">
                      {index + 1}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-stone-900 font-serif">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-stone-950">{cat.name}</span>
                        <span className="text-[10px] font-mono text-stone-400">({cat.id})</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200">
                        <Layers className="w-3 h-3 text-amber-600" />
                        <span>{cat.templateCount} Template</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {cat.eventsUsedCount > 0 ? (
                        <div className="flex flex-wrap gap-1 items-center">
                          {cat.eventNames.map((name, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-serif font-medium bg-stone-100 text-stone-800 border border-stone-300"
                            >
                              <Calendar className="w-3 h-3 text-stone-500" />
                              <span>{name}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-stone-400 text-xs italic">Belum dipakai</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleOpenEdit(cat)}
                          className="p-1.5 rounded-lg border border-stone-300 text-stone-700 hover:text-black hover:bg-stone-100 hover:border-black transition-all cursor-pointer"
                          title="Edit Kategori"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setCategoryToDelete(cat)}
                          className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:text-white hover:bg-red-600 hover:border-red-600 transition-all cursor-pointer"
                          title="Hapus Kategori"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (< 768px) */}
          <div className="md:hidden space-y-3">
            {filteredCategories.map((cat, index) => (
              <div
                key={cat.id}
                className="p-4 bg-white rounded-2xl border-2 border-stone-200 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block">
                      #{index + 1} &bull; {cat.id}
                    </span>
                    <h4 className="font-serif font-bold text-base text-stone-950 mt-0.5">
                      {cat.name}
                    </h4>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEdit(cat)}
                      className="p-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 transition-all"
                      title="Edit Kategori"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCategoryToDelete(cat)}
                      className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-all"
                      title="Hapus Kategori"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs pt-2 border-t border-stone-100">
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200">
                    <Layers className="w-3 h-3 text-amber-600" />
                    <span>{cat.templateCount} Template</span>
                  </span>

                  {cat.eventsUsedCount > 0 ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-serif font-medium bg-stone-100 text-stone-800 border border-stone-300">
                      <Calendar className="w-3 h-3 text-stone-500" />
                      <span>{cat.eventNames.join(', ')}</span>
                    </span>
                  ) : (
                    <span className="text-stone-400 text-xs italic py-1">Belum dipakai acara</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal: Tambah / Edit Kategori */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-3xl border-2 border-black p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <h3 className="font-serif font-bold text-lg text-stone-950">
                {modalMode === 'create' ? 'Tambah Kategori Template' : 'Edit Kategori Template'}
              </h3>
              <button
                onClick={() => setModalMode(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-serif font-bold text-stone-800 mb-1.5">
                  Nama Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={categoryNameInput}
                  onChange={(e) => setCategoryNameInput(e.target.value)}
                  placeholder="Contoh: Monika & David, Elegan Series, dsb."
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-black text-xs font-sans text-stone-950 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-stone-900"
                />
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Nama kategori harus unik dan mendeskripsikan pengantin atau tema frame.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-full border border-stone-300 text-stone-700 text-xs font-serif hover:bg-stone-100 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-full border-2 border-black bg-stone-900 hover:bg-black text-white text-xs font-serif font-bold shadow-sm active:scale-95 transition-all"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{modalMode === 'create' ? 'Simpan Kategori' : 'Perbarui'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog: Hapus Kategori */}
      <ConfirmDialog
        isOpen={!!categoryToDelete}
        title="Hapus Kategori Template?"
        message={
          categoryToDelete ? (
            <div className="space-y-2">
              <p>
                Apakah Anda yakin ingin menghapus kategori{' '}
                <strong className="text-stone-950">"{categoryToDelete.name}"</strong>?
              </p>
              {categoryToDelete.templateCount > 0 && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-800 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span>
                    Kategori ini masih memiliki{' '}
                    <strong>{categoryToDelete.templateCount} template</strong>. Penghapusan akan
                    ditolak oleh sistem sampai semua template dipindahkan atau dihapus.
                  </span>
                </div>
              )}
              {categoryToDelete.eventsUsedCount > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    Kategori ini sedang digunakan oleh acara:{' '}
                    <strong>{categoryToDelete.eventNames.join(', ')}</strong>.
                  </span>
                </div>
              )}
            </div>
          ) : (
            ''
          )
        }
        confirmText="Hapus Kategori"
        cancelText="Batal"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setCategoryToDelete(null)}
      />
    </div>
  );
};
