import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Printer,
  Copy,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Eye,
  X,
  Layers,
  FileCheck,
  Check,
  Calendar,
  Users,
  Download,
  Trash2,
  PlusCircle,
  ArrowLeft,
  CheckSquare,
  Square,
  FileArchive,
  Image as ImageIcon,
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  Session,
  SessionAsset,
  Event,
  PrintProfile,
} from '../../types/photobooth';
import { AdminProfile } from '../../types/admin';
import { PhotoboothService } from '../../services/supabase';
import { EventService } from '../../services/eventService';
import { PrinterService } from '../../services/printerService';
import {
  isTolerantMatch,
  parseMultipleCodes,
  extractSessionIdFromUrlOrText,
  normalizeCodeForMatching,
} from '../../utils/codeSearch';
import { formatCountdownTimer } from '../../utils/canvas';
import { useToast } from '../components/Toast';
import { SkeletonLoader, EmptyState, ConfirmDialog } from '../components/CommonFeedback';

interface BookingResultsPageProps {
  currentAdmin: AdminProfile;
  initialEventId?: string;
}

export const BookingResultsPage: React.FC<BookingResultsPageProps> = ({
  currentAdmin,
  initialEventId,
}) => {
  const { showToast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Level Navigation: Level 1 (Event List) vs Level 2 (Sessions in Event)
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Sessions and assets
  const [sessionsWithAssets, setSessionsWithAssets] = useState<
    { session: Session; assets: SessionAsset[] }[]
  >([]);
  const [profiles, setProfiles] = useState<PrintProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters on Level 2
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPrintStatus, setFilterPrintStatus] = useState<
    'all' | 'printed' | 'unprinted'
  >('all');
  const [filterTemplate, setFilterTemplate] = useState<string>('all');
  const [filterFilterName, setFilterFilterName] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');

  // Multi-select for batch operations
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

  // Modal: Detail Sesi
  const [detailItem, setDetailItem] = useState<{
    session: Session;
    assets: SessionAsset[];
  } | null>(null);

  // Modal: Dialog Cetak
  const [printModalItem, setPrintModalItem] = useState<{
    session: Session;
    frameUrl: string;
  } | null>(null);
  const [selectedPrintProfileId, setSelectedPrintProfileId] = useState<string>('');
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [printCodeFooter, setPrintCodeFooter] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Modal: Quick Print (Cetak Cepat Multi-Kode)
  const [isQuickPrintOpen, setIsQuickPrintOpen] = useState<boolean>(false);
  const [quickPrintInput, setQuickPrintInput] = useState<string>('');
  const [quickPrintCopies, setQuickPrintCopies] = useState<number>(1);

  // ZIP Download Progress
  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const [zipStatusText, setZipStatusText] = useState<string>('');

  // Delete Confirm Dialog
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  // 1. Load initial events & printer profiles
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [eventsData, profilesData, allSessions] = await Promise.all([
        EventService.getEvents(currentAdmin),
        PrinterService.getProfiles(),
        PhotoboothService.listAllSessions(currentAdmin),
      ]);
      setEvents(eventsData);
      setProfiles(profilesData);
      setSessionsWithAssets(allSessions);

      const defaultProf = profilesData.find((p) => p.is_default) || profilesData[0];
      if (defaultProf) {
        setSelectedPrintProfileId(defaultProf.id);
      }

      // If initialEventId provided, open that event directly
      if (initialEventId) {
        const targetEv = eventsData.find((e) => e.id === initialEventId);
        if (targetEv) setSelectedEvent(targetEv);
      }
    } catch {
      showToast('Gagal memuat data booking', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Autofocus search input when entering Level 2
  useEffect(() => {
    if (selectedEvent && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [selectedEvent]);

  // Aggregate stats per event for Level 1
  const eventSummaries = useMemo(() => {
    return events.map((ev) => {
      const evSessions = sessionsWithAssets.filter(
        (s) => s.session.event_id === ev.id
      );
      const totalPhotos = evSessions.reduce(
        (acc, curr) =>
          acc + curr.assets.filter((a) => a.type === 'raw_photo' || a.type === 'frame_result').length,
        0
      );
      const lastSessionTime = evSessions.length > 0 ? evSessions[0].session.created_at : null;

      return {
        event: ev,
        sessionCount: evSessions.length,
        photoCount: totalPhotos,
        lastActivity: lastSessionTime,
      };
    });
  }, [events, sessionsWithAssets]);

  // Filtered sessions for Level 2
  const currentEventSessions = useMemo(() => {
    if (!selectedEvent) return [];
    return sessionsWithAssets.filter(
      (item) => item.session.event_id === selectedEvent.id
    );
  }, [selectedEvent, sessionsWithAssets]);

  const filteredSessions = useMemo(() => {
    if (!selectedEvent) return [];
    const prefix = selectedEvent.code_prefix || 'KL';

    return currentEventSessions.filter(({ session }) => {
      // Print status filter
      if (filterPrintStatus === 'printed' && (session.printed_count || 0) <= 0) return false;
      if (filterPrintStatus === 'unprinted' && (session.printed_count || 0) > 0) return false;

      // Date filter
      if (filterDate && !session.created_at.startsWith(filterDate)) return false;

      // Tolerant search:
      // Accepts:
      // 1. Pure numbers ("42" matches `${prefix}-0042`)
      // 2. Full or partial code ("mnd42", "MND 42", "mnd-0042")
      // 3. Full USB barcode URL with UUID
      if (searchQuery.trim()) {
        const match = isTolerantMatch(
          searchQuery,
          session.session_code,
          session.id,
          prefix
        );
        if (!match) return false;
      }

      return true;
    });
  }, [
    selectedEvent,
    currentEventSessions,
    searchQuery,
    filterPrintStatus,
    filterDate,
  ]);

  // Handle Enter key on search input (Single result auto-open)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSessions.length === 1) {
        setDetailItem(filteredSessions[0]);
      } else if (filteredSessions.length === 0 && searchQuery.trim()) {
        showToast(`Tidak ditemukan sesi dengan kode "${searchQuery}"`, 'error');
      }
    }
  };

  // Multi-select toggle
  const toggleSelectSession = (id: string) => {
    const next = new Set(selectedSessionIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSessionIds(next);
  };

  const selectAllFiltered = () => {
    if (selectedSessionIds.size === filteredSessions.length) {
      setSelectedSessionIds(new Set());
    } else {
      setSelectedSessionIds(new Set(filteredSessions.map((s) => s.session.id)));
    }
  };

  // Execute Print via hidden iframe and record job
  const handleExecutePrint = async () => {
    if (!printModalItem) return;
    const targetProfile =
      profiles.find((p) => p.id === selectedPrintProfileId) || profiles[0];
    if (!targetProfile) {
      showToast('Profil printer tidak valid', 'error');
      return;
    }

    setIsPrinting(true);
    try {
      const ok = await PrinterService.printImage(
        printModalItem.frameUrl,
        targetProfile,
        {
          copies: printCopies,
          printCodeFooter,
          sessionCode: printModalItem.session.session_code,
        }
      );

      if (ok) {
        await PhotoboothService.recordPrintJob(
          printModalItem.session.id,
          printCopies,
          targetProfile.id,
          currentAdmin.display_name
        );

        // Update in-memory session print count
        setSessionsWithAssets((prev) =>
          prev.map((item) =>
            item.session.id === printModalItem.session.id
              ? {
                  ...item,
                  session: {
                    ...item.session,
                    printed_count: (item.session.printed_count || 0) + printCopies,
                  },
                }
              : item
          )
        );

        if (detailItem && detailItem.session.id === printModalItem.session.id) {
          setDetailItem((prev) =>
            prev
              ? {
                  ...prev,
                  session: {
                    ...prev.session,
                    printed_count: (prev.session.printed_count || 0) + printCopies,
                  },
                }
              : null
          );
        }

        showToast(
          `Berhasil mencetak ${printCopies}x untuk ${printModalItem.session.session_code}`,
          'success'
        );
        setPrintModalItem(null);
      } else {
        showToast('Proses cetak dibatalkan atau terganggu', 'info');
      }
    } catch {
      showToast('Gagal memproses cetak', 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  // Quick Print (Cetak Cepat Multi-Kode) Analysis
  const quickPrintAnalysis = useMemo(() => {
    const rawTokens = parseMultipleCodes(quickPrintInput);
    if (rawTokens.length === 0) return { matched: [], missing: [], expired: [] };

    const matchedMap = new Map<
      string,
      { session: Session; assets: SessionAsset[]; code: string }
    >();
    const missing: string[] = [];
    const expired: { token: string; session: Session }[] = [];

    for (const token of rawTokens) {
      const found = sessionsWithAssets.find(({ session }) =>
        isTolerantMatch(
          token,
          session.session_code,
          session.id,
          selectedEvent?.code_prefix || 'KL'
        )
      );

      if (!found) {
        missing.push(token);
      } else {
        const isExp =
          found.session.status === 'kedaluwarsa' ||
          new Date(found.session.expires_at).getTime() <= Date.now();
        if (isExp) {
          expired.push({ token, session: found.session });
        } else {
          matchedMap.set(found.session.id, {
            ...found,
            code: found.session.session_code,
          });
        }
      }
    }

    return {
      matched: Array.from(matchedMap.values()),
      missing,
      expired,
    };
  }, [quickPrintInput, sessionsWithAssets, selectedEvent]);

  // Execute Batch Print from Quick Print
  const handleExecuteQuickPrint = async () => {
    if (quickPrintAnalysis.matched.length === 0) return;
    const targetProfile =
      profiles.find((p) => p.id === selectedPrintProfileId) || profiles[0];
    if (!targetProfile) return;

    setIsPrinting(true);
    let successCount = 0;

    try {
      for (const item of quickPrintAnalysis.matched) {
        const frameAsset = item.assets.find((a) => a.type === 'frame_result');
        if (frameAsset?.url) {
          await PrinterService.printImage(frameAsset.url, targetProfile, {
            copies: quickPrintCopies,
            printCodeFooter,
            sessionCode: item.session.session_code,
          });

          await PhotoboothService.recordPrintJob(
            item.session.id,
            quickPrintCopies,
            targetProfile.id,
            currentAdmin.display_name
          );
          successCount++;
        }
      }

      showToast(`Berhasil mencetak ${successCount} sesi foto`, 'success');
      setIsQuickPrintOpen(false);
      setQuickPrintInput('');
      loadInitialData();
    } catch {
      showToast('Gagal mencetak seluruh antrean', 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  // Batch Print Selected Sessions
  const handlePrintBatchSelected = async () => {
    if (selectedSessionIds.size === 0) return;
    const targetProfile =
      profiles.find((p) => p.id === selectedPrintProfileId) || profiles[0];
    if (!targetProfile) return;

    setIsPrinting(true);
    let count = 0;
    try {
      for (const id of Array.from(selectedSessionIds)) {
        const item = sessionsWithAssets.find((s) => s.session.id === id);
        const frame = item?.assets.find((a) => a.type === 'frame_result');
        if (frame?.url && item) {
          await PrinterService.printImage(frame.url, targetProfile, {
            copies: 1,
            printCodeFooter,
            sessionCode: item.session.session_code,
          });
          await PhotoboothService.recordPrintJob(
            item.session.id,
            1,
            targetProfile.id,
            currentAdmin.display_name
          );
          count++;
        }
      }
      showToast(`Berhasil mencetak ${count} sesi terpilih`, 'success');
      setSelectedSessionIds(new Set());
      setIsSelectMode(false);
      loadInitialData();
    } catch {
      showToast('Gagal memproses cetak massal', 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  // Single or Batch ZIP Download using JSZip + FileSaver with progress
  const handleDownloadZip = async (
    itemsToZip: { session: Session; assets: SessionAsset[] }[],
    zipFileName: string
  ) => {
    if (itemsToZip.length === 0) return;
    setZipProgress(5);
    setZipStatusText('Menyiapkan file ZIP...');

    try {
      const zip = new JSZip();

      for (let i = 0; i < itemsToZip.length; i++) {
        const item = itemsToZip[i];
        const folderName = item.session.session_code || item.session.id.slice(0, 8);
        const sessionFolder = zip.folder(folderName);

        setZipStatusText(
          `Memproses ${i + 1}/${itemsToZip.length}: ${folderName}...`
        );
        setZipProgress(Math.round(10 + ((i + 1) / itemsToZip.length) * 60));

        for (const asset of item.assets) {
          try {
            let data: Blob | string | null = null;
            if (asset.url.startsWith('data:')) {
              const base64Content = asset.url.split(',')[1];
              sessionFolder?.file(
                `${asset.type}_${asset.shot_index ?? 0}.${
                  asset.type === 'gif' ? 'gif' : 'png'
                }`,
                base64Content,
                { base64: true }
              );
            } else {
              const res = await fetch(asset.url);
              const blob = await res.blob();
              sessionFolder?.file(
                `${asset.type}_${asset.shot_index ?? 0}.${
                  asset.type === 'gif' ? 'gif' : 'png'
                }`,
                blob
              );
            }
          } catch (e) {
            console.warn('Asset zip fetch issue:', e);
          }
        }
      }

      setZipStatusText('Mengompresi arsip ZIP...');
      const content = await zip.generateAsync(
        { type: 'blob' },
        (metadata) => {
          setZipProgress(70 + Math.round(metadata.percent * 0.3));
        }
      );

      saveAs(content, `${zipFileName}.zip`);
      showToast('Arsip ZIP berhasil diunduh', 'success');
    } catch (err) {
      console.error('ZIP creation error:', err);
      showToast('Gagal membuat arsip ZIP', 'error');
    } finally {
      setZipProgress(null);
      setZipStatusText('');
    }
  };

  // Extend Retention
  const handleExtendRetention = async (sessionId: string, hours: number) => {
    try {
      const updated = await PhotoboothService.extendRetention(sessionId, hours);
      if (updated) {
        setSessionsWithAssets((prev) =>
          prev.map((item) =>
            item.session.id === sessionId ? { ...item, session: updated } : item
          )
        );
        if (detailItem && detailItem.session.id === sessionId) {
          setDetailItem({ ...detailItem, session: updated });
        }
        showToast(`Masa simpan diperpanjang +${hours} jam`, 'success');
      }
    } catch {
      showToast('Gagal memperpanjang retensi', 'error');
    }
  };

  // Delete Session
  const handleDeleteSession = async () => {
    if (!deleteSessionId) return;
    try {
      await PhotoboothService.deleteSession(deleteSessionId);
      setSessionsWithAssets((prev) =>
        prev.filter((i) => i.session.id !== deleteSessionId)
      );
      if (detailItem && detailItem.session.id === deleteSessionId) {
        setDetailItem(null);
      }
      showToast('Sesi foto berhasil dihapus', 'success');
      setDeleteSessionId(null);
    } catch {
      showToast('Gagal menghapus sesi', 'error');
    }
  };

  // Format Helper
  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ==============================================================
          LEVEL 1: DAFTAR USER / ACARA PERNIKAHAN
         ============================================================== */}
      {!selectedEvent ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5 border-stone-200">
            <div>
              <h1 className="font-serif font-bold text-2xl text-stone-900 tracking-tight">
                Hasil Booking per User
              </h1>
              <p className="text-xs text-stone-500 mt-1 font-sans">
                Pilih acara pernikahan untuk melihat galeri foto, pencarian kode cepat, dan antrean cetak operator.
              </p>
            </div>

            <button
              onClick={() => setIsQuickPrintOpen(true)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full border-2 border-black bg-stone-950 text-white hover:bg-stone-800 text-xs font-serif font-bold tracking-wider transition-transform active:scale-95 shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Cetak Cepat Multi-Kode</span>
            </button>
          </div>

          {isLoading ? (
            <SkeletonLoader rows={4} />
          ) : eventSummaries.length === 0 ? (
            <EmptyState
              title="Belum Ada Acara Pernikahan"
              description="Buat acara pernikahan baru di menu User agar tamu dapat mulai berfoto."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {eventSummaries.map(({ event, sessionCount, photoCount, lastActivity }) => (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="p-5 rounded-2xl border-2 border-stone-200 hover:border-black bg-white shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 font-mono text-[10px] font-bold text-stone-700 uppercase border border-stone-200 mb-1">
                          Prefix: {event.code_prefix}
                        </span>
                        <h2 className="font-serif font-bold text-base text-stone-900 group-hover:text-black">
                          {event.name}
                        </h2>
                        <p className="text-xs text-stone-500 font-sans mt-0.5">
                          {event.couple_names} • {event.event_date}
                        </p>
                      </div>

                      {event.is_demo && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-mono text-[9px] font-bold uppercase">
                          Demo
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-stone-50 p-3 rounded-xl border border-stone-200">
                      <div>
                        <span className="block text-[10px] text-stone-400 font-mono uppercase">
                          Total Sesi
                        </span>
                        <span className="font-serif font-bold text-base text-stone-900">
                          {sessionCount}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-stone-400 font-mono uppercase">
                          Total Foto
                        </span>
                        <span className="font-serif font-bold text-base text-stone-900">
                          {photoCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-stone-500">
                      {lastActivity ? `Sesi terakhir: ${formatTime(lastActivity)}` : 'Belum ada sesi'}
                    </span>
                    <span className="font-serif font-bold text-stone-900 flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                      <span>Buka Sesi</span>
                      <span>→</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ==============================================================
            LEVEL 2: HASIL SESI PER USER / ACARA TERPILIH
           ============================================================== */
        <div className="space-y-6">
          {/* Header Level 2 */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b pb-5 border-stone-200">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setSelectedEvent(null);
                  setSearchQuery('');
                  setSelectedSessionIds(new Set());
                  setIsSelectMode(false);
                }}
                className="p-2 rounded-full border-2 border-stone-300 hover:border-black text-stone-700 hover:text-black transition-colors cursor-pointer"
                title="Kembali ke daftar acara"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="font-serif font-bold text-2xl text-stone-900 tracking-tight">
                    {selectedEvent.name}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-stone-900 text-white font-mono text-xs font-bold">
                    {selectedEvent.code_prefix}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5 font-sans">
                  {selectedEvent.couple_names} • {selectedEvent.event_date} • {filteredSessions.length} sesi ditampilkan
                </p>
              </div>
            </div>

            {/* Actions Top */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  if (isSelectMode) setSelectedSessionIds(new Set());
                }}
                className={`px-4 py-2 rounded-full border-2 text-xs font-serif font-bold transition-colors cursor-pointer ${
                  isSelectMode
                    ? 'border-black bg-stone-900 text-white'
                    : 'border-stone-300 hover:border-black bg-white text-stone-800'
                }`}
              >
                {isSelectMode ? 'Batalkan Pilihan' : 'Pilih Banyak'}
              </button>

              {isSelectMode && selectedSessionIds.size > 0 && (
                <>
                  <button
                    onClick={handlePrintBatchSelected}
                    disabled={isPrinting}
                    className="px-4 py-2 rounded-full border-2 border-black bg-stone-950 text-white text-xs font-serif font-bold flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-300" />
                    <span>Cetak Terpilih ({selectedSessionIds.size})</span>
                  </button>

                  <button
                    onClick={() => {
                      const selectedItems = currentEventSessions.filter((s) =>
                        selectedSessionIds.has(s.session.id)
                      );
                      handleDownloadZip(
                        selectedItems,
                        `batch-${selectedEvent.slug}-${selectedSessionIds.size}-sesi`
                      );
                    }}
                    className="px-4 py-2 rounded-full border-2 border-black bg-white hover:bg-stone-50 text-xs font-serif font-bold text-stone-900 flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <FileArchive className="w-3.5 h-3.5 text-stone-700" />
                    <span>Unduh ZIP ({selectedSessionIds.size})</span>
                  </button>
                </>
              )}

              <button
                onClick={() => setIsQuickPrintOpen(true)}
                className="px-4 py-2 rounded-full border-2 border-black bg-stone-950 text-white hover:bg-stone-800 text-xs font-serif font-bold tracking-wider flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-amber-300" />
                <span>Cetak Cepat</span>
              </button>
            </div>
          </div>

          {/* Search Box Besar & Autofocus */}
          <div className="p-4 rounded-2xl border-2 border-black bg-white shadow-sm space-y-3">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={`Ketik kode (contoh: 42, mnd42, MND-0042) atau scan QR tamu dengan barcode scanner...`}
                className="w-full pl-12 pr-10 py-3.5 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-sm font-mono focus:outline-none focus:bg-white shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-800 text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
              <div className="flex items-center space-x-2">
                <span className="font-serif font-bold text-stone-600">Status Cetak:</span>
                <div className="inline-flex rounded-xl border-2 border-black p-0.5 bg-stone-50">
                  <button
                    onClick={() => setFilterPrintStatus('all')}
                    className={`px-3 py-1 rounded-lg font-serif transition-colors cursor-pointer ${
                      filterPrintStatus === 'all'
                        ? 'bg-stone-950 text-white font-bold'
                        : 'text-stone-600 hover:text-black'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setFilterPrintStatus('unprinted')}
                    className={`px-3 py-1 rounded-lg font-serif transition-colors cursor-pointer ${
                      filterPrintStatus === 'unprinted'
                        ? 'bg-stone-950 text-white font-bold'
                        : 'text-stone-600 hover:text-black'
                    }`}
                  >
                    Belum Dicetak
                  </button>
                  <button
                    onClick={() => setFilterPrintStatus('printed')}
                    className={`px-3 py-1 rounded-lg font-serif transition-colors cursor-pointer ${
                      filterPrintStatus === 'printed'
                        ? 'bg-stone-950 text-white font-bold'
                        : 'text-stone-600 hover:text-black'
                    }`}
                  >
                    Sudah Dicetak
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {isSelectMode && (
                  <button
                    onClick={selectAllFiltered}
                    className="px-3 py-1.5 rounded-lg border border-black text-xs font-serif font-bold hover:bg-stone-100 cursor-pointer"
                  >
                    {selectedSessionIds.size === filteredSessions.length
                      ? 'Batal Pilih Semua'
                      : 'Pilih Semua'}
                  </button>
                )}

                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border-2 border-black bg-stone-50 font-mono text-xs cursor-pointer"
                />

                {(filterPrintStatus !== 'all' || filterDate || searchQuery) && (
                  <button
                    onClick={() => {
                      setFilterPrintStatus('all');
                      setFilterDate('');
                      setSearchQuery('');
                    }}
                    className="text-stone-500 hover:text-stone-900 underline text-xs cursor-pointer ml-2"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ZIP Progress Banner */}
          {zipProgress !== null && (
            <div className="p-4 rounded-2xl border-2 border-black bg-amber-50 shadow-sm space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-950">
                <span>{zipStatusText}</span>
                <span>{zipProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-amber-200 overflow-hidden">
                <div
                  className="h-full bg-amber-600 transition-all duration-200"
                  style={{ width: `${zipProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Grid Sesi Hasil Foto */}
          {filteredSessions.length === 0 ? (
            <EmptyState
              title="Tidak Ada Sesi Ditemukan"
              description={
                searchQuery
                  ? `Tidak ada sesi yang cocok dengan kata kunci "${searchQuery}".`
                  : 'Belum ada foto yang diambil untuk acara pernikahan ini.'
              }
              action={
                searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 rounded-full border-2 border-black text-xs font-serif font-bold hover:bg-stone-100 cursor-pointer"
                  >
                    Hapus Pencarian
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredSessions.map((item) => {
                const { session, assets } = item;
                const frameAsset = assets.find((a) => a.type === 'frame_result');
                const isExpired =
                  session.status === 'kedaluwarsa' ||
                  new Date(session.expires_at).getTime() <= Date.now();
                const diffMs = new Date(session.expires_at).getTime() - Date.now();
                const countdown = formatCountdownTimer(diffMs);
                const isSelected = selectedSessionIds.has(session.id);

                return (
                  <div
                    key={session.id}
                    onClick={() => {
                      if (isSelectMode) {
                        toggleSelectSession(session.id);
                      } else {
                        setDetailItem(item);
                      }
                    }}
                    className={`rounded-2xl border-2 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer relative group ${
                      isSelected
                        ? 'border-black ring-3 ring-amber-400'
                        : 'border-stone-200 hover:border-black'
                    }`}
                  >
                    {/* Multi-Select Checkbox overlay */}
                    {isSelectMode && (
                      <div className="absolute top-2 left-2 z-10 bg-white/90 p-1 rounded-lg border border-black shadow-xs">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-stone-900" />
                        ) : (
                          <Square className="w-4 h-4 text-stone-400" />
                        )}
                      </div>
                    )}

                    {/* Thumbnail Image */}
                    <div className="relative aspect-[2/3] bg-stone-100 overflow-hidden flex items-center justify-center border-b border-stone-200">
                      {frameAsset?.url && !isExpired ? (
                        <img
                          src={frameAsset.url}
                          alt={session.session_code}
                          className="w-full h-full object-contain group-hover:scale-102 transition-transform duration-200"
                        />
                      ) : (
                        <div className="text-center p-3">
                          <AlertTriangle className="w-6 h-6 text-stone-400 mx-auto mb-1" />
                          <span className="text-[10px] font-mono text-stone-500">
                            {isExpired ? 'Foto Kedaluwarsa' : 'Tidak Ada Frame'}
                          </span>
                        </div>
                      )}

                      {/* Printed Badge */}
                      <div className="absolute top-2 right-2">
                        {(session.printed_count || 0) > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-mono text-[9px] font-bold shadow-xs">
                            Cetak {session.printed_count}x
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-stone-900/70 text-white font-mono text-[9px]">
                            Belum Cetak
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sesi Info Card */}
                    <div className="p-3 space-y-2">
                      {/* Kode Foto (Paling Menonjol) */}
                      <div>
                        <span className="block font-mono font-bold text-sm tracking-widest text-stone-950">
                          {session.session_code}
                        </span>
                        <div className="flex items-center justify-between text-[10px] text-stone-500 font-sans mt-0.5">
                          <span>{formatTime(session.created_at)}</span>
                          <span className="capitalize">{session.filter_id.replace('flt_', '')}</span>
                        </div>
                      </div>

                      {/* Countdown simpan */}
                      <div className="pt-1 border-t border-stone-100 flex items-center justify-between text-[9px] font-mono">
                        <span className="text-stone-400">Retensi:</span>
                        <span
                          className={`font-bold ${
                            isExpired ? 'text-rose-600' : 'text-stone-700'
                          }`}
                        >
                          {isExpired ? 'Kedaluwarsa' : countdown.formatted}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==============================================================
          MODAL: DETAIL SESI FOTO
         ============================================================== */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl border-2 border-black max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b pb-4 border-stone-200">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-stone-500">
                  DETAIL SESI FOTO TAMU
                </span>
                <div className="flex items-center space-x-3 mt-0.5">
                  <h2 className="font-serif font-bold text-2xl text-stone-950">
                    {detailItem.session.session_code}
                  </h2>
                  {(detailItem.session.printed_count || 0) > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 font-mono text-xs font-bold">
                      Sudah dicetak {detailItem.session.printed_count}x
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-stone-100 border border-stone-300 text-stone-700 font-mono text-xs">
                      Belum dicetak
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 mt-1 font-sans">
                  Dibuat pada {new Date(detailItem.session.created_at).toLocaleString('id-ID')}
                </p>
              </div>

              <button
                onClick={() => setDetailItem(null)}
                className="text-stone-400 hover:text-stone-800 text-base font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Main Content: Frame Preview + Assets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left: Frame Result */}
              <div className="space-y-2">
                <span className="block text-xs font-serif font-bold text-stone-700">
                  Hasil Frame Foto (Siap Cetak)
                </span>
                <div className="aspect-[2/3] bg-stone-100 rounded-2xl border-2 border-black overflow-hidden flex items-center justify-center p-2 shadow-inner">
                  {detailItem.assets.find((a) => a.type === 'frame_result')?.url ? (
                    <img
                      src={detailItem.assets.find((a) => a.type === 'frame_result')?.url}
                      alt="Hasil Frame"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-stone-400">File foto telah kedaluwarsa</span>
                  )}
                </div>
              </div>

              {/* Right: Assets list & Retake shots */}
              <div className="space-y-4">
                <span className="block text-xs font-serif font-bold text-stone-700">
                  Semua Foto &amp; Klip Sesi Ini
                </span>

                <div className="grid grid-cols-3 gap-2">
                  {detailItem.assets.map((asset, idx) => (
                    <div
                      key={asset.id || idx}
                      className="rounded-xl border border-stone-200 p-1 bg-stone-50 space-y-1"
                    >
                      <div className="aspect-square bg-stone-200 rounded-lg overflow-hidden flex items-center justify-center">
                        {asset.type === 'live_photo' || asset.type === 'gif_mp4' ? (
                          <video src={asset.url} autoPlay loop muted className="w-full h-full object-cover" />
                        ) : (
                          <img src={asset.url} alt={asset.type} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <span className="block text-[9px] font-mono text-stone-600 truncate text-center capitalize">
                        {asset.type.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Sisa Retensi & Perpanjang */}
                <div className="p-3.5 rounded-2xl border-2 border-stone-200 bg-stone-50 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-stone-500">Batas Waktu Simpan:</span>
                    <span className="font-bold text-stone-900">
                      {new Date(detailItem.session.expires_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <span className="text-[10px] font-serif font-bold text-stone-700">
                      Perpanjang:
                    </span>
                    <button
                      onClick={() => handleExtendRetention(detailItem.session.id, 24)}
                      className="px-2.5 py-1 rounded-lg border border-black bg-white hover:bg-stone-100 text-[10px] font-mono font-bold cursor-pointer"
                    >
                      +24 Jam
                    </button>
                    <button
                      onClick={() => handleExtendRetention(detailItem.session.id, 48)}
                      className="px-2.5 py-1 rounded-lg border border-black bg-white hover:bg-stone-100 text-[10px] font-mono font-bold cursor-pointer"
                    >
                      +48 Jam
                    </button>
                    <button
                      onClick={() => handleExtendRetention(detailItem.session.id, 120)}
                      className="px-2.5 py-1 rounded-lg border border-black bg-white hover:bg-stone-100 text-[10px] font-mono font-bold cursor-pointer"
                    >
                      +5 Hari
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setDeleteSessionId(detailItem.session.id)}
                className="px-4 py-2 rounded-full border border-rose-300 hover:border-rose-600 text-rose-700 hover:bg-rose-50 text-xs font-serif font-bold flex items-center space-x-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Sesi</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadZip(
                      [detailItem],
                      `sesi-${detailItem.session.session_code}`
                    )
                  }
                  className="px-4 py-2 rounded-full border-2 border-black bg-white hover:bg-stone-50 text-xs font-serif font-bold text-stone-900 flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Semua (ZIP)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const frame = detailItem.assets.find(
                      (a) => a.type === 'frame_result'
                    );
                    if (frame?.url) {
                      setPrintModalItem({
                        session: detailItem.session,
                        frameUrl: frame.url,
                      });
                    } else {
                      showToast('Foto frame tidak tersedia untuk dicetak', 'error');
                    }
                  }}
                  className="px-6 py-2 rounded-full border-2 border-black bg-stone-950 text-white hover:bg-stone-800 text-xs font-serif font-bold tracking-wider flex items-center space-x-2 shadow-md cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4 text-amber-300" />
                  <span>Cetak Foto</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: DIALOG CETAK SATU SESI
         ============================================================== */}
      {printModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl border-2 border-black max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b pb-3 border-stone-200">
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900">
                  Dialog Cetak Foto
                </h3>
                <span className="font-mono text-xs text-stone-500">
                  Kode: {printModalItem.session.session_code}
                </span>
              </div>
              <button
                onClick={() => setPrintModalItem(null)}
                className="text-stone-400 hover:text-stone-800 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Warning if already printed */}
            {(printModalItem.session.printed_count || 0) > 0 && (
              <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Sesi ini sudah pernah dicetak {printModalItem.session.printed_count} kali. Yakin ingin mencetak ulang?
                </span>
              </div>
            )}

            {/* Profile Selection & Copies */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                  Pilih Profil Printer &amp; Kertas
                </label>
                <select
                  value={selectedPrintProfileId}
                  onChange={(e) => setSelectedPrintProfileId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-black bg-stone-50 text-xs font-serif focus:outline-none focus:bg-white cursor-pointer"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.paper_width_mm}x{p.paper_height_mm}mm, {p.fit_mode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                    Jumlah Salinan
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={printCopies}
                    onChange={(e) => setPrintCopies(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-black bg-stone-50 text-xs font-mono text-center"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="inline-flex items-center space-x-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={printCodeFooter}
                      onChange={(e) => setPrintCodeFooter(e.target.checked)}
                      className="w-4 h-4 rounded border-2 border-black accent-stone-900"
                    />
                    <span className="text-[11px] font-serif font-semibold text-stone-800">
                      Cetak kode foto di tepi bawah
                    </span>
                  </label>
                </div>
              </div>

              {/* Visual Paper Preview Mock */}
              <div className="p-3 bg-stone-100 rounded-xl border border-stone-200 text-center">
                <span className="block text-[10px] font-mono text-stone-500 uppercase mb-1">
                  Pratinjau Kertas &amp; Margin
                </span>
                <div className="mx-auto w-32 aspect-[2/3] bg-white border border-stone-400 p-1 shadow-xs flex items-center justify-center relative">
                  <img
                    src={printModalItem.frameUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  {printCodeFooter && (
                    <span className="absolute bottom-1 right-1 font-mono text-[6px] bg-white/80 px-0.5">
                      {printModalItem.session.session_code}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setPrintModalItem(null)}
                className="px-4 py-2 rounded-full border border-stone-300 text-xs font-serif font-bold text-stone-600 hover:border-black cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isPrinting}
                onClick={handleExecutePrint}
                className="px-6 py-2 rounded-full border-2 border-black bg-stone-950 text-white hover:bg-stone-800 text-xs font-serif font-bold tracking-wider shadow-md cursor-pointer active:scale-95 disabled:opacity-50 flex items-center space-x-2"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>{isPrinting ? 'Mencetak...' : `Cetak Sekarang (${printCopies}x)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: CETAK CEPAT MULTI-KODE
         ============================================================== */}
      {isQuickPrintOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl border-2 border-black max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b pb-3 border-stone-200">
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900">
                  Cetak Cepat Multi-Kode
                </h3>
                <p className="text-xs text-stone-500 font-sans">
                  Masukkan satu atau banyak kode tamu (dipisahkan spasi, koma, atau baris baru).
                </p>
              </div>
              <button
                onClick={() => setIsQuickPrintOpen(false)}
                className="text-stone-400 hover:text-stone-800 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Input Codes Textarea */}
            <div>
              <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                Daftar Kode Foto Tamu
              </label>
              <textarea
                rows={3}
                value={quickPrintInput}
                onChange={(e) => setQuickPrintInput(e.target.value)}
                placeholder="Contoh: MND-0042, KL-0001 MND0043&#10;DMW-0005"
                className="w-full p-3 rounded-xl border-2 border-black bg-stone-50 text-xs font-mono focus:outline-none focus:bg-white"
              />
            </div>

            {/* Analisis Real-Time Hasil Pencocokan */}
            {quickPrintInput.trim() && (
              <div className="space-y-3">
                <span className="block text-xs font-serif font-bold text-stone-700">
                  Hasil Verifikasi Kode ({quickPrintAnalysis.matched.length} Ditemukan)
                </span>

                {/* Grid Matched Thumbnails */}
                {quickPrintAnalysis.matched.length > 0 && (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 bg-stone-50 rounded-xl border border-stone-200">
                    {quickPrintAnalysis.matched.map((item) => {
                      const frame = item.assets.find((a) => a.type === 'frame_result');
                      return (
                        <div
                          key={item.session.id}
                          className="rounded-lg border border-stone-300 p-1 bg-white text-center space-y-1 shadow-xs"
                        >
                          <div className="aspect-[2/3] bg-stone-100 rounded overflow-hidden flex items-center justify-center">
                            {frame?.url ? (
                              <img src={frame.url} alt={item.code} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-stone-400" />
                            )}
                          </div>
                          <span className="block font-mono text-[9px] font-bold text-stone-900 truncate">
                            {item.code}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Expired Tokens Warning */}
                {quickPrintAnalysis.expired.length > 0 && (
                  <div className="p-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs space-y-1">
                    <span className="font-bold font-serif flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      <span>Kode Kedaluwarsa (Foto Telah Dihapus):</span>
                    </span>
                    <span className="font-mono text-[11px] block">
                      {quickPrintAnalysis.expired.map((e) => e.token).join(', ')}
                    </span>
                  </div>
                )}

                {/* Missing Tokens Alert */}
                {quickPrintAnalysis.missing.length > 0 && (
                  <div className="p-2.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-xs space-y-1">
                    <span className="font-bold font-serif flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                      <span>Kode Tidak Ditemukan:</span>
                    </span>
                    <span className="font-mono text-[11px] block">
                      {quickPrintAnalysis.missing.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Profile Selection & Copies */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-200">
              <div>
                <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                  Profil Printer
                </label>
                <select
                  value={selectedPrintProfileId}
                  onChange={(e) => setSelectedPrintProfileId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border-2 border-black bg-stone-50 text-xs font-serif focus:outline-none"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                  Jumlah Salinan per Foto
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={quickPrintCopies}
                  onChange={(e) => setQuickPrintCopies(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl border-2 border-black bg-stone-50 text-xs font-mono text-center"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsQuickPrintOpen(false)}
                className="px-4 py-2 rounded-full border border-stone-300 text-xs font-serif font-bold text-stone-600 hover:border-black cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isPrinting || quickPrintAnalysis.matched.length === 0}
                onClick={handleExecuteQuickPrint}
                className="px-6 py-2 rounded-full border-2 border-black bg-stone-950 text-white hover:bg-stone-800 text-xs font-serif font-bold tracking-wider shadow-md cursor-pointer active:scale-95 disabled:opacity-40 flex items-center space-x-2"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>
                  {isPrinting
                    ? 'Memproses...'
                    : `Cetak Semua Terverifikasi (${quickPrintAnalysis.matched.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteSessionId}
        title="Hapus Sesi Foto"
        message="Apakah Anda yakin ingin menghapus sesi foto ini beserta semua file gambar dan live photolist-nya? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus Permanen"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteSessionId(null)}
      />
    </div>
  );
};
