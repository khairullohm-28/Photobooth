import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  Sparkles,
  Camera,
  Printer,
  HardDrive,
  Clock,
  Download,
  Share2,
  FileSpreadsheet,
  FileText,
  UserCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { AdminProfile, AppSettings } from '../../../types/admin';
import {
  Event,
  DashboardSummary,
  TopTemplate,
  TopFilter,
  DownloadByType,
} from '../../../types/photobooth';
import { PhotoboothService } from '../../../services/supabase';
import { EventService } from '../../../services/eventService';
import { exportToCsv, exportToXlsx, printReportPage } from '../../../utils/exportUtils';
import { ReportToolbar } from '../../components/ReportToolbar';

interface EventSummaryReportPageProps {
  currentAdmin: AdminProfile;
  appSettings: AppSettings;
}

export const EventSummaryReportPage: React.FC<EventSummaryReportPageProps> = ({
  currentAdmin,
  appSettings,
}) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [peakHour, setPeakHour] = useState<number>(0);
  const [topTemplates, setTopTemplates] = useState<TopTemplate[]>([]);
  const [topFilters, setTopFilters] = useState<TopFilter[]>([]);
  const [downloadsByType, setDownloadsByType] = useState<DownloadByType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load available events
  useEffect(() => {
    const init = async () => {
      const allEvts = await EventService.getEvents();
      const allowed =
        currentAdmin.role === 'team' && currentAdmin.allowed_event_ids
          ? allEvts.filter((e) => currentAdmin.allowed_event_ids!.includes(e.id))
          : allEvts;

      setEvents(allowed);
      if (allowed.length > 0 && !selectedEventId) {
        setSelectedEventId(allowed[0].id);
        setSelectedEvent(allowed[0]);
      }
    };
    init();
  }, [currentAdmin]);

  // Load metrics for the chosen event
  const loadEventReport = useCallback(async () => {
    if (!selectedEventId) return;
    setIsLoading(true);
    try {
      const evt = events.find((e) => e.id === selectedEventId) || null;
      setSelectedEvent(evt);

      const [sum, hours, tmpls, flts, dlTypes] = await Promise.all([
        PhotoboothService.getDashboardSummary(undefined, undefined, selectedEventId),
        PhotoboothService.getSessionsPerHour(undefined, undefined, selectedEventId),
        PhotoboothService.getTopTemplates(undefined, undefined, selectedEventId),
        PhotoboothService.getTopFilters(undefined, undefined, selectedEventId),
        PhotoboothService.getDownloadsByType(undefined, undefined, selectedEventId),
      ]);

      setSummary(sum);
      setTopTemplates(tmpls.slice(0, 3));
      setTopFilters(flts.slice(0, 3));
      setDownloadsByType(dlTypes);

      // Find peak hour
      let maxHour = 19;
      let maxCount = 0;
      hours.forEach((h) => {
        if (h.sessions_count > maxCount) {
          maxCount = h.sessions_count;
          maxHour = h.hour_of_day;
        }
      });
      setPeakHour(maxHour);
    } catch (err) {
      console.error('Failed to load event summary report:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEventId, events]);

  useEffect(() => {
    loadEventReport();
  }, [loadEventReport]);

  // Export handlers
  const handleExportCsv = () => {
    if (!selectedEvent || !summary) return;
    const headers = ['Metrik', 'Nilai', 'Keterangan'];
    const rows = [
      ['Nama Acara', selectedEvent.name, selectedEvent.couple_names || ''],
      ['Tanggal Acara', selectedEvent.event_date, ''],
      ['Kode Prefix', selectedEvent.code_prefix, ''],
      ['Total Sesi Tamu', summary.total_sessions, 'Sesi berhasil disimpan'],
      ['Total Foto Diambil', summary.total_photos, 'Jepretan kamera'],
      ['Total Lembar Cetak', summary.total_prints, 'Salinan cetak fisik'],
      ['Rata-rata Retake', `${summary.avg_retakes}x`, 'Per sesi'],
      ['Jam Puncak (Peak Hour)', `${peakHour}:00 - ${peakHour}:59`, 'Kepadatan tertinggi'],
      ['Template Favorit', topTemplates[0]?.template_name || '-', `${topTemplates[0]?.usage_count || 0} sesi`],
      ['Filter Favorit', topFilters[0]?.filter_name || '-', `${topFilters[0]?.usage_count || 0} sesi`],
    ];
    exportToCsv(`Rekap_${selectedEvent.slug}_${new Date().toISOString().split('T')[0]}`, headers, rows);
  };

  const handleExportXlsx = () => {
    if (!selectedEvent || !summary) return;
    const headers = ['Indikator Laporan', 'Data', 'Catatan Tambahan'];
    const rows = [
      ['Nama Acara', selectedEvent.name, 'Acara Pernikahan'],
      ['Mempelai', selectedEvent.couple_names || '-', 'Klien'],
      ['Tanggal Pelaksanaan', selectedEvent.event_date, 'Waktu Resepsi'],
      ['Prefix Kode Tamu', selectedEvent.code_prefix, 'Format Tiket'],
      ['Jumlah Sesi Tamu', summary.total_sessions, 'Total Sesi Foto'],
      ['Total Foto Diambil', summary.total_photos, 'Total Jepretan'],
      ['Total Lembar Dicetak', summary.total_prints, 'Fisik Kertas Foto'],
      ['Rata-rata Retake', summary.avg_retakes, 'Kali per sesi'],
      ['Jam Kepadatan Tertinggi', `${peakHour}:00 - ${peakHour}:59`, 'Peak Hour'],
      ['Template Terpopuler #1', topTemplates[0]?.template_name || '-', `${topTemplates[0]?.usage_count || 0} pemakaian`],
      ['Template Terpopuler #2', topTemplates[1]?.template_name || '-', `${topTemplates[1]?.usage_count || 0} pemakaian`],
      ['Filter LUT Terpopuler #1', topFilters[0]?.filter_name || '-', `${topFilters[0]?.usage_count || 0} pemakaian`],
      ['Unduhan Frame Siap Cetak', downloadsByType.find(d => d.asset_type === 'frame_result')?.count || 0, 'Softfile'],
      ['Unduhan Animasi GIF', downloadsByType.find(d => d.asset_type === 'gif')?.count || 0, 'Softfile'],
    ];
    exportToXlsx(`Rekap_${selectedEvent.slug}`, 'Ringkasan Acara', headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Printable Style Injector */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .no-print, header, aside, nav, button {
            display: none !important;
          }
          .print-only-container {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Screen Toolbar (hidden during print) */}
      <ReportToolbar
        title="Rekap Laporan Per Acara"
        description="Ringkasan eksekutif performa satu acara pernikahan untuk dikirim rapi ke klien (PDF, Excel, CSV)."
        events={events}
        selectedEventId={selectedEventId}
        onEventChange={(id) => setSelectedEventId(id)}
        onExportCsv={handleExportCsv}
        onExportXlsx={handleExportXlsx}
        onPrintPdf={printReportPage}
        onRefresh={loadEventReport}
        isRefreshing={isLoading}
      />

      {/* Main Report Document (Formatted for Screen & Clean Print/PDF) */}
      <div className="bg-white border-2 border-black rounded-2xl p-6 md:p-10 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] print-only-container max-w-4xl mx-auto">
        {/* Document Header / Letterhead */}
        <div className="flex items-start justify-between border-b-2 border-black pb-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-xl bg-stone-900 border-2 border-black flex items-center justify-center text-white shrink-0 shadow-sm">
              {appSettings.logo_url ? (
                <img
                  src={appSettings.logo_url}
                  alt="Logo"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <span className="font-serif font-bold text-xl text-amber-300">
                  {appSettings.company_name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h2 className="font-serif font-bold text-xl md:text-2xl text-stone-950 tracking-tight leading-snug">
                {appSettings.company_name}
              </h2>
              <span className="text-xs text-stone-600 block">
                Executive Wedding Photobooth &amp; Guest Engagement Report
              </span>
              <span className="text-[11px] font-mono text-stone-400">
                Dicetak pada: {new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold bg-stone-100 border border-stone-300 text-stone-800">
              LAPORAN KLIEN RESMI
            </span>
            <span className="block text-[11px] font-mono text-stone-500 mt-1">
              Prefix: {selectedEvent?.code_prefix || 'PB'}
            </span>
          </div>
        </div>

        {/* Event Details Card */}
        {selectedEvent && (
          <div className="p-5 rounded-xl border-2 border-stone-800 bg-stone-50/70 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold block">
                Acara Pernikahan
              </span>
              <h3 className="font-serif font-bold text-xl text-stone-950 mt-0.5">
                {selectedEvent.name}
              </h3>
              <p className="text-xs text-stone-600 mt-1">
                Pasangan: <span className="font-semibold text-stone-900">{selectedEvent.couple_names || selectedEvent.name}</span> • Tanggal: <span className="font-semibold text-stone-900">{selectedEvent.event_date}</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-serif font-bold border border-black bg-emerald-100 text-emerald-950">
                Status Acara: {selectedEvent.status.toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* KPI Executive Summary Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl border border-stone-300 bg-white">
            <div className="flex items-center space-x-1.5 text-stone-500 text-xs mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Total Sesi Tamu</span>
            </div>
            <div className="font-serif font-bold text-2xl text-stone-950">
              {summary?.total_sessions ?? 0}
            </div>
            <span className="text-[10px] text-stone-500">Grup tamu yang berfoto</span>
          </div>

          <div className="p-4 rounded-xl border border-stone-300 bg-white">
            <div className="flex items-center space-x-1.5 text-stone-500 text-xs mb-1">
              <Camera className="w-3.5 h-3.5 text-blue-600" />
              <span>Total Foto Diambil</span>
            </div>
            <div className="font-serif font-bold text-2xl text-stone-950">
              {summary?.total_photos ?? 0}
            </div>
            <span className="text-[10px] text-stone-500">Jepretan foto tersimpan</span>
          </div>

          <div className="p-4 rounded-xl border border-stone-300 bg-white">
            <div className="flex items-center space-x-1.5 text-stone-500 text-xs mb-1">
              <Printer className="w-3.5 h-3.5 text-emerald-600" />
              <span>Salinan Cetak Fisik</span>
            </div>
            <div className="font-serif font-bold text-2xl text-stone-950">
              {summary?.total_prints ?? 0}
            </div>
            <span className="text-[10px] text-stone-500">Lembar foto dibagikan</span>
          </div>

          <div className="p-4 rounded-xl border border-stone-300 bg-white">
            <div className="flex items-center space-x-1.5 text-stone-500 text-xs mb-1">
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              <span>Jam Puncak Ramai</span>
            </div>
            <div className="font-serif font-bold text-xl text-stone-950">
              {peakHour}:00 - {peakHour}:59
            </div>
            <span className="text-[10px] text-stone-500">Kepadatan booth tertinggi</span>
          </div>
        </div>

        {/* Breakdown Tables: Template Favorit, Filter Favorit, Unduhan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Template Terpopuler */}
          <div className="p-4 rounded-xl border border-stone-300">
            <h4 className="font-serif font-bold text-sm text-stone-950 mb-3 border-b border-stone-200 pb-2">
              Template Paling Diminati
            </h4>
            <div className="space-y-2.5">
              {topTemplates.length === 0 ? (
                <span className="text-xs text-stone-400">Tidak ada template.</span>
              ) : (
                topTemplates.map((t, idx) => (
                  <div key={t.template_id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-stone-900">{t.template_name}</span>
                    </div>
                    <span className="font-mono text-stone-600 font-bold">
                      {t.usage_count} sesi
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Filter Terpopuler */}
          <div className="p-4 rounded-xl border border-stone-300">
            <h4 className="font-serif font-bold text-sm text-stone-950 mb-3 border-b border-stone-200 pb-2">
              Filter Warna Favorit Tamu
            </h4>
            <div className="space-y-2.5">
              {topFilters.length === 0 ? (
                <span className="text-xs text-stone-400">Tidak ada filter.</span>
              ) : (
                topFilters.map((flt, idx) => (
                  <div key={flt.filter_id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-stone-900">{flt.filter_name}</span>
                    </div>
                    <span className="font-mono text-stone-600 font-bold">
                      {flt.usage_count} sesi
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Unduhan Softfile & Keterangan */}
        <div className="p-4 rounded-xl border border-stone-300 mb-8">
          <h4 className="font-serif font-bold text-sm text-stone-950 mb-3 border-b border-stone-200 pb-2">
            Rincian Unduhan Softfile Tamu
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            {downloadsByType.map((d) => (
              <div key={d.asset_type} className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                <span className="text-[11px] text-stone-500 block">{d.label}</span>
                <span className="font-serif font-bold text-lg text-stone-950">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Document Sign-off Footer */}
        <div className="pt-6 border-t border-stone-200 flex flex-col md:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <div>
            <span>Laporan digenerate oleh operator: </span>
            <span className="font-bold text-stone-900">{currentAdmin.display_name} ({currentAdmin.username})</span>
          </div>
          <div className="text-right">
            <span className="font-serif italic text-stone-700 block">
              "Terima kasih atas kepercayaan Anda menggunakan layanan kami."
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
