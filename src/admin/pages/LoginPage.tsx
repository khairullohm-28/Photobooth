import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { AppSettings, AdminProfile } from '../../types/admin';
import { AdminService } from '../../services/adminService';

interface LoginPageProps {
  appSettings: AppSettings;
  hasOwner: boolean;
  onLoginSuccess: (user: AdminProfile) => void;
  onGoToSetup: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  appSettings,
  hasOwner,
  onLoginSuccess,
  onGoToSetup,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Masukkan username dan password');
      return;
    }

    if (failedAttempts >= 5) {
      setErrorMessage('Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await AdminService.login(username, password);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setFailedAttempts((prev) => prev + 1);
        setErrorMessage(res.error || 'Username atau password salah');
      }
    } catch {
      setErrorMessage('Terjadi kendala koneksi ke server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 selection:bg-black selection:text-white font-sans">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl border-2 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
          {/* 1. Box Logo */}
          <div className="w-16 h-16 rounded-2xl bg-stone-950 border-2 border-black mx-auto mb-4 flex items-center justify-center text-white shadow-md">
            {appSettings.logo_url ? (
              <img
                src={appSettings.logo_url}
                alt="Logo"
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <span className="font-serif font-bold text-2xl text-amber-300">
                {appSettings.company_name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>

          {/* 2. Company Name */}
          <h2 className="font-serif font-bold text-base text-stone-900 tracking-wide mb-1">
            {appSettings.company_name}
          </h2>
          <span className="text-[11px] font-mono tracking-widest text-stone-500 uppercase block mb-6">
            Portal Administrasi
          </span>

          {/* 3. Title */}
          <h1 className="font-serif font-bold text-2xl text-stone-950 mb-6 tracking-tight">
            Log in
          </h1>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 mb-5 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-800 text-xs text-left animate-in fade-in">
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-serif font-semibold text-stone-800 mb-1.5">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  autoComplete="username"
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-black bg-stone-50 text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-black/10 transition-all"
                  required
                />
                <User className="absolute right-3.5 top-3 w-4 h-4 text-stone-400 pointer-events-none" />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-serif font-semibold text-stone-800 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border-2 border-black bg-stone-50 text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-black/10 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-1 text-stone-500 hover:text-stone-900 transition-colors"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Pill Button in Center */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 rounded-full border-2 border-black bg-stone-950 text-white font-serif font-bold text-sm tracking-wider shadow-md hover:bg-stone-800 active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                ) : (
                  <>
                    <span>Masuk</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Seed accounts hint for first run */}
          <div className="mt-6 pt-4 border-t border-stone-200 text-center">
            <span className="text-[11px] text-stone-500 block mb-1">
              Akun demo bawaan:
            </span>
            <div className="flex items-center justify-center space-x-2 text-[10px] font-mono text-stone-600">
              <span className="bg-stone-100 px-2 py-0.5 rounded border border-stone-300">
                owner / admin123
              </span>
              <span className="bg-stone-100 px-2 py-0.5 rounded border border-stone-300">
                operator / admin123
              </span>
            </div>

            {!hasOwner && (
              <div className="mt-4 pt-3 border-t border-dashed border-stone-200">
                <button
                  onClick={onGoToSetup}
                  className="text-xs font-serif font-bold text-amber-700 hover:underline flex items-center justify-center space-x-1 mx-auto"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Setup Akun Owner Pertama</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
