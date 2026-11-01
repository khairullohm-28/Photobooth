import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  FileSpreadsheet,
  Download,
  Printer,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react';
import { AdminProfile, AppSettings } from '../../../types/admin';
import { Event, SessionsPerDay, PrintsPerDay } from '../../../types/photobooth';
import { PhotoboothService } from '../../../services/supabase';
import { EventService } from '../../../services/eventService';
import { exportToCsv, exportToXlsx, printReportPage } from '../../../utils/exportUtils';
import { ReportToolbar, DatePreset } from '../../components/ReportToolbar';

interface PeriodicUsageReportPageProps {
  currentAdmin: AdminProfile;
  appSettings: AppSettings;
}

type AggregationMode = 'daily' | 'weekly' | 'monthly';

interface PeriodicRow {
  periodLabel: string;
  sessions: number;
  photos: number;
  prints: number;
  avgPhotosPerSession: number;
}

export const PeriodicUsageReportPage: React.FC<PeriodicUsageReportPageProps> = ({
  currentAdmin,
}) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [datePreset, setDatePreset] = useState<DatePreset>('30days');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [aggMode, setAggMode] = useState<AggregationMode>('daily');

  const [rows, setRows] = useState<PeriodicRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Preset changer
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const today = new Date().toISOString().split('T')[0];
    setEndDate(today);
    if (preset === 'today') setStartDate(today);
    else if (preset === '7days') setStartDate(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
    else if (preset === '30days') setStartDate(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  };

  // Load events
  useEffect(() => {
    const init = async () => {
      const allEvts = await EventService.getEvents();
      const allowed =
        currentAdmin.role === 'team' && currentAdmin.allowed_event_ids
          ? allEvts.filter((e) => currentAdmin.allowed_event_ids!.includes(e.id))
          : allEvts;
      setEvents(allowed);
    };
    init();
  }, [currentAdmin]);

  // Load periodic report
  const loadReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const fromIso = new Date(`${startDate}T00:00:00.000Z`).toISOString();
      const toIso = new Date(`${endDate}T23:59:59.999Z`).toISOString();
      const eventFilter = selectedEventId || undefined;
      const allowedFilter =
        currentAdmin.role === 'team' && currentAdmin.allowed_event_ids
          ? currentAdmin.allowed_event_ids
          : undefined;

      const [dayData, printData] = await Promise.all([
        PhotoboothService.getSessionsPerDay(fromIso, toIso, eventFilter, allowedFilter),
        PhotoboothService.getPrintsPerDay(fromIso, toIso, eventFilter, allowedFilter),
      ]);

      const printMap = new Map<string, number>();
      printData.forEach((p) => printMap.set(p.date_label, p.copies_count));

      // Aggregate according to mode
      if (aggMode === 'daily') {
        const aggregated: PeriodicRow[] = dayData.map((d) => {
          const pr = printMap.get(d.date_label) || 0;
          return {
            periodLabel: d.date_label,
            sessions: d.sessions_count,
            photos: d.photos_count,
            prints: pr,
            avgPhotosPerSession:
              d.sessions_count > 0 ? Math.round((d.photos_count / d.sessions_count) * 10) / 10 : 0,
          };
        });
        setRows(aggregated);
      } else if (aggMode === 'weekly') {
        // Group by ISO week
        const weekMap = new Map<string, { sessions: number; photos: number; prints: number }>();
        dayData.forEach((d) => {
          const dateObj = new Date(d.date_label);
          const firstDayOfYear = new Date(dateObj.getFullYear(), 0, 1);
          const pastDaysOfYear = (dateObj.getTime() - firstDayOfYear.getTime()) / 86400000;
          const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
          const key = `Minggu ke-${weekNum} (${dateObj.getFullYear()})`;

          const cur = weekMap.get(key) || { sessions: 0, photos: 0, prints: 0 };
          cur.sessions += d.sessions_count;
          cur.photos += d.photos_count;
          cur.prints += printMap.get(d.date_label) || 0;
          weekMap.set(key, cur);
        });

        const aggregated: PeriodicRow[] = Array.from(weekMap.entries()).map(([k, v]) => ({
          periodLabel: k,
          sessions: v.sessions,
          photos: v.photos,
          prints: v.prints,
          avgPhotosPerSession:
            v.sessions > 0 ? Math.round((v.photos / v.sessions) * 10) / 10 : 0,
        }));
        setRows(aggregated);
      } else {
        // Group by month
        const monthMap = new Map<string, { sessions: number; photos: number; prints: number }>();
        dayData.forEach((d) => {
          const monthKey = d.date_label.slice(0, 7); // YYYY-MM
          const cur = monthMap.get(monthKey) || { sessions: 0, photos: 0, prints: 0 };
          cur.sessions += d.sessions_count;
          cur.photos += d.photos_count;
          cur.prints += printMap.get(d.date_label) || 0;
          monthMap.set(monthKey, cur);
        });

        const aggregated: PeriodicRow[] = Array.from(monthMap.entries()).map(([k, v]) => ({
          periodLabel: k,
          sessions: v.sessions,
          photos: v.photos,
          prints: v.prints,
          avgPhotosPerSession:
            v.sessions > 0 ? Math.round((v.photos / v.sessions) * 10) / 10 : 0,
        }));
        setRows(aggregated);
      }
    } catch (err) {
      console.error('Failed to load periodic report:', err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedEventId, aggMode, currentAdmin]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Totals
  const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
  const totalPhotos = rows.reduce((s, r) => s + r.photos, 0);
  const totalPrints = rows.reduce((s, r) => s + r.prints, 0);
  const avgPhotosTotal =
    totalSessions > 0 ? Math.round((totalPhotos / totalSessions) * 10) / 10 : 0;

  // Exports
  const handleExportCsv = () => {
    const headers = ['Periode', 'Sesi Tamu', 'Foto Diambil', 'Salinan Cetak', 'Rata-rata Foto/Sesi'];
    const dataRows = rows.map((r) => [
      r.periodLabel,
      r.sessions,
      r.photos,
      r.prints,
      r.avgPhotosPerSession,
    ]);
    dataRows.push(['TOTAL', totalSessions, totalPhotos, totalPrints, avgPhotosTotal]);
    exportToCsv(`Laporan_Penggunaan_Periodik_${startDate}_sd_${endDate}`, headers, dataRows);
  };

  const handleExportXlsx = () => {
    const headers = ['Periode Waktu', 'Jumlah Sesi', 'Foto Diambil', 'Lembar Cetak', 'Rata-rata Foto/Sesi'];
    const dataRows = rows.map((r) => [
      r.periodLabel,
      r.sessions,
      r.photos,
      r.prints,
      r.avgPhotosPerSession,
    ]);
    dataRows.push(['TOTAL KESELURUHAN', totalSessions, totalPhotos, totalPrints, avgPhotosTotal]);
    exportToXlsx(`Laporan_Penggunaan_Periodik`, 'Penggunaan Periodik', headers, dataRows);
  };

  return (
    <div className="space-y-6">
      <ReportToolbar
        title="Laporan Penggunaan Periodik"
        description="Rekapitulasi volume sesi photobooth, jepretan kamera, dan cetak fisik per hari, minggu, atau bulan."
        datePreset={datePreset}
        onPresetChange={handlePresetChange}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        events={events}
        selectedEventId={selectedEventId}
        onEventChange={setSelectedEventId}
        onExportCsv={handleExportCsv}
        onExportXlsx={handleExportXlsx}
        onPrintPdf={printReportPage}
        onRefresh={loadReport}
        isRefreshing={isLoading}
        extraControls={
          <div className="flex items-center rounded-full border-2 border-black p-0.5 bg-stone-100 text-xs font-serif shadow-xs">
            <button
              onClick={() => setAggMode('daily')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                aggMode === 'daily'
                  ? 'bg-black text-white font-bold'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              Harian
            </button>
            <button
              onClick={() => setAggMode('weekly')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                aggMode === 'weekly'
                  ? 'bg-black text-white font-bold'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              Mingguan
            </button>
            <button
              onClick={() => setAggMode('monthly')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                aggMode === 'monthly'
                  ? 'bg-black text-white font-bold'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              Bulanan
            </button>
          </div>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Total Sesi Tamu
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {totalSessions}
          </div>
        </div>
        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Foto Diambil
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {totalPhotos}
          </div>
        </div>
        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Lembar Cetak
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {totalPrints}
          </div>
        </div>
        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Rata-rata Foto/Sesi
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {avgPhotosTotal}x
          </div>
        </div>
      </div>

      {/* Periodic Table */}
      <div className="border-2 border-black rounded-2xl overflow-hidden bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-black bg-stone-100 font-serif font-bold text-stone-950">
                <th className="p-3.5">Periode Waktu</th>
                <th className="p-3.5 text-right">Sesi Tamu</th>
                <th className="p-3.5 text-right">Foto Diambil</th>
                <th className="p-3.5 text-right">Salinan Cetak</th>
                <th className="p-3.5 text-right">Rata-rata Foto / Sesi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-400 font-serif">
                    Belum ada aktivitas pada periode ini.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.periodLabel} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3.5 font-mono font-medium text-stone-900">{row.periodLabel}</td>
                    <td className="p-3.5 text-right font-serif font-bold text-stone-950">{row.sessions}</td>
                    <td className="p-3.5 text-right font-mono text-stone-700">{row.photos}</td>
                    <td className="p-3.5 text-right font-mono text-emerald-700 font-bold">{row.prints}</td>
                    <td className="p-3.5 text-right font-mono text-stone-600">{row.avgPhotosPerSession}x</td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-black bg-stone-100 font-serif font-bold text-stone-950">
                  <td className="p-3.5">TOTAL</td>
                  <td className="p-3.5 text-right text-sm">{totalSessions}</td>
                  <td className="p-3.5 text-right text-sm">{totalPhotos}</td>
                  <td className="p-3.5 text-right text-sm text-emerald-800">{totalPrints}</td>
                  <td className="p-3.5 text-right text-sm">{avgPhotosTotal}x</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
