import React, { useState } from 'react';
import { Fingerprint, LogIn, Cloud, RefreshCw } from 'lucide-react';
import { Role, UserRole } from '../types';
import { isFirebaseEnabled, googleSignIn } from '../utils/firebaseAuth';

interface LoginOverlayProps {
  onLogin: (role: Role) => void;
  users?: UserRole[];
}

export const LoginOverlay: React.FC<LoginOverlayProps> = ({ onLogin, users = [] }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Hardcode fallback just in case users array is totally empty
    if (email === 'admin@decorasiku.com' && password === 'admin' && users.length === 0) {
      onLogin('super_admin');
      return;
    }

    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      onLogin(user.role);
    } else {
      setError('Email atau password salah');
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isFirebaseEnabled) return;
    setGoogleLoading(true);
    setError('');
    try {
      const result = await googleSignIn();
      if (result) {
        onLogin('super_admin');
      }
    } catch (e: any) {
      setError(`Otorisasi Google gagal: ${e.message}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#090d16]/90 backdrop-blur-md p-4">
      <div className="bg-[#111827] border border-slate-800 p-8 rounded-3xl w-full max-w-sm shadow-2xl">
        <h2 className="text-2xl text-white mb-6 text-center tracking-tight font-bold text-slate-800 font-sans tracking-tight capitalize">Masuk ke Sistem</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Email / Username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white text-sm focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white text-sm focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
              required
            />
          </div>
          
          {error && <p className="text-red-500 text-xs font-semibold text-center">{error}</p>}
          
          <button
            type="submit"
            className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
          >
            <LogIn className="w-5 h-5" />
            Masuk dengan Sandi
          </button>
        </form>

        {isFirebaseEnabled && (
          <div className="mt-5 pt-5 border-t border-slate-800 space-y-3">
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#111827] px-2 text-slate-500 font-mono text-[10px]">Atau Sinkron Otomatis</span>
            </div>
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2.5 p-3.5  font-bold text-slate-900 bg-white hover:bg-slate-100 active:bg-slate-200 transition-all duration-200 cursor-pointer  disabled:opacity-50 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100"
            >
              {googleLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Cloud className="w-5 h-5 text-indigo-600" />
              )}
              Masuk dengan Google (Cloud Sync)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

