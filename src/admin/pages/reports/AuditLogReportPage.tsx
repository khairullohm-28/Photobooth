import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  UserCheck,
  Search,
  Download,
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter as FilterIcon,
  Activity,
} from 'lucide-react';
import { AdminProfile, AppSettings, AuditLog } from '../../../types/admin';
import { AdminService } from '../../../services/adminService';
import { exportToCsv, exportToXlsx, printReportPage } from '../../../utils/exportUtils';
import { ReportToolbar, DatePreset } from '../../components/ReportToolbar';

interface AuditLogReportPageProps {
  currentAdmin: AdminProfile;
  appSettings: AppSettings;
}

export const AuditLogReportPage: React.FC<AuditLogReportPageProps> = ({ currentAdmin }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>('30days');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Filters
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const today = new Date().toISOString().split('T')[0];
    setEndDate(today);
    if (preset === 'today') setStartDate(today);
    else if (preset === '7days') setStartDate(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
    else if (preset === '30days') setStartDate(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  };

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const allLogs = await AdminService.getAuditLogs(300);
      setLogs(allLogs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Filtered rows
  const fromTime = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${endDate}T23:59:59.999Z`).getTime();

  const filteredLogs = logs.filter((log) => {
    const t = new Date(log.created_at).getTime();
    if (t < fromTime || t > toTime) return false;
    if (selectedUser && log.username !== selectedUser) return false;
    if (selectedAction && !log.action.toLowerCase().includes(selectedAction.toLowerCase())) {
      return false;
    }
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      const inUser = log.username.toLowerCase().includes(kw);
      const inAction = log.action.toLowerCase().includes(kw);
      const inEntity = log.entity.toLowerCase().includes(kw);
      if (!inUser && !inAction && !inEntity) return false;
    }
    return true;
  });

  // Extract unique users & actions
  const uniqueUsers = Array.from(new Set(logs.map((l) => l.username)));
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  // Exports
  const handleExportCsv = () => {
    const headers = ['Waktu', 'Username', 'Aksi', 'Entitas / Modul', 'ID Entitas', 'Detail Metadata'];
    const dataRows = filteredLogs.map((l) => [
      new Date(l.created_at).toLocaleString('id-ID'),
      l.username,
      l.action,
      l.entity,
      l.entity_id || '-',
      l.meta ? JSON.stringify(l.meta) : '-',
    ]);
    exportToCsv(`Audit_Log_Tim_${startDate}_sd_${endDate}`, headers, dataRows);
  };

  const handleExportXlsx = () => {
    const headers = ['Waktu Aktivitas', 'Akun Pengguna', 'Jenis Aksi', 'Modul / Entitas', 'Entity ID', 'Detail Perubahan'];
    const dataRows = filteredLogs.map((l) => [
      new Date(l.created_at).toLocaleString('id-ID'),
      l.username,
      l.action,
      l.entity,
      l.entity_id || '-',
      l.meta ? JSON.stringify(l.meta) : '-',
    ]);
    exportToXlsx(`Audit_Log_Tim`, 'Audit Log', headers, dataRows);
  };

  const getActionBadge = (action: string) => {
    const upper = action.toUpperCase();
    if (upper.includes('LOGIN')) {
      return 'bg-blue-100 text-blue-900 border-blue-300';
    }
    if (upper.includes('CREATE') || upper.includes('TAMBAH')) {
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    }
    if (upper.includes('UPDATE') || upper.includes('EDIT')) {
      return 'bg-amber-100 text-amber-900 border-amber-300';
    }
    if (upper.includes('DELETE') || upper.includes('HAPUS')) {
      return 'bg-rose-100 text-rose-900 border-rose-300';
    }
    if (upper.includes('PRINT') || upper.includes('CETAK')) {
      return 'bg-purple-100 text-purple-900 border-purple-300';
    }
    return 'bg-stone-100 text-stone-800 border-stone-300';
  };

  return (
    <div className="space-y-6">
      <ReportToolbar
        title="Laporan Aktivitas Tim (Audit Log)"
        description="Audit trail lengkap operasi login, konfigurasi sistem, mutasi data, dan aktivitas cetak operator."
        datePreset={datePreset}
        onPresetChange={handlePresetChange}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        onExportCsv={handleExportCsv}
        onExportXlsx={handleExportXlsx}
        onPrintPdf={printReportPage}
        onRefresh={loadLogs}
        isRefreshing={isLoading}
        extraControls={
          <div className="flex flex-wrap items-center gap-2">
            {/* User selector */}
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="border-2 border-black rounded-full px-3 py-1 text-xs font-serif bg-white text-stone-900 cursor-pointer shadow-xs focus:outline-hidden"
            >
              <option value="">Semua Akun</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>

            {/* Action selector */}
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="border-2 border-black rounded-full px-3 py-1 text-xs font-serif bg-white text-stone-900 cursor-pointer shadow-xs focus:outline-hidden"
            >
              <option value="">Semua Aksi</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>
                  {a.replace(/_/g, ' ')}
                </option>
              ))}
            </select>

            {/* Search input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Cari entitas/aksi..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-7 pr-3 py-1 border-2 border-black rounded-full text-xs font-sans bg-white text-stone-900 focus:outline-hidden shadow-xs"
              />
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2" />
            </div>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Total Log Tercatat
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {filteredLogs.length} <span className="text-xs font-normal text-stone-500">entri</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Akun Aktif Terlibat
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {new Set(filteredLogs.map((l) => l.username)).size}{' '}
            <span className="text-xs font-normal text-stone-500">pengguna</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Aktivitas Login
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {filteredLogs.filter((l) => l.action.toLowerCase().includes('login')).length}
          </div>
        </div>

        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[11px] font-serif uppercase tracking-wider text-stone-500 font-bold block">
            Mutasi Data &amp; Cetak
          </span>
          <div className="font-serif font-bold text-2xl text-stone-950 mt-1">
            {filteredLogs.filter((l) => !l.action.toLowerCase().includes('login')).length}
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="border-2 border-black rounded-2xl overflow-hidden bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-black bg-stone-100 font-serif font-bold text-stone-950">
                <th className="p-3.5">Waktu</th>
                <th className="p-3.5">Akun Operator</th>
                <th className="p-3.5">Aksi</th>
                <th className="p-3.5">Entitas / Modul</th>
                <th className="p-3.5">Detail Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-400 font-serif">
                    Tidak ada aktivitas yang cocok dengan filter ini.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3.5 font-mono text-stone-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="p-3.5 font-serif font-bold text-stone-950">
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                          {log.username.slice(0, 1).toUpperCase()}
                        </div>
                        <span>{log.username}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-medium text-stone-800">
                      {log.entity} {log.entity_id ? `(${log.entity_id})` : ''}
                    </td>
                    <td className="p-3.5 text-stone-600 font-mono text-[11px] max-w-xs truncate">
                      {log.meta ? JSON.stringify(log.meta) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
