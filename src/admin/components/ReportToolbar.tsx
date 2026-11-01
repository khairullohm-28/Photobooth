import React from 'react';
import { Download, FileSpreadsheet, FileText, Printer, RefreshCw } from 'lucide-react';
import { Event } from '../../types/photobooth';

export type DatePreset = 'today' | '7days' | '30days' | 'custom';

interface ReportToolbarProps {
  title: string;
  description: string;
  datePreset?: DatePreset;
  onPresetChange?: (preset: DatePreset) => void;
  startDate?: string;
  onStartDateChange?: (val: string) => void;
  endDate?: string;
  onEndDateChange?: (val: string) => void;
  events?: Event[];
  selectedEventId?: string;
  onEventChange?: (id: string) => void;
  onExportCsv?: () => void;
  onExportXlsx?: () => void;
  onPrintPdf?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  extraControls?: React.ReactNode;
}

export const ReportToolbar: React.FC<ReportToolbarProps> = ({
  title,
  description,
  datePreset,
  onPresetChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  events,
  selectedEventId,
  onEventChange,
  onExportCsv,
  onExportXlsx,
  onPrintPdf,
  onRefresh,
  isRefreshing,
  extraControls,
}) => {
  return (
    <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 no-print">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif font-bold text-2xl md:text-3xl text-stone-950 tracking-tight">
            {title}
          </h1>
          <p className="text-xs text-stone-600 mt-1">{description}</p>
        </div>

        {/* Action Buttons: Export XLSX, CSV, Print PDF */}
        <div className="flex flex-wrap items-center gap-2">
          {onPrintPdf && (
            <button
              onClick={onPrintPdf}
              className="px-3.5 py-1.5 rounded-full border-2 border-black bg-stone-900 text-white hover:bg-black text-xs font-serif font-bold flex items-center space-x-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>
          )}

          {onExportXlsx && (
            <button
              onClick={onExportXlsx}
              className="px-3 py-1.5 rounded-full border-2 border-black bg-white hover:bg-stone-100 text-stone-900 text-xs font-serif font-bold flex items-center space-x-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>
          )}

          {onExportCsv && (
            <button
              onClick={onExportCsv}
              className="px-3 py-1.5 rounded-full border-2 border-black bg-white hover:bg-stone-100 text-stone-900 text-xs font-serif font-bold flex items-center space-x-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-full border-2 border-black bg-white hover:bg-stone-100 text-stone-900 shadow-xs active:scale-95 transition-all cursor-pointer"
              title="Segarkan"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        {onPresetChange && datePreset && (
          <div className="flex items-center rounded-full border-2 border-black p-0.5 bg-stone-100 text-xs font-serif shadow-xs">
            <button
              onClick={() => onPresetChange('today')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                datePreset === 'today'
                  ? 'bg-black text-white font-bold shadow-xs'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => onPresetChange('7days')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                datePreset === '7days'
                  ? 'bg-black text-white font-bold shadow-xs'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => onPresetChange('30days')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                datePreset === '30days'
                  ? 'bg-black text-white font-bold shadow-xs'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              30 Hari
            </button>
            <button
              onClick={() => onPresetChange('custom')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                datePreset === 'custom'
                  ? 'bg-black text-white font-bold shadow-xs'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              Kustom
            </button>
          </div>
        )}

        {datePreset === 'custom' && onStartDateChange && onEndDateChange && (
          <div className="flex items-center space-x-1.5 bg-white border-2 border-black rounded-full px-3 py-1 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="bg-transparent text-stone-800 focus:outline-hidden font-mono cursor-pointer"
            />
            <span className="text-stone-400 font-bold">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="bg-transparent text-stone-800 focus:outline-hidden font-mono cursor-pointer"
            />
          </div>
        )}

        {events && onEventChange && (
          <select
            value={selectedEventId || ''}
            onChange={(e) => onEventChange(e.target.value)}
            className="border-2 border-black rounded-full px-3 py-1 text-xs font-serif bg-white text-stone-900 cursor-pointer shadow-xs focus:outline-hidden"
          >
            <option value="">Semua User / Acara</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.code_prefix})
              </option>
            ))}
          </select>
        )}

        {extraControls}
      </div>
    </div>
  );
};
