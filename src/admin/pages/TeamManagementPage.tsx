import React, { useState, useEffect } from 'react';
import {
  AdminProfile,
  ADMIN_PERMISSIONS,
} from '../../types/admin';
import { AdminService } from '../../services/adminService';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SkeletonLoader, EmptyState } from '../components/CommonFeedback';
import {
  UserPlus,
  ShieldCheck,
  UserCheck,
  Check,
  X,
  Edit2,
  Trash2,
  KeyRound,
  ShieldAlert,
  Search,
  Lock,
} from 'lucide-react';

interface TeamManagementPageProps {
  currentAdmin: AdminProfile;
}

export const TeamManagementPage: React.FC<TeamManagementPageProps> = ({
  currentAdmin,
}) => {
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AdminProfile | null>(null);

  const [formDisplayName, setFormDisplayName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'owner' | 'team'>('team');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [formRestrictEvents, setFormRestrictEvents] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<AdminProfile | null>(null);

  const isOwner = currentAdmin.role === 'owner';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await AdminService.getProfiles();
      setProfiles(data);
    } catch {
      showToast('Gagal memuat daftar anggota', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Open modal for add
  const handleOpenAdd = () => {
    setEditingProfile(null);
    setFormDisplayName('');
    setFormUsername('');
    setFormPassword('');
    setFormRole('team');
    setFormIsActive(true);
    // Default team permission: Dashboard & Booking
    setFormPermissions(['dashboard', 'booking.results']);
    setFormRestrictEvents(false);
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (profile: AdminProfile) => {
    setEditingProfile(profile);
    setFormDisplayName(profile.display_name);
    setFormUsername(profile.username);
    setFormPassword(''); // blank unless changing
    setFormRole(profile.role);
    setFormIsActive(profile.is_active);
    setFormPermissions(profile.permissions || []);
    setFormRestrictEvents(!!profile.allowed_event_ids);
    setIsModalOpen(true);
  };

  const handleTogglePermission = (key: string) => {
    setFormPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSelectAllPermissions = () => {
    setFormPermissions(ADMIN_PERMISSIONS.map((p) => p.id));
  };

  const handleDeselectAllPermissions = () => {
    setFormPermissions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDisplayName.trim() || !formUsername.trim()) {
      showToast('Nama dan Username wajib diisi', 'error');
      return;
    }

    if (!editingProfile && (!formPassword || formPassword.length < 4)) {
      showToast('Password minimal 4 karakter', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProfile) {
        // Edit existing
        const res = await AdminService.updateProfile(
          editingProfile.id,
          {
            display_name: formDisplayName.trim(),
            role: formRole,
            is_active: formIsActive,
            permissions: formRole === 'owner' ? ['*'] : formPermissions,
            allowed_event_ids: formRestrictEvents ? ['evt_khai_lila_2026'] : null,
          },
          formPassword || undefined
        );

        if (res.success) {
          showToast(`Akun ${formUsername} berhasil diperbarui`);
          setIsModalOpen(false);
          loadData();
        } else {
          showToast(res.error || 'Gagal memperbarui akun', 'error');
        }
      } else {
        // Create new
        const res = await AdminService.createProfile({
          username: formUsername,
          display_name: formDisplayName,
          role: formRole,
          is_active: formIsActive,
          permissions: formRole === 'owner' ? ['*'] : formPermissions,
          allowed_event_ids: formRestrictEvents ? ['evt_khai_lila_2026'] : null,
          password: formPassword,
        });

        if (res.success) {
          showToast(`Anggota tim ${formUsername} berhasil dibuat!`);
          setIsModalOpen(false);
          loadData();
        } else {
          showToast(res.error || 'Gagal membuat akun', 'error');
        }
      }
    } catch {
      showToast('Terjadi kesalahan saat memproses data', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await AdminService.deleteProfile(deleteTarget.id);
      if (res.success) {
        showToast(`Akun ${deleteTarget.username} berhasil dihapus`);
        loadData();
      } else {
        showToast(res.error || 'Gagal menghapus akun', 'error');
      }
    } catch {
      showToast('Gagal menghapus akun', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  // If not owner, block access
  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 border-2 border-black flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 stroke-[2.2]" />
        </div>
        <h2 className="font-serif font-bold text-xl text-stone-900 mb-2">
          Akses Khusus Owner
        </h2>
        <p className="text-xs text-stone-600 leading-relaxed">
          Menu Manajemen Team hanya dapat diakses oleh akun dengan peran Owner.
          Hubungi Owner untuk pengaturan hak akses tim.
        </p>
      </div>
    );
  }

  const filteredProfiles = profiles.filter(
    (p) =>
      p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-stone-950 tracking-tight">
            Team &amp; Hak Akses
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Kelola anggota tim, peran, dan pembatasan menu operasional
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-5 py-2.5 rounded-full border-2 border-black bg-stone-950 text-white hover:bg-stone-800 text-xs font-serif font-bold tracking-wider flex items-center justify-center space-x-2 shadow-md active:scale-95 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-amber-300" />
          <span>Tambah Anggota</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center space-x-3">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari anggota berdasarkan nama atau username..."
            className="w-full px-3.5 py-2 pl-9 rounded-xl border-2 border-black bg-white text-xs focus:outline-none"
          />
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Table / Cards List */}
      {isLoading ? (
        <SkeletonLoader rows={4} />
      ) : filteredProfiles.length === 0 ? (
        <EmptyState
          title="Tidak Ada Anggota"
          description="Belum ada anggota tim lain yang terdaftar."
          actionText="Tambah Anggota"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border-2 border-black bg-white shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 border-b-2 border-black font-serif uppercase tracking-wider text-stone-700">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Nama</th>
                  <th className="py-3.5 px-4 font-bold">Username</th>
                  <th className="py-3.5 px-4 font-bold">Peran</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold">Terakhir Login</th>
                  <th className="py-3.5 px-4 font-bold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredProfiles.map((item) => {
                  const isCurrent = currentAdmin.id === item.id;
                  const isItemOwner = item.role === 'owner';

                  return (
                    <tr key={item.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-stone-900 flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-full bg-stone-200 border border-black flex items-center justify-center font-bold text-xs text-stone-800">
                          {item.display_name.slice(0, 1).toUpperCase()}
                        </div>
                        <span>{item.display_name}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                            Anda
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-600">
                        {item.username}
                      </td>
                      <td className="py-3 px-4">
                        {isItemOwner ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <ShieldCheck className="w-3 h-3 text-amber-600" />
                            <span>Owner</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-300">
                            <UserCheck className="w-3 h-3 text-stone-500" />
                            <span>Team</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {item.is_active ? (
                          <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Aktif</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-stone-400">
                            <span className="w-2 h-2 rounded-full bg-stone-300" />
                            <span>Nonaktif</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-stone-500 font-mono text-[11px]">
                        {item.last_login_at
                          ? new Date(item.last_login_at).toLocaleString('id-ID', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'Belum pernah'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-lg border border-black hover:bg-stone-100 text-stone-800 transition-colors"
                          title="Edit hak akses"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!isCurrent && (
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="p-1.5 rounded-lg border border-rose-600 hover:bg-rose-50 text-rose-600 transition-colors"
                            title="Hapus anggota"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-stone-200">
            {filteredProfiles.map((item) => (
              <div key={item.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-stone-900">
                    {item.display_name}
                  </div>
                  {item.role === 'owner' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      Owner
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-700 border border-stone-300">
                      Team
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span className="font-mono">{item.username}</span>
                  <span>{item.is_active ? 'Aktif' : 'Nonaktif'}</span>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="px-3 py-1 rounded-full border border-black text-xs font-semibold"
                  >
                    Edit
                  </button>
                  {currentAdmin.id !== item.id && (
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="px-3 py-1 rounded-full border border-rose-600 text-rose-600 text-xs font-semibold"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Form Tambah / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl border-2 border-black max-w-lg w-full p-6 shadow-2xl my-8 text-left animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 mb-4">
              <h3 className="font-serif font-bold text-lg text-stone-950">
                {editingProfile ? 'Edit Anggota Team' : 'Tambah Anggota Team'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-stone-500 hover:text-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Nama */}
                <div>
                  <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    placeholder="Contoh: Budi Operator"
                    className="w-full px-3 py-2 rounded-xl border-2 border-black bg-stone-50 text-xs focus:outline-none focus:bg-white"
                    required
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formUsername}
                    disabled={!!editingProfile}
                    onChange={(e) =>
                      setFormUsername(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                      )
                    }
                    placeholder="operator_budi"
                    className="w-full px-3 py-2 rounded-xl border-2 border-black bg-stone-50 text-xs focus:outline-none focus:bg-white disabled:opacity-60"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                  {editingProfile ? 'Reset Password (kosongkan jika tidak diubah)' : 'Password'}
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingProfile ? '••••••••' : 'Minimal 4 karakter'}
                  className="w-full px-3 py-2 rounded-xl border-2 border-black bg-stone-50 text-xs focus:outline-none focus:bg-white"
                />
              </div>

              {/* Peran & Status */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                    Peran (Role)
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border-2 border-black bg-stone-50 text-xs font-semibold focus:outline-none"
                  >
                    <option value="team">Team (Dibatasi)</option>
                    <option value="owner">Owner (Akses Penuh)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                    Status Akun
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormIsActive(!formIsActive)}
                    className={`w-full py-2 px-3 rounded-xl border-2 border-black text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors ${
                      formIsActive
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {formIsActive ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Aktif</span>
                      </>
                    ) : (
                      <>
                        <X className="w-3.5 h-3.5 text-stone-500" />
                        <span>Nonaktif</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Akses Menu Toggle list (Only for team role) */}
              {formRole === 'team' && (
                <div className="pt-2 border-t border-stone-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-serif font-bold text-stone-900">
                      Hak Akses Menu &amp; Submenu
                    </label>
                    <div className="flex space-x-2 text-[10px]">
                      <button
                        type="button"
                        onClick={handleSelectAllPermissions}
                        className="text-stone-700 underline font-semibold"
                      >
                        Pilih Semua
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllPermissions}
                        className="text-stone-500 hover:text-stone-800"
                      >
                        Kosongkan
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-stone-50 rounded-xl border-2 border-black">
                    {ADMIN_PERMISSIONS.map((perm) => {
                      const isChecked = formPermissions.includes(perm.id);
                      return (
                        <label
                          key={perm.id}
                          className="flex items-center space-x-2 text-xs text-stone-800 cursor-pointer p-1 rounded hover:bg-stone-200/60"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePermission(perm.id)}
                            className="w-4 h-4 rounded border-2 border-black text-stone-950 accent-black"
                          />
                          <span className="leading-tight">{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Restrict to specific event toggle */}
                  <div className="mt-3 p-3 bg-stone-100 rounded-xl border border-stone-300 flex items-center justify-between">
                    <div>
                      <span className="block text-xs font-semibold text-stone-900">
                        Batasi ke Acara Tertentu
                      </span>
                      <span className="text-[10px] text-stone-500">
                        Hanya bisa mengelola acara yang ditugaskan
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formRestrictEvents}
                      onChange={(e) => setFormRestrictEvents(e.target.checked)}
                      className="w-4 h-4 accent-black rounded"
                    />
                  </div>
                </div>
              )}

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-full border-2 border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-full border-2 border-black bg-stone-950 text-white font-serif font-bold text-xs shadow-md hover:bg-stone-800 active:scale-95 transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Hapus Anggota Tim?"
        message={`Apakah kamu yakin ingin menghapus akun ${deleteTarget?.display_name} (@${deleteTarget?.username})? Akses masuk untuk user ini akan dicabut secara permanen.`}
        confirmText="Ya, Hapus"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
