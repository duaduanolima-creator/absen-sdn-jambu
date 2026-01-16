import React, { useState } from 'react';
import { User } from '../types';
import { LogOut, User as UserIcon, Briefcase, Building, BadgeCheck } from 'lucide-react';
import { Modal } from '../components/Modal';

interface ProfileViewProps {
  user: User;
  onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onLogout }) => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Generate avatar initials
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    onLogout();
  };

  return (
    <div className="min-h-screen bg-dark pb-20">
      {/* Header */}
      <div className="bg-card border-b border-slate-800 p-4 sticky top-0 z-20 shadow-lg shadow-black/20">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <img src="https://iili.io/fSrP6iB.png" alt="Logo SDN JAMBU" className="w-10 h-10 object-contain drop-shadow-md" />
            <div>
              <h1 className="font-bold text-white leading-tight">SDN JAMBU</h1>
              <p className="text-[10px] text-slate-400 font-medium">Profil Pengguna</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 flex flex-col gap-8">
        
        {/* Profile Card */}
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="relative group">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border-4 border-slate-700 shadow-xl flex items-center justify-center overflow-hidden">
              {user.avatar ? (
                <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-slate-300 tracking-widest">{initials}</span>
              )}
            </div>
            
            {/* Removed Upload Button Overlay */}
          </div>
          
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">{user.name}</h2>
            <p className="text-slate-400 font-mono mt-1">{user.nip || 'NIP Tidak Tersedia'}</p>
          </div>
        </div>

        {/* Info List */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-700/50 bg-slate-800/80">
            <h3 className="font-semibold text-slate-300 flex items-center gap-2">
              <UserIcon size={18} className="text-primary" /> Informasi Pribadi
            </h3>
          </div>
          
          <div className="divide-y divide-slate-700/50">
            <div className="p-4 flex items-center gap-4">
              <div className="p-2 bg-slate-700/50 rounded-lg text-emerald-400">
                <BadgeCheck size={20} />
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase font-medium">Status Pegawai</div>
                <div className="text-white font-medium">{user.employmentStatus || '-'}</div>
              </div>
            </div>

            <div className="p-4 flex items-center gap-4">
              <div className="p-2 bg-slate-700/50 rounded-lg text-blue-400">
                <Briefcase size={20} />
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase font-medium">Jabatan</div>
                <div className="text-white font-medium">{user.position || '-'}</div>
              </div>
            </div>

            <div className="p-4 flex items-center gap-4">
              <div className="p-2 bg-slate-700/50 rounded-lg text-amber-400">
                <Building size={20} />
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase font-medium">Unit Kerja</div>
                <div className="text-white font-medium">{user.workUnit || 'SDN JAMBU'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button 
          onClick={() => setShowLogoutModal(true)}
          className="w-full py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-red-400 font-semibold hover:bg-red-500/10 hover:border-red-500/30 transition-all flex items-center justify-center gap-2 mt-4"
        >
          <LogOut size={20} />
          Keluar Aplikasi
        </button>

        {/* Logout Confirmation Modal */}
        <Modal 
          isOpen={showLogoutModal} 
          onClose={() => setShowLogoutModal(false)}
          title="Konfirmasi Keluar"
        >
           <div className="flex flex-col items-center gap-4 py-2">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-2 animate-in zoom-in duration-300">
                  <LogOut size={40} />
              </div>
              <div className="text-center">
                  <h3 className="text-lg font-bold text-white">Yakin ingin keluar?</h3>
                  <p className="text-slate-400 text-sm mt-1 max-w-[200px] mx-auto">Anda perlu login kembali untuk mengakses akun ini.</p>
              </div>
              <div className="flex gap-3 w-full mt-4">
                  <button 
                      onClick={() => setShowLogoutModal(false)}
                      className="flex-1 py-3.5 bg-slate-800 border border-slate-700 rounded-xl font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                      Batal
                  </button>
                  <button 
                      onClick={handleLogoutConfirm}
                      className="flex-1 py-3.5 bg-red-600 rounded-xl font-bold text-white hover:bg-red-700 shadow-lg shadow-red-500/20 transition-colors"
                  >
                      Ya, Keluar
                  </button>
              </div>
           </div>
        </Modal>

      </div>
    </div>
  );
};