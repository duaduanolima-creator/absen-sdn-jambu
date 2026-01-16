import React, { useState, useEffect, useRef } from 'react';
import { User, AttendanceRecord } from '../types';
import { getAllTodayRecords, getAllRecords, downloadMonthlyReport, fetchGlobalRecords } from '../services/mockBackend';
import { Download, Users, UserCheck, UserX, Search, School, Home, User as UserIcon, FileDown, Calendar, Clock, AlertTriangle, CheckCircle2, HeartPulse, FileText, Briefcase, MapPin, LogOut, RefreshCw } from 'lucide-react';
import { ProfileView } from './ProfileView';

interface PrincipalDashboardProps {
  user: User;
  onLogout: () => void;
}

export const PrincipalDashboard: React.FC<PrincipalDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'profile'>('home');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [filter, setFilter] = useState('');
  const [historyFilter, setHistoryFilter] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  
  // Ref untuk menyimpan data terakhir agar tidak hilang saat fetch gagal
  const recordsRef = useRef<AttendanceRecord[]>([]);

  // Default download range: 1st of current month to Today
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayStr = todayStr.substring(0, 7) + '-01';
  
  const [downloadStartDate, setDownloadStartDate] = useState(firstDayStr);
  const [downloadEndDate, setDownloadEndDate] = useState(todayStr);

  const fetchData = async (isBackground = false) => {
     // PERBAIKAN: Hanya tampilkan loading UI jika bukan background process (manual refresh / first load)
     if (!isBackground) {
        setLoadingData(true);
     }
     
     try {
         // Fetch GLOBAL data from GAS
         const allData = await fetchGlobalRecords();
         
         const today = new Date().toISOString().split('T')[0];
         // Filter for Today
         const todayData = allData.filter(r => r.date === today);
         
         // PERBAIKAN: Jika hasil fetch kosong TAPI kita punya data sebelumnya (dan ini background refresh),
         // kemungkinan koneksi error/rate limit Google Sheet. Jangan timpa data lama dengan kosong.
         if (isBackground && todayData.length === 0 && recordsRef.current.length > 0) {
             console.warn("Background fetch returned empty, keeping previous data.");
         } else {
             setRecords(todayData);
             recordsRef.current = todayData; // Update ref
             setHistoryRecords(allData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
         }
     } catch (e) {
         console.error("Error fetching data for principal", e);
         // Fallback logic handled gracefully
     } finally {
         if (!isBackground) {
            setLoadingData(false);
         }
         setIsRefreshing(false);
     }
  };

  useEffect(() => {
    fetchData(false); // First load (Show Loading)

    // Polling every 60 seconds to update from Cloud
    const interval = setInterval(() => {
        fetchData(true); // Background load (No Loading UI)
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleDownload = () => {
    if (!downloadStartDate || !downloadEndDate) {
        alert("Silakan pilih tanggal mulai dan selesai.");
        return;
    }
    if (downloadStartDate > downloadEndDate) {
        alert("Tanggal mulai tidak boleh lebih besar dari tanggal selesai.");
        return;
    }
    downloadMonthlyReport(downloadStartDate, downloadEndDate);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData(false); // Manual refresh shows loading
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const honorific = user.gender === 'male' ? 'Bapak' : 'Ibu';
  const presentCount = records.filter(r => r.type === 'present').length;
  const absentCount = records.filter(r => r.type !== 'present').length;

  const filteredRecords = records.filter(r => 
    r.userName.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredHistory = historyRecords.filter(r => 
    r.userName.toLowerCase().includes(historyFilter.toLowerCase()) || 
    r.date.includes(historyFilter)
  );

  const renderHome = () => (
    <div className="min-h-screen bg-dark pb-24">
      {/* Sticky Header with Logo */}
      <div className="bg-card border-b border-slate-800 p-4 sticky top-0 z-20 shadow-lg shadow-black/20">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
             <img src="https://iili.io/fSrP6iB.png" alt="Logo SDN JAMBU" className="w-10 h-10 object-contain drop-shadow-md" />
            <div>
                <h1 className="font-bold text-white leading-tight">SDN JAMBU</h1>
                <p className="text-[10px] text-slate-400 font-medium">Tunjung Teja, Serang-Banten</p>
            </div>
          </div>
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing} 
            className="p-2 bg-slate-800/50 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-700/50"
            aria-label="Refresh Data"
          >
            <RefreshCw size={18} className={isRefreshing ? "animate-spin text-emerald-400" : ""} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4">
        
        {/* Title with Avatar - Compact */}
        <div className="flex items-start gap-4 px-2">
            <div className="w-14 h-14 rounded-full bg-slate-700 border-2 border-slate-600 overflow-hidden shrink-0 mt-1 shadow-lg">
                {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                <div className="w-full h-full flex items-center justify-center text-lg font-bold text-slate-300">
                    {user.name.substring(0, 2).toUpperCase()}
                </div>
                )}
            </div>
            <div>
                <p className="text-emerald-400 font-medium text-xs mb-0.5">{getGreeting()}, {honorific}</p>
                <h2 className="text-lg font-bold text-white leading-tight">{user.name}</h2>
                <p className="text-xs text-slate-400 mt-1">Dashboard Monitoring Realtime</p>
            </div>
        </div>

        {/* Stats Cards - Compact */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-900/30 border border-emerald-800 p-3 rounded-xl flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-lg text-emerald-400">
                <UserCheck size={20} />
            </div>
            <div>
                <div className="text-xl font-bold text-white">{presentCount}</div>
                <div className="text-[10px] text-emerald-400 font-medium uppercase">Hadir Hari Ini</div>
            </div>
          </div>
          <div className="bg-amber-900/30 border border-amber-800 p-3 rounded-xl flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-lg text-amber-400">
                <UserX size={20} />
            </div>
            <div>
                <div className="text-xl font-bold text-white">{absentCount}</div>
                <div className="text-[10px] text-amber-400 font-medium uppercase">Izin / Sakit</div>
            </div>
          </div>
        </div>

        {/* Actions & Filters */}
        <div className="flex flex-col gap-3">
           {/* Search Input */}
          <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                  type="text" 
                  placeholder="Cari guru hari ini..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
              />
          </div>

          {/* Download Report Section - Compact */}
          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                  <FileDown size={16} className="text-blue-400" />
                  Download Laporan Kehadiran
              </div>
              <div className="grid grid-cols-2 gap-2">
                  <div>
                      <label className="text-[9px] uppercase text-slate-500 font-bold mb-1 block">Dari Tanggal</label>
                      <input 
                        type="date" 
                        value={downloadStartDate}
                        onChange={(e) => setDownloadStartDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                  </div>
                  <div>
                      <label className="text-[9px] uppercase text-slate-500 font-bold mb-1 block">Sampai Tanggal</label>
                      <input 
                        type="date" 
                        value={downloadEndDate}
                        onChange={(e) => setDownloadEndDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                  </div>
              </div>
              <button 
                onClick={handleDownload}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
              >
                <Download size={14} />
                Download Excel (CSV)
              </button>
          </div>
        </div>

        {/* List */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden min-h-[200px]">
            <div className="p-3 border-b border-slate-700 font-semibold text-slate-300 flex items-center gap-2 justify-between">
                <span className="flex items-center gap-2 text-sm"><Users size={16} /> Kehadiran Guru Hari Ini</span>
                {/* Tampilkan indikator loading halus di sebelah kanan jika sedang refresh background */}
                {(loadingData || isRefreshing) && <span className="text-[10px] text-emerald-400 animate-pulse">Sinkronisasi...</span>}
            </div>
            <div className="divide-y divide-slate-700">
                {/* Tampilkan loading screen HANYA jika ini load pertama/manual dan data masih kosong */}
                {loadingData && records.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-slate-400" />
                        <span className="text-xs">Sedang memuat data...</span>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                        Belum ada data absensi hari ini.
                    </div>
                ) : (
                    filteredRecords.map((rec) => (
                        <div key={rec.id} className="p-3 hover:bg-slate-800 transition-colors">
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-xs border border-slate-600">
                                        {rec.userName.substring(0,2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white text-sm">{rec.userName}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${
                                                rec.type === 'present' 
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                : rec.type === 'sppd' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            }`}>
                                                {rec.type === 'present' ? 'HADIR' : rec.type.toUpperCase()}
                                            </span>
                                            {rec.type === 'present' && rec.notes && rec.notes.includes('TELAT') && (
                                                <span className="text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 font-bold">
                                                    TERLAMBAT
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {rec.type === 'present' && (
                                    <div className="text-right flex flex-col items-end">
                                        <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded border border-slate-700/50">
                                             <Clock size={10} className="text-emerald-400" />
                                             <span className="font-mono font-bold text-white text-xs">{rec.checkInTime}</span>
                                        </div>
                                        {rec.checkOutTime && (
                                            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                                                <LogOut size={10} /> {rec.checkOutTime}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {rec.type !== 'present' && (
                                <div className="mt-2 bg-slate-900/50 p-2 rounded-lg text-xs text-slate-300 border border-slate-700/50 flex items-start gap-2">
                                    {rec.sppdData ? (
                                        <>
                                           <Briefcase size={12} className="text-purple-400 shrink-0 mt-0.5" />
                                           <div>
                                               <p className="font-bold text-purple-400 text-[10px]">SPPD: {rec.sppdData.activityType}</p>
                                               <p className="text-slate-400 mt-0.5 text-[10px]">{rec.sppdData.destination}</p>
                                           </div>
                                        </>
                                    ) : (
                                        <>
                                            <FileText size={12} className="text-amber-400 shrink-0 mt-0.5" />
                                            <p className="text-[10px]">{rec.notes || 'Tidak ada keterangan'}</p>
                                        </>
                                    )}
                                </div>
                            )}

                             {/* Location display for present users */}
                             {rec.type === 'present' && rec.location && (
                                <div className="mt-1 flex items-center gap-1 text-[9px] text-slate-500 ml-12">
                                    <MapPin size={9} /> {rec.location}
                                </div>
                             )}
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="min-h-screen bg-dark pb-24">
      {/* Header with Logo */}
      <div className="bg-card border-b border-slate-800 p-4 sticky top-0 z-20 shadow-lg shadow-black/20">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <img src="https://iili.io/fSrP6iB.png" alt="Logo SDN JAMBU" className="w-10 h-10 object-contain drop-shadow-md" />
            <div>
              <h1 className="font-bold text-white leading-tight">SDN JAMBU</h1>
              <p className="text-[10px] text-slate-400 font-medium">Riwayat Absensi Seluruh Guru</p>
            </div>
          </div>
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing} 
            className="p-2 bg-slate-800/50 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-700/50"
            aria-label="Refresh Riwayat"
          >
            <RefreshCw size={18} className={isRefreshing ? "animate-spin text-emerald-400" : ""} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4">
        {/* Search/Filter */}
        <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
                type="text" 
                placeholder="Cari berdasarkan nama atau tanggal (YYYY-MM-DD)..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
            />
        </div>

        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500 gap-3">
             <Calendar size={48} className="opacity-20" />
             <p>{loadingData ? "Sedang memuat data..." : "Tidak ada riwayat absensi ditemukan."}</p>
          </div>
        ) : (
          filteredHistory.map((item) => {
            const isLate = item.notes && item.notes.includes('TELAT');
            let IconComponent = CheckCircle2;
            let themeColor = 'emerald';
            
            if (item.type === 'sick') { IconComponent = HeartPulse; themeColor = 'red'; }
            else if (item.type === 'leave') { IconComponent = FileText; themeColor = 'amber'; }
            else if (item.type === 'sppd') { IconComponent = Briefcase; themeColor = 'purple'; }

            return (
            <div key={item.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 relative overflow-hidden group">
               {/* Background Watermark Icon */}
               <div className={`absolute -right-4 -bottom-4 opacity-5 pointer-events-none text-${themeColor}-400`}>
                   <IconComponent size={100} />
               </div>

               <div className="flex gap-4 relative z-10">
                   {/* Date Box */}
                   <div className={`flex flex-col items-center justify-center bg-slate-900 rounded-xl w-16 h-auto shrink-0 border border-slate-700/50 p-2 shadow-inner`}>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{new Date(item.date).toLocaleDateString('id-ID', { month: 'short' })}</span>
                      <span className="text-2xl font-bold text-white leading-none my-1">{new Date(item.date).getDate()}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{new Date(item.date).toLocaleDateString('id-ID', { weekday: 'short' })}</span>
                   </div>

                   {/* Main Content */}
                   <div className="flex-1 flex flex-col gap-2">
                        {/* Header: Name and Badge */}
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-white text-sm">{item.userName}</h4>
                                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide mt-1
                                    ${item.type === 'present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                      item.type === 'sppd' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    }
                                `}>
                                    <IconComponent size={18} />
                                    {item.type === 'present' ? 'HADIR' : item.type.toUpperCase()}
                                </div>
                            </div>
                        </div>

                        {/* Body: Times or Description */}
                        {item.type === 'present' ? (
                            <div className="grid grid-cols-2 gap-3 mt-1">
                                <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/30">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1 mb-1">
                                        <Clock size={10} /> Masuk
                                    </div>
                                    <div className={`text-base font-mono font-bold ${isLate ? "text-red-400" : "text-white"}`}>
                                        {item.checkInTime}
                                    </div>
                                    {isLate && <div className="text-[9px] text-red-400 mt-1 leading-none font-medium">TERLAMBAT</div>}
                                </div>
                                <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/30">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1 mb-1">
                                        <LogOut size={10} /> Pulang
                                    </div>
                                    <div className="text-base font-mono font-bold text-white">
                                        {item.checkOutTime || '--:--'}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 mt-1">
                                <div className="text-xs text-slate-300 leading-relaxed">
                                    {item.sppdData ? (
                                        <>
                                            <span className="block font-bold text-purple-400 mb-1">{item.sppdData.activityType}</span>
                                            <span className="flex items-center gap-1 text-slate-400"><MapPin size={10}/> {item.sppdData.destination}</span>
                                        </>
                                    ) : (
                                        item.notes || 'Tidak ada keterangan'
                                    )}
                                </div>
                            </div>
                        )}
                   </div>
               </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      {activeTab === 'home' && renderHome()}
      {activeTab === 'history' && renderHistory()}
      {activeTab === 'profile' && <ProfileView user={user} onLogout={onLogout} />}
      
      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 pb-safe z-50">
        <div className="flex justify-around items-center h-16 max-w-2xl mx-auto">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${activeTab === 'home' ? 'text-primary' : 'text-slate-500'}`}
          >
            <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Beranda</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${activeTab === 'history' ? 'text-primary' : 'text-slate-500'}`}
          >
            <Calendar size={24} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Riwayat</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${activeTab === 'profile' ? 'text-primary' : 'text-slate-500'}`}
          >
            <UserIcon size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Profil</span>
          </button>
        </div>
      </div>
    </>
  );
};