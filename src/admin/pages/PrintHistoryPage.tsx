import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  Calendar,
  Search,
  Filter as FilterIcon,
  RotateCcw,
  Clock,
  Eye,
  CheckCircle2,
  FileText,
  User,
} from 'lucide-react';
import { PrintJob, Event } from '../../types/photobooth';
import { PrinterService } from '../../services/printerService';
import { EventService } from '../../services/eventService';
import { useToast } from '../components/Toast';
import { EmptyState, SkeletonLoader } from '../components/CommonFeedback';

export const PrintHistoryPage: React.FC = () => {
  const { showToast } = useToast();

  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [jobsData, eventsData] = await Promise.all([
        PrinterService.getPrintHistory(),
        EventService.getEvents(),
      ]);
      setJobs(jobsData);
      setEvents(eventsData);
    } catch {
      showToast('Gagal memuat riwayat cetak', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (selectedEventId !== 'all') {
        if (job.event_id && job.event_id !== selectedEventId) return false;
      }

      if (selectedDate) {
        if (!job.printed_at.startsWith(selectedDate)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (job.session_code || '').toLowerCase();
        const evName = (job.event_name || '').toLowerCase();
        const profName = (job.profile_name || '').toLowerCase();
        const op = (job.printed_by || '').toLowerCase();
        if (
          !code.includes(q) &&
          !evName.includes(q) &&
          !profName.includes(q) &&
          !op.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [jobs, selectedEventId, selectedDate, searchQuery]);

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5 border-stone-200">
        <div>
          <h1 className="font-serif font-bold text-2xl text-stone-900 tracking-tight">
            Riwayat Cetak Operator
          </h1>
          <p className="text-xs text-stone-500 mt-1 font-sans">
            Log audit setiap pencetakan foto frame oleh operator booth, profil printer yang digunakan, dan jumlah salinan.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full border-2 border-stone-300 hover:border-black bg-white text-xs font-serif font-bold text-stone-800 transition-colors cursor-pointer active:scale-95"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Segarkan Log</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl border-2 border-black bg-white shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode foto, operator, printer, acara..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border-2 border-black bg-stone-50 text-xs text-stone-900 focus:outline-none focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Acara */}
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-3 py-2 rounded-xl border-2 border-black bg-stone-50 text-xs font-serif focus:outline-none focus:bg-white cursor-pointer"
          >
            <option value="all">Semua User / Acara</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} ({ev.code_prefix})
              </option>
            ))}
          </select>

          {/* Filter Tanggal */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-xl border-2 border-black bg-stone-50 text-xs font-mono focus:outline-none focus:bg-white cursor-pointer"
          />

          {(selectedEventId !== 'all' || selectedDate || searchQuery) && (
            <button
              onClick={() => {
                setSelectedEventId('all');
                setSelectedDate('');
                setSearchQuery('');
              }}
              className="px-3 py-2 rounded-xl border border-stone-300 hover:border-black text-xs text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonLoader rows={6} />
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          title="Belum Ada Riwayat Cetak"
          description="Aktivitas cetak foto dari menu Booking akan otomatis tercatat di halaman ini secara real-time."
          action={
            <button
              onClick={loadData}
              className="px-4 py-2 rounded-full border-2 border-black text-xs font-serif font-bold hover:bg-stone-100 cursor-pointer"
            >
              Muat Ulang
            </button>
          }
        />
      ) : (
        <div className="rounded-2xl border-2 border-black bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-black bg-stone-100 font-serif font-bold text-stone-900">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Waktu Cetak</th>
                  <th className="py-3 px-4">Kode Foto</th>
                  <th className="py-3 px-4">User / Acara</th>
                  <th className="py-3 px-4">Printer / Profil</th>
                  <th className="py-3 px-4 text-center">Salinan</th>
                  <th className="py-3 px-4">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredJobs.map((job, idx) => (
                  <tr key={job.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 text-center font-mono text-stone-400">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-mono text-stone-600 whitespace-nowrap">
                      {formatDateTime(job.printed_at)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-sm text-stone-950 tracking-wider">
                      {job.session_code || job.session_id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-4 font-serif font-medium text-stone-800">
                      {job.event_name || 'Khai & Lila Wedding'}
                    </td>
                    <td className="py-3 px-4 font-sans text-stone-700">
                      <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-lg bg-stone-100 border border-stone-200">
                        <Printer className="w-3 h-3 text-stone-500" />
                        <span>{job.profile_name || 'DNP DS620 - 4R'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-stone-900 text-white font-mono text-[10px] font-bold">
                        {job.copies}x cetak
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-stone-600">
                      <span className="flex items-center space-x-1">
                        <User className="w-3 h-3 text-stone-400" />
                        <span>{job.printed_by || 'operator'}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-[11px] text-stone-500 font-mono">
            <span>Total Catatan: {filteredJobs.length} cetakan</span>
            <span>Semua cetakan tercatat otomatis</span>
          </div>
        </div>
      )}
    </div>
  );
};
