import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  Filter as FilterIcon,
  Download,
  FileSpreadsheet,
  Printer,
  Sparkles,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { AdminProfile, AppSettings } from '../../../types/admin';
import { Event, Frame, Filter, TopTemplate, TopFilter } from '../../../types/photobooth';
import { PhotoboothService } from '../../../services/supabase';
import { EventService } from '../../../services/eventService';
import { StudioService } from '../../../services/studioService';
import { FilterService } from '../../../services/filterService';
import { exportToCsv, exportToXlsx, printReportPage } from '../../../utils/exportUtils';
import { ReportToolbar, DatePreset } from '../../components/ReportToolbar';

interface TemplatesFiltersReportPageProps {
  currentAdmin: AdminProfile;
  appSettings: AppSettings;
}

export const TemplatesFiltersReportPage: React.FC<TemplatesFiltersReportPageProps> = ({
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
  const [activeTab, setActiveTab] = useState<'templates' | 'filters'>('templates');

  const [allFrames, setAllFrames] = useState<Frame[]>([]);
  const [allFilters, setAllFilters] = useState<Filter[]>([]);
  const [templateUsage, setTemplateUsage] = useState<TopTemplate[]>([]);
  const [filterUsage, setFilterUsage] = useState<TopFilter[]>([]);
  const [totalSessionsCount, setTotalSessionsCount] = useState<number>(0);
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
      const fromIso = new Date(`${startDate}T00:00:00.000Z`).toISOString();
      const toIso = new Date(`${endDate}T23:59:59.999Z`).toISOString();
      const eventFilter = selectedEventId || undefined;
      const allowedFilter =
        currentAdmin.role === 'team' && currentAdmin.allowed_event_ids
          ? currentAdmin.allowed_event_ids
          : undefined;

      const [frames, filters, tUsage, fUsage, summary] = await Promise.all([
        StudioService.getFrames(),
        FilterService.getFilters(),
        PhotoboothService.getTopTemplates(fromIso, toIso, eventFilter, allowedFilter),
        PhotoboothService.getTopFilters(fromIso, toIso, eventFilter, allowedFilter),
        PhotoboothService.getDashboardSummary(fromIso, toIso, eventFilter, allowedFilter),
      ]);

      setAllFrames(frames);
      setAllFilters(filters);
      setTemplateUsage(tUsage);
      setFilterUsage(fUsage);
      setTotalSessionsCount(summary.total_sessions || 0);
    } catch (err) {
      console.error('Failed to load templates/filters report:', err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedEventId, currentAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Merge full catalogs with usage count (ensuring 0 usage templates/filters are included)
  const templateUsageMap = new Map<string, number>();
  templateUsage.forEach((t) => templateUsageMap.set(t.template_id, t.usage_count));

  const fullTemplatesReport = allFrames.map((f) => {
    const count = templateUsageMap.get(f.id) || 0;
    const pct = totalSessionsCount > 0 ? Math.round((count / totalSessionsCount) * 1000) / 10 : 0;
    return {
      ...f,
      usage_count: count,
      percentage: pct,
    };
  }).sort((a, b) => b.usage_count - a.usage_count);

  const filterUsageMap = new Map<string, number>();
  filterUsage.forEach((fl) => filterUsageMap.set(fl.filter_id, fl.usage_count));

  const fullFiltersReport = allFilters.map((fl) => {
    const count = filterUsageMap.get(fl.id) || 0;
    const pct = totalSessionsCount > 0 ? Math.round((count / totalSessionsCount) * 1000) / 10 : 0;
    return {
      ...fl,
      usage_count: count,
      percentage: pct,
    };
  }).sort((a, b) => b.usage_count - a.usage_count);

  // Unused counts
  const unusedTemplatesCount = fullTemplatesReport.filter((t) => t.usage_count === 0).length;
  const unusedFiltersCount = fullFiltersReport.filter((f) => f.usage_count === 0).length;

  // Exports
  const handleExportCsv = () => {
    if (activeTab === 'templates') {
      const headers = ['Nama Template', 'Dimensi Kanvas', 'Jumlah Slot', 'Total Pemakaian', 'Rasio Pemakaian (%)', 'Status'];
      const dataRows = fullTemplatesReport.map((t) => [
        t.name,
        `${t.canvas_width}x${t.canvas_height}`,
        t.slots?.length || 0,
        t.usage_count,
        `${t.percentage}%`,
        t.usage_count === 0 ? 'Belum Pernah Dipakai' : 'Aktif Digunakan',
      ]);
      exportToCsv(`Laporan_Template_${startDate}_sd_${endDate}`, headers, dataRows);
    } else {
      const headers = ['Nama Filter', 'Ukuran LUT', 'Intensitas Default', 'Total Pemakaian', 'Rasio Pemakaian (%)', 'Status'];
      const dataRows = fullFiltersReport.map((f) => [
        f.name,
        f.lut_size || 33,
        `${f.intensity_default ?? 100}%`,
        f.usage_count,
        `${f.percentage}%`,
        f.usage_count === 0 ? 'Belum Pernah Dipakai' : 'Aktif Digunakan',
      ]);
      exportToCsv(`Laporan_Filter_${startDate}_sd_${endDate}`, headers, dataRows);
    }
  };

  const handleExportXlsx = () => {
    if (activeTab === 'templates') {
      const headers = ['Nama Template Frame', 'Ukuran Kanvas (px)', 'Slot Foto', 'Total Sesi Pemakaian', 'Rasio Pemakaian', 'Status'];
      const dataRows = fullTemplatesReport.map((t) => [
        t.name,
        `${t.canvas_width}x${t.canvas_height}`,
        t.slots?.length || 0,
        t.usage_count,
        `${t.percentage}%`,
        t.usage_count === 0 ? 'Belum Pernah Dipakai' : 'Aktif Digunakan',
      ]);
      exportToXlsx(`Laporan_Template_Foto`, 'Template Foto', headers, dataRows);
    } else {
      const headers = ['Nama Filter LUT', 'Dimensi Grid LUT', 'Intensitas Bawaan', 'Total Sesi Pemakaian', 'Rasio Pemakaian', 'Status'];
      const dataRows = fullFiltersReport.map((f) => [
        f.name,
        f.lut_size || 33,
        `${f.intensity_default ?? 100}%`,
        f.usage_count,
        `${f.percentage}%`,
        f.usage_count === 0 ? 'Belum Pernah Dipakai' : 'Aktif Digunakan',
      ]);
      exportToXlsx(`Laporan_Filter_Warna`, 'Filter Warna', headers, dataRows);
    }
  };

  return (
    <div className="space-y-6">
      <ReportToolbar
        title="Laporan Template & Filter"
        description="Statistik komparasi pemakaian template frame dan filter warna LUT oleh tamu, termasuk aset dengan 0 pemakaian."
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
              onClick={() => setActiveTab('templates')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer flex items-center space-x-1 ${
                activeTab === 'templates'
                  ? 'bg-black text-white font-bold'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              <Camera className="w-3.5 h-3.5 mr-1" />
              <span>Template ({fullTemplatesReport.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('filters')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer flex items-center space-x-1 ${
                activeTab === 'filters'
                  ? 'bg-black text-white font-bold'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              <FilterIcon className="w-3.5 h-3.5 mr-1" />
              <span>Filter LUT ({fullFiltersReport.length})</span>
            </button>
          </div>
        }
      />

      {/* Summary KPI info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Total Sesi Dianalisis
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {totalSessionsCount}
          </div>
        </div>
        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Katalog Template
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {fullTemplatesReport.length} <span className="text-xs font-normal text-stone-500">desain</span>
          </div>
        </div>
        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Katalog Filter LUT
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {fullFiltersReport.length} <span className="text-xs font-normal text-stone-500">preset</span>
          </div>
        </div>
        <div className="p-4 rounded-xl border-2 border-black bg-amber-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-amber-800 font-bold block">
            Belum Pernah Dipakai (0x)
          </span>
          <div className="font-serif font-bold text-2xl text-amber-950 mt-1">
            {activeTab === 'templates' ? unusedTemplatesCount : unusedFiltersCount}
            <span className="text-xs font-normal text-amber-800 ml-1">
              {activeTab === 'templates' ? 'template' : 'filter'}
            </span>
          </div>
        </div>
      </div>

      {/* Tab 1: Template Table */}
      {activeTab === 'templates' && (
        <div className="border-2 border-black rounded-2xl overflow-hidden bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black bg-stone-100 font-serif font-bold text-stone-950">
                  <th className="p-3.5 w-16">Preview</th>
                  <th className="p-3.5">Nama Template</th>
                  <th className="p-3.5">Dimensi Kanvas</th>
                  <th className="p-3.5 text-center">Jumlah Slot</th>
                  <th className="p-3.5 text-right">Total Pemakaian</th>
                  <th className="p-3.5 text-right">Persentase</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {fullTemplatesReport.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3.5">
                      <div className="w-10 h-14 rounded border border-stone-300 bg-stone-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {t.preview_url || t.image_url ? (
                          <img
                            src={t.preview_url || t.image_url}
                            alt={t.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Camera className="w-4 h-4 text-stone-400" />
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="font-serif font-bold text-stone-950 block">{t.name}</span>
                      <span className="text-[10px] text-stone-400 font-mono">{t.id}</span>
                    </td>
                    <td className="p-3.5 font-mono text-stone-700">
                      {t.canvas_width} x {t.canvas_height} px
                    </td>
                    <td className="p-3.5 text-center font-mono text-stone-800">
                      {t.slots?.length || 0} slot
                    </td>
                    <td className="p-3.5 text-right font-serif font-bold text-stone-950">
                      {t.usage_count} sesi
                    </td>
                    <td className="p-3.5 text-right font-mono text-stone-700">
                      {t.percentage}%
                    </td>
                    <td className="p-3.5 text-center">
                      {t.usage_count === 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 border border-stone-300 text-stone-500">
                          0 Pemakaian
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 border border-emerald-300 text-emerald-900">
                          Aktif
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Filter Table */}
      {activeTab === 'filters' && (
        <div className="border-2 border-black rounded-2xl overflow-hidden bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black bg-stone-100 font-serif font-bold text-stone-950">
                  <th className="p-3.5">Nama Filter LUT</th>
                  <th className="p-3.5">Grid 3D Size</th>
                  <th className="p-3.5">Intensitas Bawaan</th>
                  <th className="p-3.5 text-right">Total Pemakaian</th>
                  <th className="p-3.5 text-right">Persentase</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {fullFiltersReport.map((fl) => (
                  <tr key={fl.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3.5">
                      <span className="font-serif font-bold text-stone-950 block">{fl.name}</span>
                      <span className="text-[10px] text-stone-400 font-mono">{fl.id}</span>
                    </td>
                    <td className="p-3.5 font-mono text-stone-700">
                      {fl.lut_size || 33}x{fl.lut_size || 33}x{fl.lut_size || 33}
                    </td>
                    <td className="p-3.5 font-mono text-stone-800">
                      {fl.intensity_default ?? 100}%
                    </td>
                    <td className="p-3.5 text-right font-serif font-bold text-stone-950">
                      {fl.usage_count} sesi
                    </td>
                    <td className="p-3.5 text-right font-mono text-stone-700">
                      {fl.percentage}%
                    </td>
                    <td className="p-3.5 text-center">
                      {fl.usage_count === 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 border border-stone-300 text-stone-500">
                          0 Pemakaian
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 border border-emerald-300 text-emerald-900">
                          Aktif
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
