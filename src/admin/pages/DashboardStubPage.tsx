import React, { useEffect, useState } from 'react';
import { AdminProfile, AppSettings, AuditLog } from '../../types/admin';
import { AdminService } from '../../services/adminService';
import {
  Users,
  Camera,
  History,
  ShieldCheck,
  ArrowRight,
  Settings,
  Sparkles,
} from 'lucide-react';

interface DashboardStubPageProps {
  currentAdmin: AdminProfile;
  appSettings: AppSettings;
  onNavigate: (path: string) => void;
}

export const DashboardStubPage: React.FC<DashboardStubPageProps> = ({
  currentAdmin,
  appSettings,
  onNavigate,
}) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    AdminService.getAuditLogs(8).then(setLogs);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl border-2 border-black bg-stone-950 text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono tracking-widest text-amber-300 uppercase block mb-1">
            Fase 1 • Fondasi &amp; Pengaturan
          </span>
          <h2 className="font-serif font-bold text-2xl text-white">
            Selamat Datang, {currentAdmin.display_name}
          </h2>
          <p className="text-xs text-stone-300 mt-1 max-w-md">
            Portal manajemen photobooth multi-acara {appSettings.company_name}.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {currentAdmin.role === 'owner' && (
            <button
              onClick={() => onNavigate('/admin/settings/team')}
              className="px-4 py-2 rounded-full border-2 border-white bg-white text-stone-950 text-xs font-serif font-bold shadow hover:bg-stone-100 transition-all cursor-pointer"
            >
              Kelola Team
            </button>
          )}
          <button
            onClick={() => onNavigate('/admin/settings/website')}
            className="px-4 py-2 rounded-full border-2 border-white bg-transparent text-white text-xs font-serif font-bold hover:bg-white/10 transition-all cursor-pointer"
          >
            Website Admin
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-serif font-semibold">Peran Anda</span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-serif font-bold text-xl text-stone-900 capitalize">
            {currentAdmin.role}
          </div>
          <span className="text-[10px] text-stone-500">
            {currentAdmin.role === 'owner' ? 'Akses Penuh' : 'Akses Dibatasi'}
          </span>
        </div>

        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-serif font-semibold">Perusahaan</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="font-serif font-bold text-sm text-stone-900 truncate">
            {appSettings.company_name}
          </div>
          <span className="text-[10px] text-stone-500">Tema Dinamis</span>
        </div>

        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-serif font-semibold">Tamu Photobooth</span>
            <Camera className="w-4 h-4 text-stone-700" />
          </div>
          <div className="font-serif font-bold text-xl text-stone-900">Aktif</div>
          <a
            href="/e/khai-lila"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-amber-700 hover:underline font-semibold block truncate"
          >
            Buka /e/khai-lila ↗
          </a>
        </div>

        <div className="p-4 rounded-xl border-2 border-black bg-white shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-serif font-semibold">Status Sistem</span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="font-serif font-bold text-xl text-stone-900">Online</div>
          <span className="text-[10px] text-stone-500">Fase 1 Siap</span>
        </div>
      </div>

      {/* Audit Log Feed (Fase 1 Audit Log Dasar) */}
      <div className="p-6 rounded-2xl border-2 border-black bg-white shadow-sm">
        <div className="flex items-center justify-between border-b pb-3 border-stone-200 mb-4">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-stone-700" />
            <h3 className="font-serif font-bold text-base text-stone-900">
              Riwayat Aktivitas (Audit Log Dasar)
            </h3>
          </div>
          <span className="text-[11px] text-stone-400 font-mono">Real-time</span>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-stone-400 py-4 text-center">
            Belum ada aktivitas tercatat.
          </p>
        ) : (
          <div className="divide-y divide-stone-100">
            {logs.map((log) => (
              <div
                key={log.id}
                className="py-2.5 flex items-center justify-between text-xs hover:bg-stone-50/60 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-stone-100 border border-stone-300 text-stone-800 uppercase font-semibold">
                    {log.action}
                  </span>
                  <span className="font-serif font-semibold text-stone-900">
                    @{log.username}
                  </span>
                  <span className="text-stone-500">pada</span>
                  <span className="font-mono text-stone-700">{log.entity}</span>
                </div>
                <span className="text-[10px] text-stone-400 font-mono">
                  {new Date(log.created_at).toLocaleTimeString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
