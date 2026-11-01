import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  FileSpreadsheet,
  Download,
  RotateCcw,
  UserCheck,
  Calendar,
  Layers,
  Copy,
} from 'lucide-react';
import { AdminProfile, AppSettings } from '../../../types/admin';
import { Event, PrintJob, Session } from '../../../types/photobooth';
import { PhotoboothService } from '../../../services/supabase';
import { EventService } from '../../../services/eventService';
import { PrinterService } from '../../../services/printerService';
import { exportToCsv, exportToXlsx, printReportPage } from '../../../utils/exportUtils';
import { ReportToolbar, DatePreset } from '../../components/ReportToolbar';

interface PrintsReportPageProps {
  currentAdmin: AdminProfile;
  appSettings: AppSettings;
}

export const PrintsReportPage: React.FC<PrintsReportPageProps> = ({ currentAdmin }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [datePreset, setDatePreset] = useState<DatePreset>('30days');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'summary' | 'events' | 'printers' | 'operators'>('summary');

  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const today = new Date().toISOString().split('T')[0];
    setEndDate(today);
    if (preset === 'today') setStartDate(today);
    else if (preset === '7days') setStartDate(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
    else if (preset === '30days') setStartDate(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  };

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

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const jobs = await PrinterService.getPrintHistory();
      const fromTime = new Date(`${startDate}T00:00:00.000Z`).getTime();
      const toTime = new Date(`${endDate}T23:59:59.999Z`).getTime();

      const filtered = jobs.filter((j) => {
        if (selectedEventId && j.event_id !== selectedEventId) return false;
        if (
          currentAdmin.role === 'team' &&
          currentAdmin.allowed_event_ids &&
          currentAdmin.allowed_event_ids.length > 0 &&
          j.event_id &&
          !currentAdmin.allowed_event_ids.includes(j.event_id)
        ) {
          return false;
        }
        const pt = new Date(j.printed_at).getTime();
        return pt >= fromTime && pt <= toTime;
      });

      setPrintJobs(filtered);
    } catch (err) {
      console.error('Failed to load print report:', err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedEventId, currentAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculations
  const totalJobs = printJobs.length;
  const totalSheets = printJobs.reduce((sum, j) => sum + (j.copies || 1), 0);
  const reprintsCount = printJobs.filter((j) => (j.copies || 1) > 1).length;

  // Group by Event
  const eventGroupMap = new Map<string, { name: string; jobs: number; sheets: number }>();
  printJobs.forEach((j) => {
    const key = j.event_id || 'unknown';
    const cur = eventGroupMap.get(key) || { name: j.event_name || 'Acara Tidak Dikenal', jobs: 0, sheets: 0 };
    cur.jobs++;
    cur.sheets += j.copies || 1;
    eventGroupMap.set(key, cur);
  });
  const eventBreakdown = Array.from(eventGroupMap.values()).sort((a, b) => b.sheets - a.sheets);

  // Group by Printer
  const printerGroupMap = new Map<string, { name: string; jobs: number; sheets: number }>();
  printJobs.forEach((j) => {
    const key = j.profile_name || 'Printer Bawaan';
    const cur = printerGroupMap.get(key) || { name: key, jobs: 0, sheets: 0 };
    cur.jobs++;
    cur.sheets += j.copies || 1;
    printerGroupMap.set(key, cur);
  });
  const printerBreakdown = Array.from(printerGroupMap.values()).sort((a, b) => b.sheets - a.sheets);

  // Group by Operator
  const operatorGroupMap = new Map<string, { name: string; jobs: number; sheets: number }>();
  printJobs.forEach((j) => {
    const key = j.printed_by || 'operator';
    const cur = operatorGroupMap.get(key) || { name: key, jobs: 0, sheets: 0 };
    cur.jobs++;
    cur.sheets += j.copies || 1;
    operatorGroupMap.set(key, cur);
  });
  const operatorBreakdown = Array.from(operatorGroupMap.values()).sort((a, b) => b.sheets - a.sheets);

  // Exports
  const handleExportCsv = () => {
    const headers = ['Waktu Cetak', 'Kode Foto', 'User / Acara', 'Profil Printer', 'Jumlah Salinan', 'Operator'];
    const dataRows = printJobs.map((j) => [
      new Date(j.printed_at).toLocaleString('id-ID'),
      j.session_code || '-',
      j.event_name || '-',
      j.profile_name || 'Printer Standar',
      j.copies || 1,
      j.printed_by || 'operator',
    ]);
    exportToCsv(`Laporan_Cetak_${startDate}_sd_${endDate}`, headers, dataRows);
  };

  const handleExportXlsx = () => {
    const headers = ['Waktu Cetak', 'Kode Foto', 'Acara Pernikahan', 'Profil Kertas / Printer', 'Jumlah Salinan', 'Operator Booth'];
    const dataRows = printJobs.map((j) => [
      new Date(j.printed_at).toLocaleString('id-ID'),
      j.session_code || '-',
      j.event_name || '-',
      j.profile_name || 'Printer Standar',
      j.copies || 1,
      j.printed_by || 'operator',
    ]);
    exportToXlsx(`Laporan_Cetak_Foto`, 'Riwayat Cetak', headers, dataRows);
  };

  return (
    <div className="space-y-6">
      <ReportToolbar
        title="Laporan Cetak & Pemakaian Kertas"
        description="Analisis volume cetak foto fisik, konsumsi kertas photo paper, breakdown per printer, dan audit operator booth."
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
        onRefresh={loadData}
        isRefreshing={isLoading}
        extraControls={
          <div className="flex items-center rounded-full border-2 border-black p-0.5 bg-stone-100 text-xs font-serif shadow-xs">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                activeTab === 'summary' ? 'bg-black text-white font-bold' : 'text-stone-700 hover:text-black'
              }`}
            >
              Semua Log ({printJobs.length})
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                activeTab === 'events' ? 'bg-black text-white font-bold' : 'text-stone-700 hover:text-black'
              }`}
            >
              Per User
            </button>
            <button
              onClick={() => setActiveTab('printers')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                activeTab === 'printers' ? 'bg-black text-white font-bold' : 'text-stone-700 hover:text-black'
              }`}
            >
              Per Printer
            </button>
            <button
              onClick={() => setActiveTab('operators')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                activeTab === 'operators' ? 'bg-black text-white font-bold' : 'text-stone-700 hover:text-black'
              }`}
            >
              Per Operator
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Total Lembar Kertas
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {totalSheets} <span className="text-xs font-normal text-stone-500">lembar</span>
          </div>
          <span className="text-[10px] text-stone-500 mt-0.5 block">Estimasi konsumsi media cetak</span>
        </div>

        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Total Sesi Dicetak
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {totalJobs} <span className="text-xs font-normal text-stone-500">transaksi</span>
          </div>
          <span className="text-[10px] text-stone-500 mt-0.5 block">Job cetak dieksekusi</span>
        </div>

        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Cetak Ulang (Reprint)
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {reprintsCount} <span className="text-xs font-normal text-stone-500">job</span>
          </div>
          <span className="text-[10px] text-stone-500 mt-0.5 block">Permintaan salinan ekstra (&gt; 1x)</span>
        </div>

        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Rata-rata Salinan / Sesi
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {totalJobs > 0 ? (totalSheets / totalJobs).toFixed(1) : 0}x
          </div>
          <span className="text-[10px] text-stone-500 mt-0.5 block">Salinan per job cetak</span>
        </div>
      </div>

      {/* Tab 1: All Log Table */}
      {activeTab === 'summary' && (
        <div className="border-2 border-black rounded-2xl overflow-hidden bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black bg-stone-100 font-serif font-bold text-stone-950">
                  <th className="p-3.5">Waktu Cetak</th>
                  <th className="p-3.5">Kode Foto</th>
                  <th className="p-3.5">User / Acara</th>
                  <th className="p-3.5">Profil Printer</th>
                  <th className="p-3.5 text-center">Salinan</th>
                  <th className="p-3.5">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {printJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-stone-400 font-serif">
                      Tidak ada riwayat cetak pada periode ini.
                    </td>
                  </tr>
                ) : (
                  printJobs.map((j) => (
                    <tr key={j.id} className="hover:bg-stone-50 transition-colors">
                      <td className="p-3.5 font-mono text-stone-600">
                        {new Date(j.printed_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-stone-950">
                        {j.session_code || '-'}
                      </td>
                      <td className="p-3.5 font-serif font-medium text-stone-900">
                        {j.event_name || '-'}
                      </td>
                      <td className="p-3.5 text-stone-700">{j.profile_name || 'Standar'}</td>
                      <td className="p-3.5 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 border border-stone-300 text-stone-800">
                          {j.copies || 1}x cetak
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-stone-600">{j.printed_by || 'operator'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Breakdown per User */}
      {activeTab === 'events' && (
        <div className="border-2 border-black rounded-2xl overflow-hidden bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-black bg-stone-100 font-serif font-bold text-stone-950">
                <th className="p-3.5">User / Acara Pernikahan</th>
                <th className="p-3.5 text-right">Total Transaksi Cetak</th>
                <th className="p-3.5 text-right">Total Lembar Kertas</th>
                <th className="p-3.5 text-right">Persentase Konsumsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {eventBreakdown.map((row) => (
                <tr key={row.name} className="hover:bg-stone-50 transition-colors">
                  <td className="p-3.5 font-serif font-bold text-stone-950">{row.name}</td>
                  <td className="p-3.5 text-right font-mono text-stone-700">{row.jobs} kali</td>
                  <td className="p-3.5 text-right font-serif font-bold text-emerald-800">{row.sheets} lembar</td>
                  <td className="p-3.5 text-right font-mono text-stone-600">
                    {totalSheets > 0 ? Math.round((row.sheets / totalSheets) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Breakdown per Printer */}
      {activeTab === 'printers' && (
        <div className="border-2 border-black rounded-2xl overflow-hidden bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-black bg-stone-100 font-serif font-bold text-stone-950">
                <th className="p-3.5">Profil Printer &amp; Preset Kertas</th>
                <th className="p-3.5 text-right">Total Transaksi Cetak</th>
                <th className="p-3.5 text-right">Total Lembar Kertas</th>
                <th className="p-3.5 text-right">Persentase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {printerBreakdown.map((row) => (
                <tr key={row.name} className="hover:bg-stone-50 transition-colors">
                  <td className="p-3.5 font-serif font-bold text-stone-950">{row.name}</td>
                  <td className="p-3.5 text-right font-mono text-stone-700">{row.jobs} kali</td>
                  <td className="p-3.5 text-right font-serif font-bold text-emerald-800">{row.sheets} lembar</td>
                  <td className="p-3.5 text-right font-mono text-stone-600">
                    {totalSheets > 0 ? Math.round((row.sheets / totalSheets) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Breakdown per Operator */}
      {activeTab === 'operators' && (
        <div className="border-2 border-black rounded-2xl overflow-hidden bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-black bg-stone-100 font-serif font-bold text-stone-950">
                <th className="p-3.5">Nama Operator Cetak</th>
                <th className="p-3.5 text-right">Total Transaksi Cetak</th>
                <th className="p-3.5 text-right">Total Lembar Kertas</th>
                <th className="p-3.5 text-right">Kontribusi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {operatorBreakdown.map((row) => (
                <tr key={row.name} className="hover:bg-stone-50 transition-colors">
                  <td className="p-3.5 font-serif font-bold text-stone-950 flex items-center space-x-2">
                    <UserCheck className="w-3.5 h-3.5 text-stone-600" />
                    <span>{row.name}</span>
                  </td>
                  <td className="p-3.5 text-right font-mono text-stone-700">{row.jobs} kali</td>
                  <td className="p-3.5 text-right font-serif font-bold text-emerald-800">{row.sheets} lembar</td>
                  <td className="p-3.5 text-right font-mono text-stone-600">
                    {totalSheets > 0 ? Math.round((row.sheets / totalSheets) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
