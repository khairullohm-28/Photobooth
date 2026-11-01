import React, { useState, useEffect } from 'react';
import { AppSettings, UIColors } from '../../types/admin';
import { AdminService, DEFAULT_APP_SETTINGS } from '../../services/adminService';
import { useToast } from '../components/Toast';
import { Upload, RotateCcw, Check, Palette, Sparkles, Image as ImageIcon } from 'lucide-react';

interface WebsiteAdminPageProps {
  initialSettings: AppSettings;
  onSettingsUpdated: (settings: AppSettings) => void;
}

export const WebsiteAdminPage: React.FC<WebsiteAdminPageProps> = ({
  initialSettings,
  onSettingsUpdated,
}) => {
  const { showToast } = useToast();
  const [companyName, setCompanyName] = useState(initialSettings.company_name);
  const [publicBaseUrl, setPublicBaseUrl] = useState(initialSettings.public_base_url || '');
  const [logoUrl, setLogoUrl] = useState<string | null>(initialSettings.logo_url);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(initialSettings.favicon_url);
  const [uiColors, setUiColors] = useState<UIColors>(initialSettings.ui_colors);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCompanyName(initialSettings.company_name);
    setPublicBaseUrl(initialSettings.public_base_url || '');
    setLogoUrl(initialSettings.logo_url);
    setFaviconUrl(initialSettings.favicon_url);
    setUiColors(initialSettings.ui_colors);
  }, [initialSettings]);

  const handleColorChange = (key: keyof UIColors, value: string) => {
    setUiColors((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Ukuran logo maksimal 2MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoUrl(event.target?.result as string);
        showToast('Logo berhasil dimuat');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetDefaults = () => {
    setCompanyName(DEFAULT_APP_SETTINGS.company_name);
    setPublicBaseUrl('');
    setUiColors(DEFAULT_APP_SETTINGS.ui_colors);
    setLogoUrl(null);
    setFaviconUrl(null);
    showToast('Pengaturan dikembalikan ke bawaan');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      showToast('Nama perusahaan tidak boleh kosong', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const updated: AppSettings = {
        company_name: companyName.trim(),
        public_base_url: publicBaseUrl.trim(),
        logo_url: logoUrl,
        favicon_url: faviconUrl,
        ui_colors: uiColors,
        font: 'Libre Baskerville',
      };

      const result = await AdminService.updateSettings(updated);
      onSettingsUpdated(result);
      showToast('Pengaturan website berhasil disimpan!');
    } catch {
      showToast('Gagal menyimpan pengaturan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Title */}
      <div>
        <h2 className="font-serif font-bold text-2xl text-stone-950 tracking-tight">
          Website Admin
        </h2>
        <p className="text-xs text-stone-500 mt-1">
          Atur identitas merek, logo, dan palet warna antarmuka portal admin
        </p>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Form fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Brand Identity Card */}
          <div className="p-6 rounded-2xl border-2 border-black bg-white shadow-sm space-y-5">
            <h3 className="font-serif font-bold text-base text-stone-900 border-b pb-3 border-stone-200">
              Identitas Perusahaan
            </h3>

            <div>
              <label className="block text-xs font-serif font-semibold text-stone-800 mb-1.5">
                Nama Perusahaan
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Nama Perusahaan Photobooth"
                className="w-full px-4 py-2.5 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-sm focus:outline-none focus:bg-white"
                required
              />
            </div>

            {/* Public Website URL */}
            <div>
              <label className="block text-xs font-serif font-semibold text-stone-800 mb-1.5">
                URL Publik Website (Domain Tamu)
              </label>
              <input
                type="url"
                value={publicBaseUrl}
                onChange={(e) => setPublicBaseUrl(e.target.value)}
                placeholder="https://photobooth.domainku.com"
                className="w-full px-4 py-2.5 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-sm focus:outline-none focus:bg-white font-mono text-xs"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Domain dasar untuk membuat QR code, link tamu, dan poster cetak (contoh: <code className="bg-stone-100 px-1 py-0.5 rounded border border-stone-200">https://photobooth.domainku.com</code>). QR code tamu wajib memakai domain ini.
              </p>
            </div>

            {/* Logo Upload */}
            <div>
              <label className="block text-xs font-serif font-semibold text-stone-800 mb-1.5">
                Logo Perusahaan
              </label>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-xl border-2 border-black bg-stone-100 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-stone-400" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full border-2 border-black bg-white hover:bg-stone-50 text-xs font-serif font-bold cursor-pointer transition-colors shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Logo Baru</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-stone-500 mt-1.5">
                    PNG/WebP transparan, ukuran persegi (rekomendasi min 200x200 px).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Color Palette Theme Card */}
          <div className="p-6 rounded-2xl border-2 border-black bg-white shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-stone-200">
              <h3 className="font-serif font-bold text-base text-stone-900 flex items-center space-x-2">
                <Palette className="w-4 h-4 text-stone-700" />
                <span>Palet Warna Antarmuka (UI Colors)</span>
              </h3>
              <span className="text-[11px] font-mono text-stone-500">Live Preview</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Primary Color */}
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Warna Utama (Primary)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={uiColors.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                    className="w-10 h-10 rounded-xl border-2 border-black cursor-pointer p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={uiColors.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border-2 border-black text-xs font-mono bg-stone-50"
                  />
                </div>
              </div>

              {/* Sidebar Background */}
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Latar Sidebar
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={uiColors.sidebar_bg}
                    onChange={(e) => handleColorChange('sidebar_bg', e.target.value)}
                    className="w-10 h-10 rounded-xl border-2 border-black cursor-pointer p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={uiColors.sidebar_bg}
                    onChange={(e) => handleColorChange('sidebar_bg', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border-2 border-black text-xs font-mono bg-stone-50"
                  />
                </div>
              </div>

              {/* Accent Color */}
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Warna Aksen (Gold/Highlight)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={uiColors.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="w-10 h-10 rounded-xl border-2 border-black cursor-pointer p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={uiColors.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border-2 border-black text-xs font-mono bg-stone-50"
                  />
                </div>
              </div>

              {/* Text Color */}
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Warna Teks
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={uiColors.text}
                    onChange={(e) => handleColorChange('text', e.target.value)}
                    className="w-10 h-10 rounded-xl border-2 border-black cursor-pointer p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={uiColors.text}
                    onChange={(e) => handleColorChange('text', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border-2 border-black text-xs font-mono bg-stone-50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Zona Pengembangan (Khusus Owner) */}
          {AdminService.getCurrentAdmin()?.role === 'owner' && (
            <div className="p-6 rounded-2xl border-2 border-black bg-white shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-stone-200">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <h3 className="font-serif font-bold text-base text-stone-900">
                    Zona Pengembangan (Development Mode)
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-mono text-[10px] font-bold uppercase">
                  Khusus Owner
                </span>
              </div>

              <p className="text-xs text-stone-600 font-sans leading-relaxed">
                Fitur ini membuat 1 acara demo lengkap dengan 30 sesi foto contoh, thumbnail frame, dan riwayat cetak print_jobs (semuanya ditandai <code className="bg-stone-100 px-1 py-0.5 rounded font-mono font-bold">is_demo: true</code>) agar modul Booking dan Dashboard dapat diuji coba tanpa tamu fisik.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { DemoDataService } = await import('../../services/demoDataService');
                      const res = await DemoDataService.generateDemoData();
                      if (res.success) {
                        showToast(`Berhasil mengisi ${res.sessionCount} data contoh sesi demo`, 'success');
                      }
                    } catch {
                      showToast('Gagal mengisi data contoh', 'error');
                    }
                  }}
                  className="px-4 py-2 rounded-full border-2 border-black bg-stone-900 text-white hover:bg-stone-800 text-xs font-serif font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
                >
                  Isi Data Contoh (30 Sesi)
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { DemoDataService } = await import('../../services/demoDataService');
                      const res = await DemoDataService.purgeDemoData();
                      showToast(`Berhasil membersihkan data contoh demo`, 'success');
                    } catch {
                      showToast('Gagal membersihkan data contoh', 'error');
                    }
                  }}
                  className="px-4 py-2 rounded-full border-2 border-rose-300 hover:border-rose-600 text-rose-700 hover:bg-rose-50 text-xs font-serif font-bold transition-colors cursor-pointer"
                >
                  Hapus Data Contoh
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-4 py-2.5 rounded-full border-2 border-stone-300 hover:border-black text-xs font-serif font-bold text-stone-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset ke Default</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-full border-2 border-black bg-stone-950 text-white hover:bg-stone-800 text-xs font-serif font-bold tracking-wider flex items-center space-x-2 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-amber-300" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </div>

        {/* Right 1 Col: Live UI Preview Mockup Card */}
        <div className="space-y-4">
          <div className="sticky top-24">
            <span className="block text-xs font-serif font-bold uppercase tracking-wider text-stone-500 mb-2">
              Pratinjau Langsung Sidebar
            </span>

            {/* Mock Mini Sidebar */}
            <div
              className="rounded-2xl border-2 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 transition-colors"
              style={{ backgroundColor: uiColors.sidebar_bg, color: uiColors.text }}
            >
              <div className="flex items-center space-x-2.5 border-b pb-3 border-stone-300/60">
                <div
                  className="w-8 h-8 rounded-lg border border-black flex items-center justify-center font-serif font-bold text-xs"
                  style={{ backgroundColor: uiColors.primary, color: '#ffffff' }}
                >
                  {companyName.slice(0, 1)}
                </div>
                <div className="overflow-hidden">
                  <span className="block text-xs font-serif font-bold truncate leading-tight">
                    {companyName}
                  </span>
                  <span className="text-[9px] font-mono opacity-70">Admin Preview</span>
                </div>
              </div>

              {/* Fake Menu list */}
              <div className="space-y-1.5 text-xs font-serif">
                <div
                  className="px-3 py-1.5 rounded-lg font-bold flex items-center justify-between shadow-xs"
                  style={{ backgroundColor: uiColors.primary, color: '#ffffff' }}
                >
                  <span>Dashboard</span>
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: uiColors.accent }}
                  />
                </div>
                <div className="px-3 py-1.5 rounded-lg opacity-80 hover:opacity-100 flex items-center justify-between">
                  <span>Studio Foto</span>
                  <span className="text-[10px]">›</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg opacity-80 hover:opacity-100 flex items-center justify-between">
                  <span>User (Acara)</span>
                </div>
              </div>

              {/* Sample Pill Button in Preview */}
              <div className="pt-2 border-t border-stone-300/60">
                <button
                  type="button"
                  className="w-full py-1.5 px-3 rounded-full border-2 border-black bg-white text-[11px] font-bold shadow-xs"
                >
                  Pill Button Sample
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
