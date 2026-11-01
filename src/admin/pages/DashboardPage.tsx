import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  Calendar,
  CalendarDays,
  Camera,
  Printer,
  HardDrive,
  Clock,
  Sparkles,
  RefreshCw,
  Smartphone,
  ChevronRight,
  TrendingDown,
  Filter as FilterIcon,
  Layers,
  ArrowUpRight,
  AlertCircle,
  Activity,
  User,
} from 'lucide-react';
import { AdminProfile, AppSettings, AuditLog } from '../../types/admin';
import {
  DashboardSummary,
  SessionsPerDay,
  SessionsPerHour,
  TopTemplate,
  TopFilter,
  FunnelStep,
  DownloadByType,
  PrintsPerDay,
  Event,
} from '../../types/photobooth';
import { PhotoboothService } from '../../services/supabase';
import { EventService } from '../../services/eventService';
import { AdminService } from '../../services/adminService';

interface DashboardPageProps {
  currentAdmin: AdminProfile;
  appSettings: AppSettings;
  onNavigate: (path: string) => void;
}

type DatePreset = 'today' | '7days' | '30days' | 'custom';

export const DashboardPage: React.FC<DashboardPageProps> = ({
  currentAdmin,
  appSettings,
  onNavigate,
}) => {
  // Global Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('30days');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  // Data states
  const [events, setEvents] = useState<Event[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sessionsPerDay, setSessionsPerDay] = useState<SessionsPerDay[]>([]);
  const [sessionsPerHour, setSessionsPerHour] = useState<SessionsPerHour[]>([]);
  const [topTemplates, setTopTemplates] = useState<TopTemplate[]>([]);
  const [topFilters, setTopFilters] = useState<TopFilter[]>([]);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [downloadsByType, setDownloadsByType] = useState<DownloadByType[]>([]);
  const [printsPerDay, setPrintsPerDay] = useState<PrintsPerDay[]>([]);
  const [demographics, setDemographics] = useState<{
    os: { name: string; count: number }[];
    camera: { name: string; count: number }[];
  }>({ os: [], camera: [] });
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Preset changer
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    setEndDate(todayStr);

    if (preset === 'today') {
      setStartDate(todayStr);
    } else if (preset === '7days') {
      const past7 = new Date(Date.now() - 7 * 86400000);
      setStartDate(past7.toISOString().split('T')[0]);
    } else if (preset === '30days') {
      const past30 = new Date(Date.now() - 30 * 86400000);
      setStartDate(past30.toISOString().split('T')[0]);
    }
  };

  // Load all dashboard metrics
  const loadDashboardData = useCallback(async (showRefreshingSpinner = false) => {
    if (showRefreshingSpinner) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const allEvts = await EventService.getEvents();
      // Filter by permissions if team
      const allowed =
        currentAdmin.role === 'team' && currentAdmin.allowed_event_ids
          ? allEvts.filter((e) => currentAdmin.allowed_event_ids!.includes(e.id))
          : allEvts;
      setEvents(allowed);

      // Compute ISO bounds
      const fromIso = new Date(`${startDate}T00:00:00.000Z`).toISOString();
      const toIso = new Date(`${endDate}T23:59:59.999Z`).toISOString();
      const eventFilter = selectedEventId || undefined;
      const allowedFilter =
        currentAdmin.role === 'team' && currentAdmin.allowed_event_ids
          ? currentAdmin.allowed_event_ids
          : undefined;

      const [
        sum,
        sDay,
        sHour,
        tTemplates,
        tFilters,
        fnl,
        dlTypes,
        pDay,
        demo,
        logs,
      ] = await Promise.all([
        PhotoboothService.getDashboardSummary(fromIso, toIso, eventFilter, allowedFilter),
        PhotoboothService.getSessionsPerDay(fromIso, toIso, eventFilter, allowedFilter),
        PhotoboothService.getSessionsPerHour(fromIso, toIso, eventFilter, allowedFilter),
        PhotoboothService.getTopTemplates(fromIso, toIso, eventFilter, allowedFilter),
        PhotoboothService.getTopFilters(fromIso, toIso, eventFilter, allowedFilter),
        PhotoboothService.getFunnel(fromIso, toIso, eventFilter, allowedFilter),
        PhotoboothService.getDownloadsByType(fromIso, toIso, eventFilter, allowedFilter),
        PhotoboothService.getPrintsPerDay(fromIso, toIso, eventFilter, allowedFilter),
        PhotoboothService.getDeviceDemographics(fromIso, toIso, eventFilter, allowedFilter),
        AdminService.getAuditLogs(10),
      ]);

      setSummary(sum);
      setSessionsPerDay(sDay);
      setSessionsPerHour(sHour);
      setTopTemplates(tTemplates.slice(0, 5));
      setTopFilters(tFilters.slice(0, 5));
      setFunnel(fnl);
      setDownloadsByType(dlTypes);
      setPrintsPerDay(pDay);
      setDemographics(demo);
      setRecentLogs(logs);

      // Upcoming 7 days events
      const nowTs = Date.now();
      const in7DaysTs = nowTs + 7 * 86400000;
      const up = allowed.filter((e) => {
        if (!e.event_date) return false;
        // Parse simple string or date
        const d = new Date(e.event_date).getTime();
        return !isNaN(d) && d >= nowTs - 86400000 && d <= in7DaysTs;
      });
      setUpcomingEvents(up.length > 0 ? up : allowed.slice(0, 3));
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate, selectedEventId, currentAdmin]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Color palette for charts
  const CHART_COLORS = ['#1c1917', '#d4af37', '#78716c', '#0284c7', '#059669', '#ea580c'];

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header & Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="font-serif font-bold text-2xl md:text-3xl text-stone-950 tracking-tight">
            Dashboard Rekap Photobooth
          </h1>
          <p className="text-xs text-stone-600 mt-1">
            Statistik performa real-time, grafik funnel konversi tamu, antrean cetak, dan analitik acara.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Preset Buttons */}
          <div className="flex items-center rounded-full border-2 border-black p-0.5 bg-stone-100 text-xs font-serif shadow-xs">
            <button
              onClick={() => handlePresetChange('today')}
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                datePreset === 'today'
                  ? 'bg-black text-white font-bold shadow-xs'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => handlePresetChange('7days')}
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                datePreset === '7days'
                  ? 'bg-black text-white font-bold shadow-xs'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => handlePresetChange('30days')}
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                datePreset === '30days'
                  ? 'bg-black text-white font-bold shadow-xs'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              30 Hari
            </button>
            <button
              onClick={() => setDatePreset('custom')}
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                datePreset === 'custom'
                  ? 'bg-black text-white font-bold shadow-xs'
                  : 'text-stone-700 hover:text-black'
              }`}
            >
              Kustom
            </button>
          </div>

          {/* Custom Date Pickers */}
          {datePreset === 'custom' && (
            <div className="flex items-center space-x-1.5 bg-white border-2 border-black rounded-full px-3 py-1 shadow-xs text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-stone-800 focus:outline-hidden font-mono cursor-pointer"
              />
              <span className="text-stone-400 font-bold">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-stone-800 focus:outline-hidden font-mono cursor-pointer"
              />
            </div>
          )}

          {/* Event selector */}
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="border-2 border-black rounded-full px-3 py-1.5 text-xs font-serif bg-white text-stone-900 cursor-pointer shadow-xs focus:outline-hidden"
          >
            <option value="">Semua User / Acara</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.code_prefix})
              </option>
            ))}
          </select>

          {/* Refresh button */}
          <button
            onClick={() => loadDashboardData(true)}
            disabled={isRefreshing || isLoading}
            className="p-2 rounded-full border-2 border-black bg-white hover:bg-stone-100 text-stone-900 shadow-xs active:scale-95 transition-all cursor-pointer"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards (7 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
        {/* KPI 1: Acara Aktif */}
        <div className="p-4 rounded-2xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-serif uppercase tracking-wider font-bold">Acara Aktif</span>
            <CalendarDays className="w-4 h-4 text-stone-700" />
          </div>
          <div>
            <div className="font-serif font-bold text-2xl text-stone-950">
              {isLoading ? '...' : summary?.active_events_count ?? 0}
            </div>
            <span className="text-[10px] text-stone-500 mt-0.5 block">Status aktif hari ini</span>
          </div>
        </div>

        {/* KPI 2: Total Sesi */}
        <div className="p-4 rounded-2xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-serif uppercase tracking-wider font-bold">Total Sesi</span>
            <Sparkles className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="font-serif font-bold text-2xl text-stone-950">
              {isLoading ? '...' : summary?.total_sessions ?? 0}
            </div>
            <span className="text-[10px] text-stone-500 mt-0.5 block">Sesi tamu pada periode</span>
          </div>
        </div>

        {/* KPI 3: Total Foto */}
        <div className="p-4 rounded-2xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-serif uppercase tracking-wider font-bold">Foto Diambil</span>
            <Camera className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="font-serif font-bold text-2xl text-stone-950">
              {isLoading ? '...' : summary?.total_photos ?? 0}
            </div>
            <span className="text-[10px] text-stone-500 mt-0.5 block">Total jepretan kamera</span>
          </div>
        </div>

        {/* KPI 4: Total Cetak */}
        <div className="p-4 rounded-2xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-serif uppercase tracking-wider font-bold">Total Cetak</span>
            <Printer className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="font-serif font-bold text-2xl text-stone-950">
              {isLoading ? '...' : summary?.total_prints ?? 0}
            </div>
            <span className="text-[10px] text-stone-500 mt-0.5 block">Lembar salinan dicetak</span>
          </div>
        </div>

        {/* KPI 5: Avg Retake */}
        <div className="p-4 rounded-2xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-serif uppercase tracking-wider font-bold">Rata-rata Retake</span>
            <Activity className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <div className="font-serif font-bold text-2xl text-stone-950">
              {isLoading ? '...' : `${summary?.avg_retakes ?? 0}x`}
            </div>
            <span className="text-[10px] text-stone-500 mt-0.5 block">Foto ulang per sesi</span>
          </div>
        </div>

        {/* KPI 6: Storage Terpakai */}
        <div className="p-4 rounded-2xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-serif uppercase tracking-wider font-bold">Storage Aktif</span>
            <HardDrive className="w-4 h-4 text-stone-800" />
          </div>
          <div>
            <div className="font-serif font-bold text-xl text-stone-950 truncate">
              {isLoading ? '...' : formatBytes(summary?.storage_used_bytes ?? 0)}
            </div>
            <span className="text-[10px] text-stone-500 mt-0.5 block">File softfile tersimpan</span>
          </div>
        </div>

        {/* KPI 7: Expiring in 24h */}
        <div className="p-4 rounded-2xl border-2 border-black bg-amber-50/70 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-amber-800 mb-2">
            <span className="text-[11px] font-serif uppercase tracking-wider font-bold">Hapus &lt; 24 Jam</span>
            <Clock className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <div className="font-serif font-bold text-2xl text-amber-950">
              {isLoading ? '...' : summary?.expiring_in_24h_count ?? 0}
            </div>
            <span className="text-[10px] text-amber-800 mt-0.5 block">Segera kedaluwarsa</span>
          </div>
        </div>
      </div>

      {/* 3. Main Chart Row 1: Sesi per Hari & Jam Ramai */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart: Sesi Per Hari (2 columns) */}
        <div className="lg:col-span-2 p-5 rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif font-bold text-base text-stone-950">
                Aktivitas Sesi Foto &amp; Jepretan per Hari
              </h2>
              <span className="text-[11px] text-stone-500">
                Tren jumlah sesi tamu dan foto yang diambil sepanjang periode terpilih
              </span>
            </div>
          </div>

          <div className="w-full h-64">
            {sessionsPerDay.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 text-xs font-serif">
                <AlertCircle className="w-6 h-6 mb-1 text-stone-300" />
                Belum ada data sesi pada rentang tanggal ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sessionsPerDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis
                    dataKey="date_label"
                    tick={{ fontSize: 10, fill: '#78716c' }}
                    tickFormatter={(val) => val.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#78716c' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1c1917',
                      color: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #444',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line
                    type="monotone"
                    dataKey="sessions_count"
                    name="Sesi Tamu"
                    stroke="#1c1917"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="photos_count"
                    name="Foto Diambil"
                    stroke="#d4af37"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bar Chart: Jam Ramai (1 column) */}
        <div className="p-5 rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col">
          <div className="mb-4">
            <h2 className="font-serif font-bold text-base text-stone-950">
              Jam Ramai (Peak Hours)
            </h2>
            <span className="text-[11px] text-stone-500">
              Distribusi kepadatan pemakaian photobooth per jam (00:00 - 23:00)
            </span>
          </div>

          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sessionsPerHour} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="hour_of_day"
                  tick={{ fontSize: 9, fill: '#78716c' }}
                  tickFormatter={(h) => `${h}`}
                />
                <YAxis tick={{ fontSize: 10, fill: '#78716c' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1c1917',
                    color: '#ffffff',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                  formatter={(val: any) => [`${val} sesi`, 'Jumlah Sesi']}
                  labelFormatter={(h) => `Pukul ${h}:00 - ${h}:59`}
                />
                <Bar dataKey="sessions_count" name="Sesi" fill="#1c1917" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Funnel Konversi Tamu (Mulai -> Pilih Frame -> Foto Selesai -> Filter -> Unduh) */}
      <div className="p-6 rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="font-serif font-bold text-lg text-stone-950 flex items-center space-x-2">
              <span>Funnel Alur Pengunjung (Conversion &amp; Drop-off)</span>
            </h2>
            <p className="text-xs text-stone-600 mt-0.5">
              Tingkat penyelesaian langkah tamu dari layar Mulai hingga Unduh softfile, beserta persentase drop-off.
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 bg-stone-100 border border-stone-300 rounded-full text-stone-800 self-start">
            5 Langkah Selesai
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {funnel.map((step, idx) => (
            <div
              key={step.step}
              className="p-4 rounded-xl border-2 border-black bg-stone-50/70 relative flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold text-stone-400">
                  0{step.step_order}
                </span>
                {idx > 0 && (
                  <span
                    className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      step.drop_off_pct > 25
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
                    {step.drop_off_pct}% drop
                  </span>
                )}
              </div>

              <div>
                <span className="font-serif text-xs font-bold text-stone-800 block">
                  {step.step_label}
                </span>
                <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
                  {step.count}
                </div>
              </div>

              <div className="w-full bg-stone-200 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-stone-900 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      funnel[0]?.count ? Math.round((step.count / funnel[0].count) * 100) : 0
                    )}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Chart Row 2: Template Populer, Filter Terpopuler, Demografi OS & Kamera */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Template Terpopuler (Horizontal Bar) */}
        <div className="p-5 rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col">
          <div className="mb-4">
            <h2 className="font-serif font-bold text-base text-stone-950">
              Template Terpopuler
            </h2>
            <span className="text-[11px] text-stone-500">
              Desain frame yang paling sering dipilih oleh tamu
            </span>
          </div>

          <div className="w-full h-60">
            {topTemplates.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-stone-400 font-serif">
                Belum ada data pemakaian template.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={topTemplates}
                  margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#78716c' }} allowDecimals={false} />
                  <YAxis
                    dataKey="template_name"
                    type="category"
                    tick={{ fontSize: 10, fill: '#1c1917' }}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1c1917',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                    formatter={(val: any) => [`${val} pemakaian`, 'Total Sesi']}
                  />
                  <Bar dataKey="usage_count" fill="#1c1917" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Filter Terpopuler (Donut) */}
        <div className="p-5 rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col">
          <div className="mb-4">
            <h2 className="font-serif font-bold text-base text-stone-950">
              Filter Warna Terfavorit
            </h2>
            <span className="text-[11px] text-stone-500">
              Proporsi LUT color grading yang diterapkan tamu
            </span>
          </div>

          <div className="w-full h-60 flex items-center justify-center">
            {topFilters.length === 0 ? (
              <div className="text-xs text-stone-400 font-serif">
                Belum ada data pemakaian filter.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topFilters}
                    dataKey="usage_count"
                    nameKey="filter_name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {topFilters.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1c1917',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Demografi Perangkat (OS & Kamera) */}
        <div className="p-5 rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div>
            <h2 className="font-serif font-bold text-base text-stone-950">
              Demografi Perangkat Tamu
            </h2>
            <span className="text-[11px] text-stone-500 block mb-4">
              Sistem operasi (OS) dan orientasi kamera tamu
            </span>

            {/* OS Breakdown */}
            <div className="space-y-2 mb-4">
              <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block">
                Sistem Operasi
              </span>
              {demographics.os.map((item) => {
                const totalOs = demographics.os.reduce((s, o) => s + o.count, 0) || 1;
                const pct = Math.round((item.count / totalOs) * 100);
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-stone-800">{item.name}</span>
                      <span className="font-mono text-stone-500">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden border border-stone-200">
                      <div
                        className="bg-stone-900 h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Camera facing */}
            <div className="space-y-2 pt-2 border-t border-stone-200">
              <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block">
                Kamera yang Digunakan
              </span>
              <div className="grid grid-cols-2 gap-2">
                {demographics.camera.map((cam) => (
                  <div
                    key={cam.name}
                    className="p-2.5 rounded-xl border border-stone-300 bg-stone-50 text-center"
                  >
                    <span className="text-[10px] text-stone-500 block">{cam.name}</span>
                    <span className="font-serif font-bold text-base text-stone-950">
                      {cam.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Chart Row 3: Unduhan per Jenis & Cetak per Hari */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Unduhan per Jenis */}
        <div className="p-5 rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="mb-4">
            <h2 className="font-serif font-bold text-base text-stone-950">
              Aset Softfile Diunduh Tamu
            </h2>
            <span className="text-[11px] text-stone-500">
              Perbandingan jenis format yang disimpan (Frame, Raw Foto, Live Photo, GIF)
            </span>
          </div>

          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={downloadsByType} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#78716c' }} />
                <YAxis tick={{ fontSize: 10, fill: '#78716c' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1c1917',
                    color: '#ffffff',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                  formatter={(val: any) => [`${val} file`, 'Total Diunduh']}
                />
                <Bar dataKey="count" fill="#d4af37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cetak per Hari */}
        <div className="p-5 rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="mb-4">
            <h2 className="font-serif font-bold text-base text-stone-950">
              Cetak Salinan Foto per Hari
            </h2>
            <span className="text-[11px] text-stone-500">
              Volume lembar cetak fisik foto yang dikeluarkan printer booth
            </span>
          </div>

          <div className="w-full h-56">
            {printsPerDay.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 text-xs font-serif">
                Belum ada data cetak pada rentang tanggal ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={printsPerDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date_label"
                    tick={{ fontSize: 10, fill: '#78716c' }}
                    tickFormatter={(val) => val.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#78716c' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1c1917',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                    formatter={(val: any) => [`${val} lembar`, 'Total Salinan']}
                  />
                  <Bar dataKey="copies_count" fill="#1c1917" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 7. Bottom Section: Acara Mendatang & Audit Log Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel Acara Hari Ini dan 7 Hari ke Depan */}
        <div className="p-5 rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif font-bold text-base text-stone-950">
                Acara Hari Ini &amp; 7 Hari ke Depan
              </h2>
              <span className="text-[11px] text-stone-500">
                Jadwal resepsi pernikahan yang sedang atau segera berlangsung
              </span>
            </div>
            <button
              onClick={() => onNavigate('/admin/events')}
              className="text-xs font-serif font-bold text-stone-900 hover:underline flex items-center"
            >
              Kelola User <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>

          <div className="space-y-2.5 flex-1">
            {upcomingEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400 font-serif">
                Tidak ada acara dalam 7 hari ke depan.
              </div>
            ) : (
              upcomingEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3.5 rounded-xl border border-stone-200 hover:border-black transition-all flex items-center justify-between bg-stone-50/50"
                >
                  <div className="overflow-hidden pr-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-800">
                        {evt.code_prefix}
                      </span>
                      <h3 className="font-serif font-bold text-xs text-stone-950 truncate">
                        {evt.name}
                      </h3>
                      {evt.is_demo && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900">
                          Demo
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-stone-500 mt-1 block">
                      {evt.event_date || 'Tanggal belum ditentukan'} • {evt.couple_names || evt.name}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => onNavigate('/admin/booking/results')}
                      className="px-3 py-1.5 rounded-full border border-black bg-white hover:bg-stone-100 text-[11px] font-serif font-bold cursor-pointer"
                    >
                      Buka Sesi
                    </button>
                    <a
                      href={`/e/${evt.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-full border border-stone-300 hover:border-black bg-white text-stone-700 hover:text-black cursor-pointer"
                      title="Buka Link Tamu"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Feed Aktivitas Terbaru (Audit Log) */}
        <div className="p-5 rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif font-bold text-base text-stone-950">
                Aktivitas &amp; Log Tim Terbaru
              </h2>
              <span className="text-[11px] text-stone-500">
                Audit trail operasi admin, cetak foto, login, dan manajemen konfigurasi
              </span>
            </div>
            <button
              onClick={() => onNavigate('/admin/reports/audit-log')}
              className="text-xs font-serif font-bold text-stone-900 hover:underline flex items-center"
            >
              Semua Log <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>

          <div className="space-y-2 flex-1">
            {recentLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400 font-serif">
                Belum ada aktivitas tercatat.
              </div>
            ) : (
              recentLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl border border-stone-200 bg-stone-50/50 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2.5 overflow-hidden pr-2">
                    <div className="w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      {log.username.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <span className="font-bold text-stone-950 block truncate">
                        {log.username}{' '}
                        <span className="font-normal text-stone-600">
                          melakukan {log.action.replace(/_/g, ' ')} pada {log.entity}
                        </span>
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-stone-400 shrink-0">
                    {new Date(log.created_at).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
