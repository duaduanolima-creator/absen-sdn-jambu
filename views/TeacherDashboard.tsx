import React, { useState, useEffect, useRef } from 'react';
import { User, AttendanceRecord, SppdData } from '../types';
import { getTodayRecord, markCheckIn, markCheckOut, submitReport, getUserHistory, getAllTodayRecords, fetchGlobalRecords, validateDeviceUsage } from '../services/mockBackend';
import { MapPin, Briefcase, HeartPulse, School, Home, User as UserIcon, LogOut, Camera, RotateCw, RefreshCw, Upload, Image as ImageIcon, Plus, X, FileText, AlertTriangle, Calendar, Clock, Users, CheckCircle2, ArrowRight, Ban } from 'lucide-react';
import { Modal } from '../components/Modal';
import { ProfileView } from './ProfileView';

// --- KONFIGURASI LOKASI SEKOLAH ---
const SCHOOL_COORDINATES = {
  lat: -6.114196248039071,
  lng: 106.2276108127061
};
// VALIDASI MASA PERCOBAAN: Jarak maksimal diperluas menjadi 2000 meter (2 km)
const MAX_RADIUS_METERS = 2000; 

interface TeacherDashboardProps {
  user: User;
  onLogout: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'profile'>('home');
  
  // Home Logic State
  const [record, setRecord] = useState<AttendanceRecord | undefined>(undefined);
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [peers, setPeers] = useState<AttendanceRecord[]>([]); // State for peer list
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalType, setModalType] = useState<'sick' | 'leave' | 'sppd' | 'checkin' | 'checkout' | null>(null);
  
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Generic Form Data
  const [formData, setFormData] = useState({ 
    notes: '', 
    startDate: todayStr,
    endDate: todayStr,
    attachment: '' as string | null
  });

  // SPPD Specific Data
  const [sppdForm, setSppdForm] = useState<SppdData>({
    activityType: '',
    activityDetail: '',
    destination: '',
    startDate: todayStr,
    endDate: todayStr,
    resultReport: '',
    attachments: [null, null, null] as any[] // Max 3 slots
  });
  
  const [currentTime, setCurrentTime] = useState(new Date());

  // Camera & Location State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<string>('');
  const [distanceInfo, setDistanceInfo] = useState<{meters: number, text: string} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Helper to load live peer data
  const loadPeers = async () => {
    try {
        const globalData = await fetchGlobalRecords();
        const today = new Date().toISOString().split('T')[0];
        setPeers(globalData.filter(r => r.date === today));
    } catch (e) {
        // Fallback handled in fetchGlobalRecords, but double check here
        setPeers(getAllTodayRecords());
    }
  };

  useEffect(() => {
    setRecord(getTodayRecord(user.id));
    // Load initial peers
    loadPeers();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    // Refresh peers every 60 seconds to keep it "live"
    const peerInterval = setInterval(() => loadPeers(), 60000);

    return () => {
        clearInterval(timer);
        clearInterval(peerInterval);
    };
  }, [user.id]);

  useEffect(() => {
    if (activeTab === 'history') {
      const hist = getUserHistory(user.id);
      setHistoryRecords(hist);
    }
  }, [activeTab, user.id, record]); // Re-fetch when tab changes or a new record is made

  useEffect(() => {
    if (modalType === 'checkin' || modalType === 'checkout') {
      startCamera();
      fetchLocation();
    } else {
      stopCamera();
      setPhoto(null);
      setLocation('');
      setDistanceInfo(null);
      setCameraError('');
      if (!modalType) {
          // Reset forms
          setFormData({
            notes: '',
            startDate: todayStr,
            endDate: todayStr,
            attachment: null
          });
          setSppdForm({
            activityType: '',
            activityDetail: '',
            destination: '',
            startDate: todayStr,
            endDate: todayStr,
            resultReport: '',
            attachments: []
          });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalType]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate network delay for UX
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Refresh data based on active tab
    setRecord(getTodayRecord(user.id));
    await loadPeers();
    
    if (activeTab === 'history') {
        const hist = getUserHistory(user.id);
        setHistoryRecords(hist);
    }
    setIsRefreshing(false);
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setCameraError('Gagal mengakses kamera. Izinkan akses kamera browser.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // RESIZE: Limit lebar maksimum ke 500px agar base64 tidak terlalu besar
        const MAX_WIDTH = 500;
        const scale = video.videoWidth > MAX_WIDTH ? MAX_WIDTH / video.videoWidth : 1;
        
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Kompresi kualitas JPG ke 0.7
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setPhoto(dataUrl);
      }
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
  };

  // Haversine Formula to calculate distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in meters
  };

  const fetchLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Calculate distance to school
          const dist = calculateDistance(latitude, longitude, SCHOOL_COORDINATES.lat, SCHOOL_COORDINATES.lng);
          
          let distText = "";
          if (dist > 1000) {
              distText = `${(dist/1000).toFixed(2)} km`;
          } else {
              distText = `${Math.round(dist)} Meter`;
          }

          setDistanceInfo({
              meters: dist,
              text: distText
          });

          // Save friendly string to backend (coordinate only for display logic, distance is sent separately)
          const locString = `Lat: ${latitude.toFixed(6)}, Long: ${longitude.toFixed(6)}`;
          setLocation(locString);
          setIsLocating(false);
        },
        (error) => {
          console.error("Location error:", error);
          setLocation('Lokasi tidak ditemukan (Pastikan GPS aktif)');
          setDistanceInfo(null);
          setIsLocating(false);
        }
      );
    } else {
      setLocation('Geolocation tidak didukung browser ini.');
      setIsLocating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, attachment: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSppdAttachment = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newAttachments = [...(sppdForm.attachments || [])];
        newAttachments[index] = reader.result as string;
        setSppdForm(prev => ({ ...prev, attachments: newAttachments }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeSppdAttachment = (index: number) => {
      const newAttachments = [...(sppdForm.attachments || [])];
      newAttachments[index] = null; 
      setSppdForm(prev => ({ ...prev, attachments: newAttachments }));
  }

  const handleCheckInClick = () => {
      // Validasi Device Lock sebelum buka modal
      const deviceCheck = validateDeviceUsage(user.id);
      if (!deviceCheck.allowed) {
          alert(deviceCheck.message);
          return;
      }
      setModalType('checkin');
  };

  const handleAttendanceSubmit = async () => {
    if (!photo || !location) return;

    // VALIDASI KETAT: Cek jarak sebelum submit
    if (distanceInfo && distanceInfo.meters > MAX_RADIUS_METERS) {
        alert("Posisi Anda TERLALU JAUH dari sekolah. Silakan masuk ke area sekolah untuk melakukan absen.");
        return;
    }

    setLoading(true);
    const currentDistance = distanceInfo ? distanceInfo.text : "Tidak Terdeteksi";

    try {
      if (modalType === 'checkin') {
        const newRecord = await markCheckIn(user, location, photo, currentDistance);
        setRecord(newRecord);
      } else if (modalType === 'checkout') {
        const updated = await markCheckOut(user, location, photo, currentDistance);
        if (updated) setRecord(updated);
      }
      // Refresh peers immediately after action
      await loadPeers();
      setModalType(null);
    } catch (e: any) {
      alert(e.message || "Gagal melakukan absensi");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForm = async () => {
    setLoading(true);
    try {
      if (modalType === 'sppd') {
        if (!sppdForm.attachments || !sppdForm.attachments[0]) {
            alert("Wajib melampirkan minimal 1 dokumentasi (Foto 1).");
            setLoading(false);
            return;
        }

        const cleanAttachments = sppdForm.attachments.filter(Boolean);
        const finalSppdData = { ...sppdForm, attachments: cleanAttachments };

        const updated = await submitReport(user, 'sppd', '', finalSppdData);
        setRecord(updated);
      } else if (modalType === 'sick' || modalType === 'leave') {
        const updated = await submitReport(
            user, 
            modalType, 
            formData.notes, 
            undefined, 
            formData.attachment || undefined,
            formData.startDate,
            formData.endDate
        );
        setRecord(updated);
      }
      // Refresh peers immediately after action
      await loadPeers();
      setModalType(null);
    } catch (e) {
      alert("Gagal mengirim data");
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 11) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const lateStatus = (() => {
    const limit = new Date();
    limit.setHours(7, 30, 0, 0); 
    
    if (currentTime > limit) {
        const diffMs = currentTime.getTime() - limit.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        
        let timeString = "";
        if (hours > 0) timeString += `${hours} Jam `;
        timeString += `${mins} Menit`;
        
        return { isLate: true, text: timeString };
    }
    return { isLate: false, text: '' };
  })();

  const isCheckedIn = !!record?.checkInTime;
  const isCheckedOut = !!record?.checkOutTime;
  const honorific = user.gender === 'male' ? 'Bapak' : 'Ibu';

  // State derived untuk validasi jarak
  const isOutOfRange = distanceInfo ? distanceInfo.meters > MAX_RADIUS_METERS : false;

  // RENDER SECTIONS
  const renderHome = () => (
    <div className="min-h-screen bg-dark pb-24">
      {/* Sticky Header with Logo */}
      <div className="bg-card border-b border-slate-800 p-4 sticky top-0 z-20 shadow-lg shadow-black/20">
        <div className="flex justify-between items-center max-w-md mx-auto">
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

      <div className="max-w-md mx-auto p-4 flex flex-col gap-5">
        
        {/* User Greeting with Avatar */}
        <div className="flex items-center gap-4 px-2">
           <div className="w-14 h-14 rounded-full bg-slate-700 border-2 border-slate-600 overflow-hidden shrink-0 shadow-lg">
             {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
             ) : (
                <div className="w-full h-full flex items-center justify-center text-lg font-bold text-slate-300">
                    {user.name.substring(0, 2).toUpperCase()}
                </div>
             )}
           </div>
           <div>
              <h2 className="text-lg font-bold text-white leading-tight">{getGreeting()}, <br/><span className="text-emerald-400">{honorific} {user.name}</span></h2>
              <p className="text-xs text-slate-400 mt-1">Selamat beraktivitas! Jangan lupa absen ya.</p>
           </div>
        </div>

        {/* Clock Card - Compact Version */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-4 border border-slate-700/50 shadow-xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all"></div>
          <div className="relative z-10 flex flex-col items-center justify-center py-1">
            <span className="text-slate-400 text-xs uppercase tracking-wider font-medium mb-1">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <span className="text-4xl font-mono font-bold text-white tracking-tighter tabular-nums">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Action Grid - RECTANGULAR CARD VERSION (Option 1) */}
        <div className="grid grid-cols-2 gap-3">
          {/* 1. Absen Datang */}
          <button 
            disabled={loading || isCheckedIn} 
            onClick={handleCheckInClick}
            className={`relative group overflow-hidden rounded-2xl p-3 h-20 flex items-center gap-3 transition-all shadow-lg border border-white/10 ${
                isCheckedIn 
                ? 'bg-slate-800 border-slate-700 text-emerald-500 cursor-not-allowed opacity-100' 
                : 'bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-500/20 active:scale-95'
            }`}
          >
             <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isCheckedIn ? 'bg-emerald-500/10' : 'bg-white/20 backdrop-blur-sm'}`}>
                {isCheckedIn ? <CheckCircle2 size={20} /> : <MapPin size={20} className="text-white" />}
             </div>
             <div className="flex flex-col items-start z-10">
                <span className={`font-bold text-sm leading-none ${isCheckedIn ? 'text-emerald-500' : 'text-white'}`}>
                    {isCheckedIn ? 'Sudah Absen' : 'Absen Datang'}
                </span>
                <span className={`text-[10px] font-medium mt-1 ${isCheckedIn ? 'text-slate-500' : 'text-emerald-100'}`}>
                    {isCheckedIn ? 'Tercatat' : 'Tap disini'}
                </span>
             </div>
             {/* Decorative bg icon */}
             <MapPin className="absolute -right-2 -bottom-2 text-white/5 rotate-12" size={60} />
          </button>

          {/* 2. Absen Pulang */}
          <button 
            disabled={!isCheckedIn || isCheckedOut || loading}
            onClick={() => setModalType('checkout')}
            className={`relative group overflow-hidden rounded-2xl p-3 h-20 flex items-center gap-3 transition-all shadow-lg border border-white/10 ${
              !isCheckedIn || isCheckedOut
              ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed grayscale opacity-70' 
              : 'bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-500/20 active:scale-95 text-white'
            }`}
          >
             <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${!isCheckedIn || isCheckedOut ? 'bg-slate-700' : 'bg-white/20 backdrop-blur-sm'}`}>
                <LogOut size={20} />
             </div>
             <div className="flex flex-col items-start z-10">
                <span className="font-bold text-sm leading-none">Absen Pulang</span>
                <span className="text-[10px] font-medium mt-1 text-blue-100/70">Tap disini</span>
             </div>
             <LogOut className="absolute -right-2 -bottom-2 text-white/5 rotate-12" size={60} />
          </button>

          {/* 3. Input SPPD */}
          <button 
            onClick={() => setModalType('sppd')}
            className="relative group overflow-hidden rounded-2xl p-3 h-20 flex items-center gap-3 transition-all bg-gradient-to-br from-purple-500 to-indigo-700 text-white shadow-lg shadow-purple-500/20 border border-white/10 active:scale-95"
          >
             <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Briefcase size={20} />
             </div>
             <div className="flex flex-col items-start z-10">
                <span className="font-bold text-sm leading-none">Input SPPD</span>
                <span className="text-[10px] font-medium mt-1 text-purple-100/70">Dinas Luar</span>
             </div>
             <Briefcase className="absolute -right-2 -bottom-2 text-white/5 rotate-12" size={60} />
          </button>

          {/* 4. Sakit / Izin */}
          <button 
             onClick={() => setModalType('sick')}
             className="relative group overflow-hidden rounded-2xl p-3 h-20 flex items-center gap-3 transition-all bg-gradient-to-br from-orange-500 to-red-700 text-white shadow-lg shadow-orange-500/20 border border-white/10 active:scale-95"
          >
             <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <HeartPulse size={20} />
             </div>
             <div className="flex flex-col items-start z-10">
                <span className="font-bold text-sm leading-none">Sakit / Izin</span>
                <span className="text-[10px] font-medium mt-1 text-orange-100/70">Formulir</span>
             </div>
             <HeartPulse className="absolute -right-2 -bottom-2 text-white/5 rotate-12" size={60} />
          </button>
        </div>

        {/* Rekap Harian Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden mt-1">
           <div className="p-3 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/80">
             <h3 className="font-bold text-white flex items-center gap-2 text-xs">
                <Users size={14} className="text-blue-400" /> Rekap Kehadiran Hari Ini
             </h3>
             <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                {peers.length} Data
             </span>
           </div>
           <div className="divide-y divide-slate-700/50 max-h-[250px] overflow-y-auto">
             {peers.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                    <Clock size={24} className="opacity-20" />
                    Belum ada guru yang absen hari ini.
                </div>
             ) : (
                peers.map(p => {
                    // Check if it's the current user
                    const isMe = p.userId === user.id;
                    return (
                        <div key={p.id} className={`p-3 flex justify-between items-center ${isMe ? 'bg-slate-800/80' : ''}`}>
                        <div className="flex items-center gap-3">
                            {/* Avatar Initials */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 ${
                                p.type === 'present' ? 'bg-emerald-600 border-emerald-500/30' : 
                                p.type === 'sppd' ? 'bg-purple-600 border-purple-500/30' :
                                'bg-amber-600 border-amber-500/30'
                            }`}>
                                {p.userName.substring(0,2).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white line-clamp-1">
                                    {p.userName} {isMe && <span className="text-[10px] text-slate-400 font-normal">(Anda)</span>}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                        p.type === 'present' ? 'bg-emerald-400' :
                                        p.type === 'sppd' ? 'bg-purple-400' :
                                        'bg-amber-400'
                                    }`}></span>
                                    <p className="text-[10px] text-slate-400">
                                        {p.type === 'present' ? 'Hadir' : p.type.toUpperCase()}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            {p.type === 'present' ? (
                                <div className="flex flex-col items-end gap-1.5">
                                    {/* Datang */}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Datang</span>
                                        <div className="text-xs font-mono font-bold text-white bg-slate-900 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                            {p.checkInTime || '-'}
                                        </div>
                                    </div>
                                    {/* Pulang */}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider">Pulang</span>
                                        <div className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded border ${p.checkOutTime ? 'text-white bg-slate-900 border-red-500/30' : 'text-slate-600 border-slate-700 bg-slate-900/50'}`}>
                                            {p.checkOutTime || '--:--'}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[10px] text-slate-500 italic bg-slate-900/50 px-2 py-1 rounded">
                                    {p.type === 'sppd' ? 'Dinas Luar' : p.type === 'sick' ? 'Sakit' : 'Izin'}
                                </p>
                            )}
                        </div>
                        </div>
                    );
                })
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
        <div className="flex justify-between items-center max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <img src="https://iili.io/fSrP6iB.png" alt="Logo SDN JAMBU" className="w-10 h-10 object-contain drop-shadow-md" />
            <div>
              <h1 className="font-bold text-white leading-tight">SDN JAMBU</h1>
              <p className="text-[10px] text-slate-400 font-medium">Riwayat Absensi Saya</p>
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

      <div className="max-w-md mx-auto p-4 flex flex-col gap-4">
        {historyRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500 gap-3">
             <Calendar size={48} className="opacity-20" />
             <p>Belum ada riwayat absensi.</p>
          </div>
        ) : (
          historyRecords.map((item) => {
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
                        {/* Header: Badge */}
                        <div className="flex justify-between items-start">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
                                ${item.type === 'present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                  item.type === 'sppd' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                  'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }
                            `}>
                                <IconComponent size={14} />
                                {item.type === 'present' ? 'HADIR' : item.type.toUpperCase()}
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
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
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

      {/* MODALS - Reusing existing structure */}
      <Modal 
        isOpen={modalType === 'checkin' || modalType === 'checkout'} 
        onClose={() => setModalType(null)} 
        title={modalType === 'checkin' ? "Form Absen Datang" : "Form Absen Pulang"}
      >
        <div className="flex flex-col gap-4">
           {modalType === 'checkin' && lateStatus.isLate && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                    <div>
                        <p className="text-amber-400 font-bold text-sm">Terlambat {lateStatus.text}</p>
                        <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">Jam masuk maksimal pukul 07:30. Keterlambatan akan tercatat otomatis.</p>
                    </div>
                </div>
           )}

           <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                 <label className="text-xs text-slate-400 uppercase font-semibold">Nama Lengkap</label>
                 <div className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-300 text-sm">
                    {user.name}
                 </div>
              </div>
              <div>
                 <label className="text-xs text-slate-400 uppercase font-semibold">NIP</label>
                 <div className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-300 text-sm">
                    {user.nip || '-'}
                 </div>
              </div>
              <div>
                 <label className="text-xs text-slate-400 uppercase font-semibold">Status</label>
                 <div className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-300 text-sm">
                    {user.employmentStatus || '-'}
                 </div>
              </div>
           </div>

           <div>
              <label className="text-xs text-slate-400 uppercase font-semibold flex justify-between items-center">
                Lokasi Saat Ini
                <button onClick={fetchLocation} className="text-primary hover:text-emerald-400 transition-colors">
                    <RefreshCw size={14} className={isLocating ? "animate-spin" : ""} />
                </button>
              </label>
              
              {/* STATUS JARAK */}
              {distanceInfo && (
                  <div className={`mt-1 mb-2 px-2 py-1.5 rounded text-xs font-bold text-center border ${
                      !isOutOfRange
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                  }`}>
                      {!isOutOfRange ? (
                          <span className="flex items-center justify-center gap-1"><CheckCircle2 size={12}/> Posisi: {distanceInfo.text}</span>
                      ) : (
                          <span className="flex items-center justify-center gap-1"><AlertTriangle size={12}/> Posisi: {distanceInfo.text} (Diluar Jangkauan)</span>
                      )}
                  </div>
              )}

              <div className={`bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm flex items-center gap-2 ${!location ? 'text-slate-500 italic' : 'text-emerald-400'}`}>
                 <MapPin size={16} className="shrink-0" />
                 <span className="truncate text-xs">{location || (isLocating ? "Sedang mendeteksi lokasi..." : "Klik refresh untuk lokasi")}</span>
              </div>
           </div>

           {/* ALERT OUT OF RANGE */}
           {isOutOfRange && (
               <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 animate-in fade-in zoom-in duration-300">
                   <div className="p-3 bg-red-500/20 rounded-full text-red-500 mb-1">
                       <Ban size={24} />
                   </div>
                   <h4 className="text-red-500 font-bold text-sm">Lokasi Tidak Sesuai</h4>
                   <p className="text-slate-400 text-xs leading-relaxed">
                       Anda berada {distanceInfo?.text} dari titik sekolah. Absensi hanya dapat dilakukan dalam radius {MAX_RADIUS_METERS} meter.
                   </p>
               </div>
           )}

           {!isOutOfRange && (
               <div>
                  <label className="text-xs text-slate-400 uppercase font-semibold mb-2 block">Foto Selfie</label>
                  <div className="relative w-full aspect-[3/4] bg-black rounded-xl overflow-hidden border-2 border-slate-700 mx-auto max-w-[320px]">
                      <canvas ref={canvasRef} className="hidden" />
                      {photo ? (
                          <img src={photo} alt="Selfie preview" className="w-full h-full object-cover" />
                      ) : (
                          <>
                            {cameraError ? (
                                <div className="flex items-center justify-center h-full text-center p-4 text-red-400 text-sm">{cameraError}</div>
                            ) : (
                                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                            )}
                          </>
                      )}
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10">
                          {photo ? (
                               <button onClick={retakePhoto} className="bg-slate-800/80 backdrop-blur text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-slate-700 border border-slate-600">
                                 <RotateCw size={16} /> Foto Ulang
                               </button>
                          ) : (
                              <button onClick={capturePhoto} disabled={!!cameraError} className="bg-white text-black p-4 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all border-4 border-slate-300/50 disabled:opacity-50">
                                <Camera size={24} className="text-black" />
                              </button>
                          )}
                      </div>
                  </div>
               </div>
           )}

           <button 
             onClick={handleAttendanceSubmit}
             disabled={loading || !photo || !location || isOutOfRange}
             className={`mt-2 w-full font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 
                ${isOutOfRange 
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600' 
                    : 'bg-primary hover:bg-emerald-600 active:scale-95 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
           >
             {isOutOfRange 
                ? 'Jarak Terlalu Jauh' 
                : loading 
                    ? 'Mengirim Data...' 
                    : (modalType === 'checkin' ? 'Kirim Absen Masuk' : 'Kirim Absen Pulang')
             }
           </button>
        </div>
      </Modal>

      <Modal isOpen={modalType === 'sppd'} onClose={() => setModalType(null)} title="Input Laporan SPPD">
        <div className="flex flex-col gap-6">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Info Pegawai</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                        <span className="text-slate-500 text-xs block">Nama</span>
                        <span className="text-white font-medium">{user.name}</span>
                    </div>
                    <div>
                        <span className="text-slate-500 text-xs block">NIP</span>
                        <span className="text-white font-medium">{user.nip || '-'}</span>
                    </div>
                </div>
            </div>

            <div>
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <div className="w-1 h-4 bg-purple-500 rounded-full"></div> Laporan SPPD
                </h4>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-slate-400 font-medium mb-1 block">Jenis Kegiatan</label>
                        <input 
                            type="text" 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Contoh: Pelatihan K13"
                            value={sppdForm.activityType}
                            onChange={(e) => setSppdForm({...sppdForm, activityType: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 font-medium mb-1 block">Detail Kegiatan</label>
                        <textarea 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 h-20"
                            placeholder="Deskripsi singkat kegiatan..."
                            value={sppdForm.activityDetail}
                            onChange={(e) => setSppdForm({...sppdForm, activityDetail: e.target.value})}
                        ></textarea>
                    </div>
                </div>
            </div>

            <div>
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-500 rounded-full"></div> Data Surat Tugas
                </h4>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-slate-400 font-medium mb-1 block">Lokasi / Tujuan</label>
                        <input 
                            type="text" 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Contoh: Dinas Pendidikan Kab. Serang"
                            value={sppdForm.destination}
                            onChange={(e) => setSppdForm({...sppdForm, destination: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-400 font-medium mb-1 block">Tgl Mulai</label>
                            <input 
                                type="date" 
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={sppdForm.startDate}
                                onChange={(e) => setSppdForm({...sppdForm, startDate: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 font-medium mb-1 block">Tgl Selesai</label>
                            <input 
                                type="date" 
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={sppdForm.endDate}
                                min={sppdForm.startDate}
                                onChange={(e) => setSppdForm({...sppdForm, endDate: e.target.value})}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 font-medium mb-1 block">Laporan Hasil Kegiatan</label>
                        <textarea 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-20"
                            placeholder="Hasil yang didapat dari kegiatan..."
                            value={sppdForm.resultReport}
                            onChange={(e) => setSppdForm({...sppdForm, resultReport: e.target.value})}
                        ></textarea>
                    </div>
                </div>
            </div>

            <div>
                 <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <div className="w-1 h-4 bg-emerald-500 rounded-full"></div> Lampiran Dokumentasi
                </h4>
                <p className="text-xs text-slate-400 mb-3">Minimal 1 foto (wajib), maksimal 3 foto.</p>
                
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {[0, 1, 2].map((index) => (
                        <div key={index} className="flex-shrink-0 w-24 h-24 relative">
                            {sppdForm.attachments && sppdForm.attachments[index] ? (
                                <div className="w-full h-full rounded-lg overflow-hidden border border-slate-600 relative group">
                                    <img src={sppdForm.attachments[index]} alt={`Bukti ${index + 1}`} className="w-full h-full object-cover" />
                                    <button 
                                        onClick={() => removeSppdAttachment(index)}
                                        className="absolute top-1 right-1 bg-red-500/80 p-1 rounded-full text-white"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ) : (
                                <label className={`flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-lg cursor-pointer transition-colors ${index === 0 ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-700 bg-slate-800'}`}>
                                    <Plus size={20} className={index === 0 ? 'text-emerald-400' : 'text-slate-500'} />
                                    <span className={`text-[10px] mt-1 font-medium ${index === 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {index === 0 ? 'Wajib' : 'Opsional'}
                                    </span>
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleSppdAttachment(index, e)} />
                                </label>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <button onClick={handleSubmitForm} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold shadow-lg shadow-purple-500/20 mt-2">
                {loading ? 'Mengirim Laporan...' : 'Kirim Laporan SPPD'}
            </button>
        </div>
      </Modal>

      <Modal 
        isOpen={modalType === 'sick' || modalType === 'leave'} 
        onClose={() => setModalType(null)} 
        title="Form Pengajuan Izin/Sakit"
      >
        <div className="flex flex-col gap-4">
             <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                 <label className="text-xs text-slate-400 uppercase font-semibold">Nama Lengkap</label>
                 <div className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-300 text-sm">
                    {user.name}
                 </div>
              </div>
              <div className="col-span-2">
                 <label className="text-xs text-slate-400 uppercase font-semibold">NIP</label>
                 <div className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-300 text-sm">
                    {user.nip || '-'}
                 </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase font-semibold mb-2 block">Jenis Izin</label>
              <div className="flex gap-2 p-1 bg-slate-800 rounded-lg border border-slate-700">
                  <button 
                    onClick={() => setModalType('sick')} 
                    className={`flex-1 py-2.5 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${modalType === 'sick' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'text-slate-400 hover:bg-slate-700'}`}
                  >
                    <HeartPulse size={16} /> Sakit
                  </button>
                  <button 
                    onClick={() => setModalType('leave')} 
                    className={`flex-1 py-2.5 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${modalType === 'leave' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'text-slate-400 hover:bg-slate-700'}`}
                  >
                    <FileText size={16} /> Izin
                  </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                 <label className="text-xs text-slate-400 uppercase font-semibold mb-1 block">Mulai Tanggal</label>
                 <div className="relative">
                    <input 
                      type="date" 
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    />
                 </div>
              </div>
              <div>
                 <label className="text-xs text-slate-400 uppercase font-semibold mb-1 block">Sampai Tanggal</label>
                 <div className="relative">
                    <input 
                      type="date" 
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={formData.endDate}
                      min={formData.startDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    />
                 </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase font-semibold mb-1 block">Keterangan / Alasan</label>
              <textarea 
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-primary h-24 text-sm"
                  placeholder="Berikan keterangan lengkap..."
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
              ></textarea>
            </div>

            <div>
               <label className="text-xs text-slate-400 uppercase font-semibold mb-1 block">
                  {modalType === 'sick' ? 'Foto Surat Dokter / Obat (Opsional)' : 'Dokumen Pendukung (Opsional)'}
               </label>
               <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-700 border-dashed rounded-lg cursor-pointer bg-slate-800/50 hover:bg-slate-800 transition-colors">
                  {formData.attachment ? (
                     <div className="flex items-center gap-2 text-emerald-400">
                        <ImageIcon size={24} />
                        <span className="text-sm font-medium">Gambar terpilih</span>
                     </div>
                  ) : (
                     <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload size={24} className="text-slate-400 mb-2" />
                        <p className="text-xs text-slate-500">Klik untuk upload gambar dari galeri</p>
                     </div>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
               </label>
            </div>

            <button 
              onClick={handleSubmitForm} 
              disabled={loading}
              className={`mt-2 w-full py-3 rounded-lg font-semibold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 ${modalType === 'sick' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'}`}
            >
              {loading ? 'Mengirim...' : 'Kirim Pengajuan'}
            </button>
        </div>
      </Modal>
    </>
  );
};