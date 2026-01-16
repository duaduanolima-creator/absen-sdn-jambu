import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, Briefcase, GraduationCap, AlertTriangle } from 'lucide-react';
import { Input } from '../components/Input';
import { loginUser } from '../services/mockBackend';
import { User as UserType, UserRole } from '../types';

interface LoginViewProps {
  onLogin: (user: UserType, mode: UserRole) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [activeRole, setActiveRole] = useState<UserRole>('teacher');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Pass the activeRole to validation to ensure correct login type
      const user = await loginUser(username, password, activeRole);
      if (user) {
        // We pass activeRole as the 'mode'. 
        // If Principal logs in on 'teacher' tab, mode is 'teacher' (so they get teacher dashboard).
        onLogin(user, activeRole);
      } else {
        // Generic failure (wrong password/username) if no error was thrown
        setError(
            activeRole === 'teacher' 
            ? 'Username/Password Guru salah atau akun tidak ditemukan.' 
            : 'Username/Password Kepala Sekolah salah.'
        );
      }
    } catch (err: any) {
      // Handle specific errors like Device Lock
      setError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  const isTeacher = activeRole === 'teacher';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-dark relative">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 z-10">
        
        {/* Header Logo */}
        <div className="flex flex-col items-center gap-3">
          <img 
            src="https://iili.io/fSrP6iB.png" 
            alt="Logo SDN JAMBU" 
            className="w-32 h-32 object-contain drop-shadow-2xl animate-in fade-in zoom-in duration-700"
          />
          <div className="text-center flex flex-col items-center">
            <p className="text-slate-400 font-medium mb-1">Aplikasi Berbasis E-Lokasi Real Time</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">SDN JAMBU</h1>
          </div>
        </div>

        {/* Role Switcher Tabs */}
        <div className="w-full bg-slate-800 p-1.5 rounded-xl flex gap-1 shadow-inner border border-slate-700">
            <button
                type="button"
                onClick={() => { setActiveRole('teacher'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    isTeacher 
                    ? 'bg-slate-700 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
            >
                <GraduationCap size={18} /> Guru
            </button>
            <button
                type="button"
                onClick={() => { setActiveRole('principal'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    !isTeacher 
                    ? 'bg-slate-700 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
            >
                <Briefcase size={18} /> Kepala Sekolah
            </button>
        </div>

        {/* Form Container */}
        <div className="w-full bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="relative">
                <Input 
                    label="Username" 
                    placeholder={isTeacher ? "Username Guru" : "Username Kepsek"}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                />
                <User size={18} className="absolute left-3 top-[2.4rem] text-slate-500" />
            </div>
            
            <div className="relative">
                <Input 
                label="Password" 
                type={showPassword ? "text" : "password"}
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                />
                <Lock size={18} className="absolute left-3 top-[2.4rem] text-slate-500" />
                <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[2.4rem] text-slate-500 hover:text-slate-300 focus:outline-none transition-colors"
                >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>

            {error && (
                <div className="flex items-start gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            <button 
                type="submit" 
                disabled={loading}
                className={`w-full text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2 ${
                    isTeacher 
                    ? 'bg-primary hover:bg-emerald-600 shadow-emerald-500/20' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                }`}
            >
                {loading ? 'Memuat...' : (isTeacher ? 'Masuk Dashboard Guru' : 'Masuk Dashboard Kepsek')}
            </button>
            </form>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-slate-600 text-[10px] font-medium tracking-widest uppercase">
        @2026 ABSEN DIGITAL SDN JAMBU
      </div>
    </div>
  );
};