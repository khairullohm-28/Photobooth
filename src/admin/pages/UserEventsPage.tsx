import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  QrCode,
  ExternalLink,
  Calendar,
  Layers,
  AlertTriangle,
  Loader2,
  Check,
  X,
  Users,
  Copy,
  Printer,
  ChevronLeft,
  ChevronRight,
  Filter as FilterIcon,
} from 'lucide-react';
import { Event, TemplateCategory } from '../../types/photobooth';
import { AppSettings, AdminProfile } from '../../types/admin';
import { EventService } from '../../services/eventService';
import { StudioService } from '../../services/studioService';
import { useToast } from '../components/Toast';
import { UserEventFormModal } from './UserEventFormModal';
import { QrPosterModal } from '../components/QrPosterModal';

interface UserEventsPageProps {
  currentAdmin: AdminProfile;
  appSettings: AppSettings;
  onNavigate: (path: string) => void;
}

export const UserEventsPage: React.FC<UserEventsPageProps> = ({
  currentAdmin,
  appSettings,
  onNavigate,
}) => {
  const { addToast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'semua' | 'aktif' | 'nonaktif' | 'selesai'>('semua');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);

  // Poster Modal
  const [posterEvent, setPosterEvent] = useState<Event | null>(null);

  // Hard Delete Modal State
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eventsData, categoriesData] = await Promise.all([
        EventService.getEvents(currentAdmin),
        StudioService.getCategories(),
      ]);

      setEvents(eventsData);

      // Build category lookup map
      const catMap: Record<string, string> = {};
      categoriesData.forEach((cat) => {
        catMap[cat.id] = cat.name;
      });
      setCategoryNames(catMap);

      // Fetch session count per event
      const countMap: Record<string, number> = {};
      await Promise.all(
        eventsData.map(async (ev) => {
          countMap[ev.id] = await EventService.getSessionCount(ev.id);
        })
      );
      setSessionCounts(countMap);
    } catch (err) {
      console.error('Failed to load events:', err);
      addToast('Gagal memuat daftar acara', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [currentAdmin, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered & Paginated Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchSearch =
        ev.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.couple_names.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.code_prefix.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === 'semua' ? true : (ev.status || 'aktif') === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [events, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredEvents.length / pageSize) || 1;
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  // Handle Hard Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;

    if (deleteConfirmationInput.trim() !== eventToDelete.name.trim()) {
      addToast(`Nama konfirmasi tidak cocok. Harap ketik "${eventToDelete.name}" dengan tepat.`, 'error');
      return;
    }

    setIsDeleting(true);
    try {
      await EventService.deleteEvent(eventToDelete.id, deleteConfirmationInput);
      addToast(`User acara "${eventToDelete.name}" berhasil dihapus`, 'success');
      setEventToDelete(null);
      setDeleteConfirmationInput('');
      loadData();
    } catch (err: any) {
      console.error('Delete event error:', err);
      addToast(err.message || 'Gagal menghapus acara', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const getGuestUrl = (slug: string) => {
    const base = (appSettings.public_base_url || window.location.origin).replace(/\/+$/, '');
    return `${base}/e/${slug}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h1 className="font-serif font-bold text-2xl text-stone-900 tracking-tight">
            Manajemen User (Acara Pernikahan)
          </h1>
          <p className="font-sans text-xs text-stone-500 mt-1">
            Kelola setiap pernikahan sebagai user terpisah lengkap dengan link, QR, frame, dan background unik
          </p>
        </div>

        <button
          onClick={() => {
            setEventToEdit(null);
            setIsFormModalOpen(true);
          }}
          className="px-4 py-2 rounded-full border-2 border-black bg-stone-900 hover:bg-black text-white text-xs font-bold font-sans flex items-center space-x-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah User</span>
        </button>
      </div>

      {/* Yellow Warning Alert if public_base_url is missing */}
      {!appSettings.public_base_url && (
        <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-serif font-bold text-sm text-amber-900">
                URL Publik Website Belum Diatur
              </p>
              <p className="text-amber-800 mt-0.5 leading-relaxed">
                QR code dan link tamu saat ini menggunakan origin preview lokal (<code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono">{window.location.origin}</code>). Pastikan Anda memasukkan URL domain resmi di menu <strong>Setting &gt; Website Admin</strong> agar QR tamu dapat dipindai langsung dari smartphone.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('/admin/settings/website')}
            className="px-3.5 py-1.5 rounded-full border border-amber-800 hover:bg-amber-100 text-amber-900 text-xs font-serif font-bold whitespace-nowrap cursor-pointer shrink-0"
          >
            Atur Domain Sekarang →
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari nama acara, pasangan, slug, prefix..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border-2 border-black bg-white text-stone-900 text-xs focus:outline-none"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center bg-stone-100 rounded-full p-1 border border-stone-200 self-start sm:self-auto">
          {(['semua', 'aktif', 'nonaktif', 'selesai'] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full text-xs font-serif font-bold capitalize transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-black text-white shadow-2xs'
                  : 'text-stone-600 hover:text-black'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table & Cards Container */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-stone-500">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <span className="font-serif text-xs">Memuat daftar acara...</span>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-stone-200 rounded-2xl p-8">
          <Users className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <h3 className="font-serif font-bold text-base text-stone-800">
            {searchTerm || statusFilter !== 'semua'
              ? 'Tidak ada acara yang cocok dengan pencarian'
              : 'Belum Ada User Acara'}
          </h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'semua'
              ? 'Coba ganti kata kunci pencarian atau filter status'
              : 'Tambahkan acara pernikahan pertama dengan tombol "Tambah User" di atas'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-black shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-black bg-stone-100/70 text-[11px] font-serif font-bold text-stone-700 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama User / Acara</th>
                  <th className="py-3 px-4">Tanggal Acara</th>
                  <th className="py-3 px-4">Kategori Template</th>
                  <th className="py-3 px-4 text-center">Jumlah Sesi</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-xs">
                {paginatedEvents.map((ev, index) => {
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;
                  const catName = ev.template_category_id
                    ? categoryNames[ev.template_category_id] || 'Kategori Khusus'
                    : 'Belum Disetel';
                  const sessions = sessionCounts[ev.id] ?? 0;
                  const evStatus = ev.status || (ev.is_active ? 'aktif' : 'nonaktif');

                  return (
                    <tr
                      key={ev.id}
                      className="hover:bg-stone-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 text-center font-mono text-stone-400 font-semibold">
                        {rowNumber}
                      </td>

                      {/* Nama User with Slug & Prefix */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-serif font-bold text-sm text-stone-900">
                            {ev.name}
                          </span>
                          <div className="flex items-center space-x-2 mt-0.5">
                            <span className="font-mono text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                              /e/{ev.slug}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Prefix: {ev.code_prefix}
                            </span>
                            {ev.is_demo && (
                              <span className="text-[9px] font-bold uppercase text-stone-400 border border-stone-200 px-1 rounded">
                                Demo
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tanggal Acara */}
                      <td className="py-3 px-4 font-sans text-stone-600">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          <span>{ev.event_date || 'Belum diatur'}</span>
                        </div>
                      </td>

                      {/* Kategori Template */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200 text-[11px] font-serif font-medium">
                          <Layers className="w-3 h-3 text-stone-500" />
                          <span className="truncate max-w-[150px]">{catName}</span>
                        </span>
                      </td>

                      {/* Jumlah Sesi */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-stone-100 border border-stone-300 text-stone-800">
                          {sessions} sesi
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-serif font-bold capitalize border ${
                            evStatus === 'aktif'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : evStatus === 'selesai'
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : 'bg-stone-100 text-stone-500 border-stone-300'
                          }`}
                        >
                          {evStatus}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* QR Poster Button */}
                          <button
                            type="button"
                            onClick={() => setPosterEvent(ev)}
                            className="p-1.5 rounded-lg border border-stone-300 hover:border-black hover:bg-stone-100 text-stone-700 transition-colors"
                            title="QR Code & Cetak Poster"
                            aria-label="QR Code & Poster"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

                          {/* Lihat Booking */}
                          <button
                            type="button"
                            onClick={() => onNavigate(`/admin/booking/results`)}
                            className="px-2.5 py-1 rounded-lg border border-stone-300 hover:border-black hover:bg-stone-50 text-stone-700 text-[11px] font-serif font-medium transition-colors"
                            title="Buka hasil booking foto"
                          >
                            Booking
                          </button>

                          {/* Edit Event */}
                          <button
                            type="button"
                            onClick={() => {
                              setEventToEdit(ev);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-stone-300 hover:border-black hover:bg-stone-100 text-stone-700 transition-colors"
                            title="Edit User Acara"
                            aria-label="Edit User"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Event */}
                          <button
                            type="button"
                            onClick={() => {
                              setEventToDelete(ev);
                              setDeleteConfirmationInput('');
                            }}
                            className="p-1.5 rounded-lg border border-stone-300 hover:border-rose-600 hover:bg-rose-50 text-stone-700 hover:text-rose-600 transition-colors"
                            title="Hapus Acara"
                            aria-label="Hapus Acara"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-xs font-serif">
              <span className="text-stone-500">
                Menampilkan halaman {currentPage} dari {totalPages} ({filteredEvents.length} total)
              </span>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
                  aria-label="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono px-2 py-0.5 text-stone-700 font-bold">
                  {currentPage}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
                  aria-label="Halaman Berikutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Form Modal (Create / Edit) */}
      {isFormModalOpen && (
        <UserEventFormModal
          isOpen={isFormModalOpen}
          eventToEdit={eventToEdit}
          appSettings={appSettings}
          onClose={() => {
            setIsFormModalOpen(false);
            setEventToEdit(null);
          }}
          onSaved={() => {
            loadData();
          }}
        />
      )}

      {/* QR Poster Modal */}
      {posterEvent && (
        <QrPosterModal
          isOpen={!!posterEvent}
          event={posterEvent}
          appSettings={appSettings}
          guestUrl={getGuestUrl(posterEvent.slug)}
          onClose={() => setPosterEvent(null)}
        />
      )}

      {/* Hard Delete Confirmation Dialog */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border-2 border-black max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-stone-900">
                  Hapus User Acara Pernikahan
                </h3>
                <p className="text-[11px] text-stone-500 font-sans">
                  Tindakan ini permanen dan tidak dapat dibatalkan
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 font-sans leading-relaxed">
              Menghapus acara ini akan menghapus semua konfigurasi background, pengaturan waktu retensi, dan data sesi terkait.
            </p>

            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 space-y-2">
              <p className="text-xs text-rose-900 font-serif">
                Ketik nama acara <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-rose-300">{eventToDelete.name}</strong> untuk konfirmasi:
              </p>
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                placeholder={eventToDelete.name}
                className="w-full px-3 py-2 rounded-lg border-2 border-rose-400 bg-white text-stone-900 text-xs font-mono focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setEventToDelete(null)}
                className="px-4 py-2 rounded-full border border-stone-300 hover:border-black font-sans text-xs font-bold text-stone-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting || deleteConfirmationInput.trim() !== eventToDelete.name.trim()}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-full border-2 border-rose-700 bg-rose-600 hover:bg-rose-700 text-white font-sans text-xs font-bold flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer shadow-xs active:scale-95"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Konfirmasi Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
