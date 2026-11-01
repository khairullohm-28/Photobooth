import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Loader2, User } from 'lucide-react';
import { AdminService } from '../../services/adminService';
import { AdminProfile } from '../../types/admin';

interface FirstSetupPageProps {
  onSetupSuccess: (owner: AdminProfile) => void;
  onBackToLogin: () => void;
}

export const FirstSetupPage: React.FC<FirstSetupPageProps> = ({
  onSetupSuccess,
  onBackToLogin,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !username.trim() || !password) {
      setErrorMessage('Semua field wajib diisi');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password minimal 6 karakter');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi password tidak cocok');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await AdminService.createProfile({
        username,
        display_name: displayName,
        role: 'owner',
        permissions: ['*'],
        allowed_event_ids: null,
        is_active: true,
        password,
      });

      if (res.success && res.profile) {
        // Automatically log in as owner
        const loginRes = await AdminService.login(username, password);
        if (loginRes.success && loginRes.user) {
          onSetupSuccess(loginRes.user);
        } else {
          onBackToLogin();
        }
      } else {
        setErrorMessage(res.error || 'Gagal membuat akun owner');
      }
    } catch {
      setErrorMessage('Terjadi kendala saat setup akun');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 selection:bg-black selection:text-white font-sans">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border-2 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-left">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-amber-500 border-2 border-black flex items-center justify-center text-black shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-xl text-stone-950">
                Setup Akun Owner
              </h1>
              <p className="text-xs text-stone-500">
                Inisialisasi administrator pertama photobooth
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 mb-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-800 text-xs">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Contoh: Khairul Owner"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-sm focus:outline-none focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                Username Owner
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="owner"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-sm focus:outline-none focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-sm focus:outline-none focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-serif font-semibold text-stone-800 mb-1">
                Ulangi Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Konfirmasi password"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-black bg-stone-50 text-stone-900 text-sm focus:outline-none focus:bg-white"
                required
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 rounded-full border-2 border-black bg-stone-950 text-white font-serif font-bold text-sm tracking-wider shadow-md hover:bg-stone-800 active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                ) : (
                  <>
                    <span>Buat Akun &amp; Masuk</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={onBackToLogin}
              className="text-xs font-medium text-stone-500 hover:text-stone-900 hover:underline"
            >
              Kembali ke Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
