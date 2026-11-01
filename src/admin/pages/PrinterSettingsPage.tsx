import React, { useState, useEffect } from 'react';
import {
  Printer,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Sliders,
  HelpCircle,
  Copy,
  Info,
  Maximize2,
  ArrowRight,
} from 'lucide-react';
import {
  PrintProfile,
  PrintPreset,
  PrintOrientation,
  PrintFitMode,
} from '../../types/photobooth';
import {
  PrinterService,
  PRESET_DIMENSIONS,
} from '../../services/printerService';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/CommonFeedback';

export const PrinterSettingsPage: React.FC = () => {
  const { showToast } = useToast();

  const [profiles, setProfiles] = useState<PrintProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProfile, setEditingProfile] = useState<PrintProfile | null>(null);

  // Form Fields
  const [name, setName] = useState<string>('');
  const [preset, setPreset] = useState<PrintPreset>('4r');
  const [widthMm, setWidthMm] = useState<number>(102);
  const [heightMm, setHeightMm] = useState<number>(152);
  const [orientation, setOrientation] = useState<PrintOrientation>('portrait');
  const [marginTop, setMarginTop] = useState<number>(0);
  const [marginRight, setMarginRight] = useState<number>(0);
  const [marginBottom, setMarginBottom] = useState<number>(0);
  const [marginLeft, setMarginLeft] = useState<number>(0);
  const [fitMode, setFitMode] = useState<PrintFitMode>('fill');
  const [isDefault, setIsDefault] = useState<boolean>(false);

  // Delete Confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isPrintingTest, setIsPrintingTest] = useState<string | null>(null);

  const loadProfiles = async () => {
    setIsLoading(true);
    try {
      const data = await PrinterService.getProfiles();
      setProfiles(data);
    } catch {
      showToast('Gagal memuat profil printer', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleOpenNewModal = () => {
    setEditingProfile(null);
    setName('Printer Baru 4R');
    setPreset('4r');
    setWidthMm(102);
    setHeightMm(152);
    setOrientation('portrait');
    setMarginTop(0);
    setMarginRight(0);
    setMarginBottom(0);
    setMarginLeft(0);
    setFitMode('fill');
    setIsDefault(profiles.length === 0);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: PrintProfile) => {
    setEditingProfile(p);
    setName(p.name);
    setPreset(p.paper_preset);
    setWidthMm(p.paper_width_mm);
    setHeightMm(p.paper_height_mm);
    setOrientation(p.orientation);
    setMarginTop(p.margin_top_mm);
    setMarginRight(p.margin_right_mm);
    setMarginBottom(p.margin_bottom_mm);
    setMarginLeft(p.margin_left_mm);
    setFitMode(p.fit_mode);
    setIsDefault(p.is_default);
    setIsModalOpen(true);
  };

  const handlePresetChange = (newPreset: PrintPreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      const dims = PRESET_DIMENSIONS[newPreset];
      setWidthMm(dims.width_mm);
      setHeightMm(dims.height_mm);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Nama profil printer wajib diisi', 'error');
      return;
    }

    try {
      await PrinterService.saveProfile({
        id: editingProfile?.id,
        name: name.trim(),
        paper_preset: preset,
        paper_width_mm: Number(widthMm),
        paper_height_mm: Number(heightMm),
        orientation,
        margin_top_mm: Number(marginTop),
        margin_right_mm: Number(marginRight),
        margin_bottom_mm: Number(marginBottom),
        margin_left_mm: Number(marginLeft),
        fit_mode: fitMode,
        is_default: isDefault,
      });

      showToast(
        editingProfile
          ? 'Profil printer berhasil diperbarui'
          : 'Profil printer baru berhasil disimpan',
        'success'
      );
      setIsModalOpen(false);
      loadProfiles();
    } catch {
      showToast('Gagal menyimpan profil printer', 'error');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await PrinterService.setDefaultProfile(id);
      showToast('Profil default berhasil diubah', 'success');
      loadProfiles();
    } catch {
      showToast('Gagal mengubah profil default', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await PrinterService.deleteProfile(deleteId);
    if (res.success) {
      showToast('Profil printer dihapus', 'success');
      setDeleteId(null);
      loadProfiles();
    } else {
      showToast(res.error || 'Gagal menghapus profil', 'error');
    }
  };

  const handleTestPrint = async (p: PrintProfile) => {
    setIsPrintingTest(p.id);
    showToast(`Mencetak lembar kalibrasi untuk ${p.name}...`, 'info');
    try {
      const ok = await PrinterService.printCalibrationTestPage(p);
      if (ok) {
        showToast('Lembar kalibrasi berhasil dikirim ke printer', 'success');
      }
    } catch {
      showToast('Gagal mencetak lembar tes kalibrasi', 'error');
    } finally {
      setIsPrintingTest(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5 border-stone-200">
        <div>
          <h1 className="font-serif font-bold text-2xl text-stone-900 tracking-tight">
            Setting Printer &amp; Ukuran Kertas
          </h1>
          <p className="text-xs text-stone-500 mt-1 font-sans">
            Konfigurasi profil cetak otomatis, preset kertas foto (4R, 5R, Strip 2x6), kalibrasi margin, dan cetak tes.
          </p>
        </div>

        <button
          onClick={handleOpenNewModal}
          className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-full border-2 border-black bg-stone-900 text-white hover:bg-stone-800 text-xs font-serif font-bold tracking-wider transition-transform active:scale-95 shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4 text-amber-300" />
          <span>Tambah Profil Printer</span>
        </button>
      </div>

      {/* Teks Bantuan Wajib */}
      <div className="p-4 rounded-2xl border-2 border-black bg-amber-50/70 shadow-sm flex items-start space-x-3.5">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-stone-800 font-sans space-y-1">
          <p className="font-bold text-amber-950 font-serif">
            Petunjuk Cetak Cepat &amp; Kiosk Mode:
          </p>
          <p className="leading-relaxed">
            Browser tidak bisa memilih printer otomatis. Pilih printer di dialog cetak, atau jadikan printer default PC operator dan jalankan Chrome dengan <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold text-stone-900 border border-amber-300">--kiosk-printing</code> agar cetak langsung tanpa dialog.
          </p>
        </div>
      </div>

      {/* Profiles Cards / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between bg-white shadow-sm hover:shadow-md ${
              profile.is_default
                ? 'border-black ring-2 ring-amber-400/50'
                : 'border-stone-200 hover:border-black'
            }`}
          >
            <div className="space-y-3">
              {/* Card Header & Default Badge */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-serif font-bold text-sm text-stone-900 leading-snug">
                    {profile.name}
                  </h3>
                  <span className="inline-block mt-1 font-mono text-[10px] text-stone-500 uppercase">
                    {profile.paper_preset} • {profile.orientation}
                  </span>
                </div>
                {profile.is_default && (
                  <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-mono text-[10px] font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-amber-600" />
                    <span>Default</span>
                  </span>
                )}
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-stone-50 p-3 rounded-xl border border-stone-200">
                <div>
                  <span className="block text-stone-400 font-mono text-[9px] uppercase">
                    Ukuran Kertas
                  </span>
                  <span className="font-mono font-semibold text-stone-800">
                    {profile.paper_width_mm} x {profile.paper_height_mm} mm
                  </span>
                </div>
                <div>
                  <span className="block text-stone-400 font-mono text-[9px] uppercase">
                    Mode Fit
                  </span>
                  <span className="font-mono font-semibold text-stone-800 capitalize">
                    {profile.fit_mode}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="block text-stone-400 font-mono text-[9px] uppercase">
                    Margin (T / R / B / L)
                  </span>
                  <span className="font-mono font-semibold text-stone-800">
                    {profile.margin_top_mm}mm / {profile.margin_right_mm}mm / {profile.margin_bottom_mm}mm / {profile.margin_left_mm}mm
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-stone-100 mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleTestPrint(profile)}
                disabled={isPrintingTest === profile.id}
                className="px-3 py-1.5 rounded-full border-2 border-stone-300 hover:border-black text-[11px] font-serif font-bold text-stone-800 transition-colors flex items-center space-x-1 cursor-pointer active:scale-95"
                title="Cetak lembar kalibrasi batas kertas"
              >
                <Printer className="w-3 h-3 text-stone-600" />
                <span>{isPrintingTest === profile.id ? 'Mencetak...' : 'Cetak Tes'}</span>
              </button>

              <div className="flex items-center space-x-1">
                {!profile.is_default && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(profile.id)}
                    className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 text-xs transition-colors cursor-pointer"
                    title="Jadikan profil default"
                  >
                    Set Default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(profile)}
                  className="p-2 rounded-xl text-stone-600 hover:text-stone-950 hover:bg-stone-100 transition-colors cursor-pointer"
                  title="Edit profil"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {profiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setDeleteId(profile.id)}
                    className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Hapus profil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal Tambah / Edit Profil */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl border-2 border-black max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b pb-3 border-stone-200">
              <h2 className="font-serif font-bold text-lg text-stone-900">
                {editingProfile ? 'Edit Profil Printer' : 'Tambah Profil Printer Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-800 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Nama Printer / Profil */}
              <div>
                <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                  Nama Printer / Profil *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: DNP DS620 - 4R Kios"
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-xs focus:outline-none focus:bg-white"
                  required
                />
              </div>

              {/* Preset Kertas & Orientasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                    Preset Kertas
                  </label>
                  <select
                    value={preset}
                    onChange={(e) => handlePresetChange(e.target.value as PrintPreset)}
                    className="w-full px-3.5 py-2 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-xs focus:outline-none focus:bg-white cursor-pointer"
                  >
                    <option value="4r">4R (102 x 152 mm / 4x6 inci)</option>
                    <option value="strip_2x6">Strip 2x6 (51 x 152 mm)</option>
                    <option value="5r">5R (127 x 178 mm)</option>
                    <option value="a6">A6 (105 x 148 mm)</option>
                    <option value="a5">A5 (148 x 210 mm)</option>
                    <option value="a4">A4 (210 x 297 mm)</option>
                    <option value="custom">Kustom (Atur Lebar &amp; Tinggi)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                    Orientasi Kertas
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl border-2 border-black bg-stone-50">
                    <button
                      type="button"
                      onClick={() => setOrientation('portrait')}
                      className={`py-1 rounded-lg text-xs font-serif font-bold transition-colors cursor-pointer ${
                        orientation === 'portrait'
                          ? 'bg-stone-950 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Portrait
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrientation('landscape')}
                      className={`py-1 rounded-lg text-xs font-serif font-bold transition-colors cursor-pointer ${
                        orientation === 'landscape'
                          ? 'bg-stone-950 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Landscape
                    </button>
                  </div>
                </div>
              </div>

              {/* Dimensi mm (Lebar & Tinggi) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                    Lebar Kertas (mm)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="1000"
                    value={widthMm}
                    onChange={(e) => setWidthMm(Number(e.target.value))}
                    disabled={preset !== 'custom'}
                    className={`w-full px-3.5 py-2 rounded-xl border-2 border-black text-xs font-mono focus:outline-none ${
                      preset === 'custom' ? 'bg-white' : 'bg-stone-100 text-stone-600 cursor-not-allowed'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                    Tinggi Kertas (mm)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="1000"
                    value={heightMm}
                    onChange={(e) => setHeightMm(Number(e.target.value))}
                    disabled={preset !== 'custom'}
                    className={`w-full px-3.5 py-2 rounded-xl border-2 border-black text-xs font-mono focus:outline-none ${
                      preset === 'custom' ? 'bg-white' : 'bg-stone-100 text-stone-600 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>

              {/* Margins mm */}
              <div>
                <label className="block text-xs font-serif font-semibold text-stone-800 mb-1.5">
                  Margin Tepi Kertas (mm)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="block text-[10px] text-stone-500 font-mono mb-0.5">Atas</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={marginTop}
                      onChange={(e) => setMarginTop(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl border-2 border-black bg-stone-50 text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-stone-500 font-mono mb-0.5">Kanan</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={marginRight}
                      onChange={(e) => setMarginRight(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl border-2 border-black bg-stone-50 text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-stone-500 font-mono mb-0.5">Bawah</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={marginBottom}
                      onChange={(e) => setMarginBottom(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl border-2 border-black bg-stone-50 text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-stone-500 font-mono mb-0.5">Kiri</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={marginLeft}
                      onChange={(e) => setMarginLeft(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-xl border-2 border-black bg-stone-50 text-xs font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Fit Mode */}
              <div>
                <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                  Mode Skala (Fit Mode)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className={`p-2 rounded-xl border-2 text-center cursor-pointer transition-colors ${
                    fitMode === 'fill' ? 'border-black bg-stone-100 font-bold' : 'border-stone-200 bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="fit_mode"
                      value="fill"
                      checked={fitMode === 'fill'}
                      onChange={() => setFitMode('fill')}
                      className="hidden"
                    />
                    <span className="block text-xs font-serif">Fill (Penuhi)</span>
                    <span className="block text-[9px] text-stone-500 font-sans">Kertas penuh, pinggir terpotong</span>
                  </label>

                  <label className={`p-2 rounded-xl border-2 text-center cursor-pointer transition-colors ${
                    fitMode === 'fit' ? 'border-black bg-stone-100 font-bold' : 'border-stone-200 bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="fit_mode"
                      value="fit"
                      checked={fitMode === 'fit'}
                      onChange={() => setFitMode('fit')}
                      className="hidden"
                    />
                    <span className="block text-xs font-serif">Fit (Utuh)</span>
                    <span className="block text-[9px] text-stone-500 font-sans">Foto utuh, sisa garis putih</span>
                  </label>

                  <label className={`p-2 rounded-xl border-2 text-center cursor-pointer transition-colors ${
                    fitMode === 'actual' ? 'border-black bg-stone-100 font-bold' : 'border-stone-200 bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="fit_mode"
                      value="actual"
                      checked={fitMode === 'actual'}
                      onChange={() => setFitMode('actual')}
                      className="hidden"
                    />
                    <span className="block text-xs font-serif">Actual (100%)</span>
                    <span className="block text-[9px] text-stone-500 font-sans">Ukuran piksel asli dokumen</span>
                  </label>
                </div>
              </div>

              {/* Jadikan Default Checkbox */}
              <div className="pt-1">
                <label className="inline-flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded border-2 border-black accent-stone-900 cursor-pointer"
                  />
                  <span className="text-xs font-serif font-semibold text-stone-800">
                    Jadikan sebagai profil printer default
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-stone-300 hover:border-black text-xs font-serif font-bold text-stone-600 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full border-2 border-black bg-stone-950 text-white hover:bg-stone-800 text-xs font-serif font-bold tracking-wider transition-transform active:scale-95 shadow-md cursor-pointer"
                >
                  Simpan Profil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteId}
        title="Hapus Profil Printer"
        message="Apakah Anda yakin ingin menghapus profil printer ini? Profil yang sudah dihapus tidak dapat dipulihkan."
        confirmLabel="Hapus Profil"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};
