import { User, AttendanceRecord, AttendanceType, SppdData, UserRole } from '../types';

const USERS_KEY = 'sdn_jambu_users';
const ATTENDANCE_KEY = 'sdn_jambu_attendance';
const DEVICE_LOCK_KEY = 'sdn_jambu_device_lock'; // Key baru untuk lock device

// --- KONFIGURASI GOOGLE SHEET ---
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8MZH1ghI-L-lXzvbVYuMD_uLbuSHdMf9hifHFuYfv06VP7RCyWFXWXel83je79u73m7M232c3GZdr/pub?gid=1161435105&single=true&output=csv'; 

// --- KONFIGURASI REKAP VIEW (CSV TANPA FOTO) ---
const REKAP_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8MZH1ghI-L-lXzvbVYuMD_uLbuSHdMf9hifHFuYfv06VP7RCyWFXWXel83je79u73m7M232c3GZdr/pub?gid=368181486&single=true&output=csv';

// --- KONFIGURASI GOOGLE APPS SCRIPT (BACKEND) ---
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyzV4YBEU8nxCjdCgbSEvSF6DBAgz4-yDQsAR6GHr4fkAmYO-Okx8M4tf_PVBL8Cc_r/exec'; 

interface MockUser extends User {
  password?: string;
}

const SEED_USERS: MockUser[] = [
  { 
    id: '1', 
    name: 'Budi Santoso, S.Pd.SD', 
    role: 'principal', 
    nip: '198001012005011001', 
    username: 'kepsek', 
    password: '123',
    gender: 'male',
    employmentStatus: 'PNS',
    position: 'Kepala Sekolah',
    workUnit: 'SDN JAMBU',
    avatar: 'https://ui-avatars.com/api/?name=Budi+Santoso&background=10b981&color=fff'
  },
  { 
    id: '2', 
    name: 'Siti Aminah, S.Pd', 
    role: 'teacher', 
    nip: '199005052015022003', 
    username: 'siti', 
    password: '123',
    gender: 'female',
    employmentStatus: 'PNS',
    position: 'Guru Kelas 1',
    workUnit: 'SDN JAMBU',
    avatar: 'https://ui-avatars.com/api/?name=Siti+Aminah&background=f59e0b&color=fff'
  },
];

export const initializeData = () => {
  if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
  }
};

// --- DEVICE LOCK LOGIC ---
// Fungsi ini mengecek apakah device ini sudah dipakai oleh user ID yang berbeda hari ini
export const validateDeviceUsage = (userId: string): { allowed: boolean; message?: string } => {
    const today = new Date().toISOString().split('T')[0];
    const storedLock = localStorage.getItem(DEVICE_LOCK_KEY);
    
    if (storedLock) {
        const { date, usedBy } = JSON.parse(storedLock);
        // Jika tanggal sama DAN user yang login beda dengan user yang tercatat -> BLOKIR
        if (date === today && usedBy !== userId) {
            return { 
                allowed: false, 
                message: 'Perangkat ini sudah digunakan absen oleh akun lain hari ini. 1 Perangkat hanya untuk 1 Guru.' 
            };
        }
    }
    return { allowed: true };
};

// Fungsi untuk mencatat bahwa device ini dipakai oleh user ini hari ini
export const registerDeviceUsage = (userId: string) => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(DEVICE_LOCK_KEY, JSON.stringify({
        date: today,
        usedBy: userId
    }));
};
// -------------------------

// --- API HELPER ---
const postToGAS = async (payload: any) => {
    if (!GAS_WEB_APP_URL) return;
    
    try {
        await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.warn("Background sync failed (Network/CORS):", error);
    }
};

// --- FETCH DATA FROM CSV (New & Fast Method) ---
export const fetchGlobalRecords = async (): Promise<AttendanceRecord[]> => {
  if (!REKAP_SHEET_URL) return getAllRecords(); 

  try {
    const response = await fetch(`${REKAP_SHEET_URL}&t=${Date.now()}`); // Cache busting
    if (!response.ok) throw new Error("Failed to fetch CSV");
    
    const text = await response.text();
    const lines = text.split('\n').filter(l => l.trim() !== '');
    
    if (lines.length === 0) return getAllRecords();

    // Regex untuk split CSV handling koma dalam kutip
    const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    // 1. Analisa Baris Pertama untuk Menentukan Mapping
    // Kita cek apakah baris pertama ini Header atau Data
    const firstRowCols = lines[0].split(csvRegex).map(s => s.trim().replace(/^"|"$/g, '').toLowerCase());
    
    let isHeaderRow = false;
    let idx = {
        userId: -1, userName: -1, date: -1, time: -1, action: -1, location: -1, locationLat: -1, locationLong: -1, notes: -1, sppdActivity: -1, sppdDest: -1
    };

    // Deteksi Header Standar
    if (firstRowCols.some(c => c.includes('nama') || c.includes('date') || c.includes('tanggal'))) {
        isHeaderRow = true;
        idx.userId = firstRowCols.findIndex(h => h.includes('id') || h.includes('nip'));
        idx.userName = firstRowCols.findIndex(h => h.includes('nama') || h.includes('name'));
        idx.date = firstRowCols.findIndex(h => h.includes('tanggal') || h.includes('date'));
        idx.time = firstRowCols.findIndex(h => h.includes('jam') || h.includes('time') || h.includes('waktu'));
        idx.action = firstRowCols.findIndex(h => h.includes('action') || h.includes('jenis') || h.includes('tipe') || h.includes('type') || h.includes('status'));
        idx.location = firstRowCols.findIndex(h => h.includes('lokasi') || h.includes('location'));
        idx.notes = firstRowCols.findIndex(h => h.includes('catatan') || h.includes('note') || h.includes('ket'));
        idx.sppdActivity = firstRowCols.findIndex(h => h.includes('kegiatan') || h.includes('activity'));
        idx.sppdDest = firstRowCols.findIndex(h => h.includes('tujuan') || h.includes('dest'));
    } 
    // Deteksi Data Tanpa Header (Berdasarkan Log Bapak)
    else {
        // Mapping Hardcoded sesuai urutan di Log
        idx = {
            userId: 4,      // Index 4: NIP/ID
            userName: 5,    // Index 5: Nama
            date: 1,        // Index 1: Tanggal (YYYY-MM-DD)
            time: 2,        // Index 2: Jam
            action: 3,      // Index 3: Status (Datang/Pulang)
            locationLat: 7, // Index 7: Lat
            locationLong: 8,// Index 8: Long
            notes: 6,       // Index 6: Gelar/Catatan (S.Pd) - Kita gabung ke nama atau notes
            location: -1,   // Kita pakai Lat/Long terpisah
            sppdActivity: -1,
            sppdDest: -1
        };
    }

    if (idx.date === -1) {
        console.warn("CSV Format Unknown", firstRowCols);
        return getAllRecords();
    }

    // 2. Parsing Baris & Agregasi Data
    const recordMap = new Map<string, AttendanceRecord>();
    const dataLines = isHeaderRow ? lines.slice(1) : lines; 

    dataLines.forEach(line => {
        const cols = line.split(csvRegex).map(s => s.trim().replace(/^"|"$/g, ''));
        
        const userId = cols[idx.userId] || 'unknown';
        const dateRaw = cols[idx.date]; 
        
        if (!dateRaw) return;

        // Ambil tanggal saja (antisipasi jika ada jam di kolom tanggal)
        const date = dateRaw.split(' ')[0]; 

        const key = `${userId}-${date}`;

        let name = cols[idx.userName] || 'Tanpa Nama';
        // Khusus format data Bapak: Jika kolom 6 ada (Gelar), gabungkan ke nama agar rapi
        if (!isHeaderRow && cols[6] && cols[6].length < 10) {
            name = `${name}, ${cols[6]}`; 
        }

        if (!recordMap.has(key)) {
            recordMap.set(key, {
                id: key,
                userId: userId,
                userName: name,
                date: date,
                type: 'present', 
                location: '',
                notes: ''
            });
        }

        const record = recordMap.get(key)!;
        const action = (cols[idx.action] || '').toLowerCase();
        const time = cols[idx.time];
        let notes = idx.notes > -1 ? cols[idx.notes] : '';

        // Handle Location Construction safely
        let locationStr = '';
        if (idx.location > -1) {
            locationStr = cols[idx.location] || '';
        } else if (idx.locationLat > -1 && idx.locationLong > -1) {
            const rawLat = cols[idx.locationLat] || '';
            const rawLong = cols[idx.locationLong] || '';
            
            if (rawLat && rawLong) {
                 const lat = rawLat.replace(/lat:/i, '').replace(/"/g, '').trim();
                 const long = rawLong.replace(/long:/i, '').replace(/"/g, '').trim();
                 locationStr = `${lat}, ${long}`;
            }
        }
        
        // Logika Penggabungan
        if (action.includes('checkin') || action.includes('datang') || action.includes('masuk')) {
            record.checkInTime = time;
            record.location = locationStr || record.location;
            record.type = 'present';
            // Jika ada info jarak di kolom 9 (khusus data Bapak), masukkan ke notes jika notes kosong
            if (!isHeaderRow && cols[9]) {
               notes = notes ? `${notes} (Jarak: ${cols[9]})` : `Jarak: ${cols[9]}`;
            }
            if (notes) record.notes = notes;
        } 
        else if (action.includes('checkout') || action.includes('pulang')) {
            record.checkOutTime = time;
            if (!record.location && locationStr) record.location = locationStr;
        } 
        else if (action.includes('sakit')) {
            record.type = 'sick';
            record.notes = notes;
        } 
        else if (action.includes('izin') || action.includes('leave')) {
            record.type = 'leave';
            record.notes = notes;
        } 
        else if (action.includes('sppd') || action.includes('dinas')) {
            record.type = 'sppd';
            const activity = idx.sppdActivity > -1 ? cols[idx.sppdActivity] : notes;
            const dest = idx.sppdDest > -1 ? cols[idx.sppdDest] : '';
            
            record.sppdData = {
                activityType: activity,
                activityDetail: notes,
                destination: dest,
                startDate: date, 
                endDate: date,   
                resultReport: '',
                attachments: [] 
            };
        }
    });

    return Array.from(recordMap.values());

  } catch (e) {
    console.warn("Gagal mengambil data CSV (menggunakan data offline):", e);
    return getAllRecords(); 
  }
};

const fetchUsersFromSheet = async (): Promise<MockUser[] | null> => {
    if (!GOOGLE_SHEET_URL) return null;
    
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        if (!response.ok) throw new Error("Failed to fetch sheet");
        
        const text = await response.text();
        const lines = text.split('\n').filter(l => l.trim() !== '');
        
        if (lines.length < 2) return null; 

        // Normalize headers
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s/g, ''));
        
        const idx = {
            id: headers.indexOf('id'),
            name: headers.indexOf('name'),
            role: headers.indexOf('role'),
            nip: headers.indexOf('nip'),
            username: headers.indexOf('username'),
            password: headers.indexOf('password'),
            gender: headers.indexOf('gender'),
            status: headers.indexOf('employmentstatus'),
            position: headers.indexOf('position'),
            unit: headers.indexOf('workunit'),
            // Tambahan: Deteksi kolom avatar/foto
            avatar: headers.indexOf('avatar') > -1 ? headers.indexOf('avatar') : headers.indexOf('foto')
        };

        if (idx.username === -1 || idx.password === -1) {
            return null;
        }

        const parsedUsers: MockUser[] = lines.slice(1).map(line => {
            const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.trim().replace(/^"|"$/g, ''));
            
            const rawRole = cols[idx.role]?.toLowerCase() || '';
            const isPrincipal = rawRole.includes('kepala') || rawRole.includes('principal') || rawRole.includes('kepsek') || rawRole.includes('ks');
            
            const rawGender = cols[idx.gender]?.toLowerCase() || '';
            const isFemale = rawGender.includes('perempuan') || rawGender.includes('wanita') || rawGender === 'female' || rawGender === 'p';

            return {
                id: cols[idx.id] || Math.random().toString(36).substr(2, 9),
                name: cols[idx.name] || 'Tanpa Nama',
                role: (isPrincipal ? 'principal' : 'teacher') as UserRole,
                nip: cols[idx.nip] || '',
                username: cols[idx.username] || '',
                password: cols[idx.password] || '',
                gender: (isFemale ? 'female' : 'male'),
                employmentStatus: cols[idx.status] || '',
                position: cols[idx.position] || '',
                workUnit: cols[idx.unit] || 'SDN JAMBU',
                // Ambil link avatar jika kolom tersedia
                avatar: idx.avatar > -1 ? cols[idx.avatar] : undefined
            };
        });

        return parsedUsers.filter(u => u.username && u.password); 

    } catch (error) {
        console.warn("Error fetching users from Sheet:", error);
        return null;
    }
};

export const loginUser = async (username: string, password: string, requiredRole?: UserRole): Promise<User | null> => {
  const sheetUsers = await fetchUsersFromSheet();
  if (sheetUsers && sheetUsers.length > 0) {
      localStorage.setItem(USERS_KEY, JSON.stringify(sheetUsers));
  } else {
      initializeData();
  }
  await new Promise(resolve => setTimeout(resolve, 800));
  const users: MockUser[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  
  if (user) {
    if (requiredRole) {
        if (requiredRole === 'teacher') {
            if (user.role !== 'teacher' && user.role !== 'principal') return null;
        } else {
            if (user.role !== requiredRole) return null;
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  return null;
};

export const getTodayRecord = (userId: string): AttendanceRecord | undefined => {
  const records: AttendanceRecord[] = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');
  const today = new Date().toISOString().split('T')[0];
  return records.find(r => r.userId === userId && r.date === today);
};

export const getUserHistory = (userId: string): AttendanceRecord[] => {
  const records: AttendanceRecord[] = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');
  return records
    .filter(r => r.userId === userId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getAllTodayRecords = (): AttendanceRecord[] => {
  const records: AttendanceRecord[] = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');
  const today = new Date().toISOString().split('T')[0];
  return records.filter(r => r.date === today);
};

export const getAllRecords = (): AttendanceRecord[] => {
  const records: AttendanceRecord[] = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');
  return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const saveAttendance = (record: AttendanceRecord): void => {
  const records: AttendanceRecord[] = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');
  const index = records.findIndex(r => r.id === record.id);
  if (index >= 0) {
    records[index] = record;
  } else {
    records.push(record);
  }
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
};

export const markCheckIn = async (user: User, location: string, photo: string, distance: string): Promise<AttendanceRecord> => {
  // 1. FINAL CHECK: Device Lock
  const deviceCheck = validateDeviceUsage(user.id);
  if (!deviceCheck.allowed) {
      throw new Error(deviceCheck.message);
  }

  // 2. CHECK: Prevent Duplicate Check-In (Absen 1 Kali Sehari)
  const existingRecord = getTodayRecord(user.id);
  if (existingRecord) {
     if (existingRecord.type === 'present' && existingRecord.checkInTime) {
        throw new Error("Anda sudah melakukan absen datang hari ini. Absen hanya dapat dilakukan 1 kali sehari.");
     }
     if (['sick', 'leave', 'sppd'].includes(existingRecord.type)) {
        throw new Error("Anda sudah tercatat Izin/Sakit/SPPD hari ini.");
     }
  }

  await new Promise(resolve => setTimeout(resolve, 800));
  const todayDate = new Date();
  const today = todayDate.toISOString().split('T')[0];
  const time = todayDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  
  const limit = new Date();
  limit.setHours(7, 30, 0, 0);
  
  let notes = "";
  if (todayDate > limit) {
      const diffMs = todayDate.getTime() - limit.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      notes = `TELAT ${diffMins} Menit`;
  }

  const newRecord: AttendanceRecord = {
    id: `${user.id}-${today}`,
    userId: user.id,
    userName: user.name,
    date: today,
    checkInTime: time,
    type: 'present',
    location,
    photo,
    notes: notes,
  };
  
  saveAttendance(newRecord);
  
  // LOCK DEVICE untuk User ini
  registerDeviceUsage(user.id);

  postToGAS({
    action: 'checkin',
    typeLabel: 'Datang',
    userId: user.id,
    userName: user.name,
    nip: user.nip || '-',
    date: today,
    time: time,
    location: location,
    distance: distance,
    photo: photo, 
    notes: notes
  });

  return newRecord;
};

export const markCheckOut = async (user: User, location: string, photo: string, distance: string): Promise<AttendanceRecord | null> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  const record = getTodayRecord(user.id);
  
  if (!record || !record.checkInTime) return null;

  const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const today = new Date().toISOString().split('T')[0];
  
  const updatedRecord = { 
    ...record, 
    checkOutTime: time,
    location: location
  };
  
  saveAttendance(updatedRecord);

  postToGAS({
    action: 'checkout',
    typeLabel: 'Pulang',
    userId: user.id,
    userName: user.name,
    nip: user.nip || '-', 
    date: today,
    time: time,
    location: location,
    distance: distance,
    photo: photo
  });

  return updatedRecord;
};

export const submitReport = async (
  user: User, 
  type: AttendanceType, 
  notes: string, 
  sppdData?: SppdData,
  attachment?: string,
  startDate?: string,
  endDate?: string
): Promise<AttendanceRecord> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const today = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const existing = getTodayRecord(user.id);
  
  let recordToSave: AttendanceRecord;

  if (existing) {
    recordToSave = {
      ...existing,
      type: sppdData ? 'sppd' : (type === 'present' ? existing.type : type), 
      notes: notes || existing.notes,
      sppdData: sppdData || existing.sppdData,
      attachment: attachment || existing.attachment,
      leaveStartDate: startDate || existing.leaveStartDate,
      leaveEndDate: endDate || existing.leaveEndDate
    };
  } else {
    recordToSave = {
      id: `${user.id}-${today}`,
      userId: user.id,
      userName: user.name,
      date: today,
      checkInTime: time, 
      type: sppdData ? 'sppd' : type,
      notes: notes,
      sppdData: sppdData,
      attachment: attachment,
      leaveStartDate: startDate,
      leaveEndDate: endDate
    };
  }

  saveAttendance(recordToSave);

  if (type === 'sppd' && sppdData) {
      postToGAS({
          action: 'sppd',
          userId: user.id,
          userName: user.name,
          nip: user.nip || '-',
          sppd: sppdData, 
          attachments: sppdData.attachments 
      });
  } else if (type === 'sick' || type === 'leave') {
      postToGAS({
          action: type,
          userId: user.id,
          userName: user.name,
          nip: user.nip || '-',
          startDate: startDate,
          endDate: endDate,
          notes: notes,
          attachment: attachment 
      });
  }

  return recordToSave;
};

export const downloadMonthlyReport = (startDate: string, endDate: string) => {
  const records: AttendanceRecord[] = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');
  
  const filteredRecords = records.filter(r => {
    return r.date >= startDate && r.date <= endDate;
  });

  filteredRecords.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.userName.localeCompare(b.userName);
  });

  // Helper agar koma dalam data tidak merusak kolom CSV
  const escapeCsv = (data: any) => {
      if (data === null || data === undefined) return '""';
      const str = String(data);
      // Ganti kutip satu (") jadi dua ("") dan bungkus seluruh teks dengan kutip
      return `"${str.replace(/"/g, '""')}"`;
  };
  
  const header = [
      'Tanggal', 'Nama Guru', 'NIP', 'Status', 
      'Masuk', 'Pulang', 'Lokasi', 'Catatan/Info SPPD', 
      'Mulai Izin', 'Selesai Izin'
  ].map(escapeCsv);

  const rows = filteredRecords.map(r => {
    let noteContent = r.notes || '';
    if (r.sppdData) {
        noteContent = `SPPD: ${r.sppdData.activityType} di ${r.sppdData.destination}`;
    }

    return [
        escapeCsv(r.date),
        escapeCsv(r.userName),
        escapeCsv(r.userId), 
        escapeCsv(r.type.toUpperCase()),
        escapeCsv(r.checkInTime || '-'),
        escapeCsv(r.checkOutTime || '-'),
        escapeCsv(r.location || '-'),
        escapeCsv(noteContent),
        escapeCsv(r.leaveStartDate || (r.sppdData ? r.sppdData.startDate : '-')),
        escapeCsv(r.leaveEndDate || (r.sppdData ? r.sppdData.endDate : '-'))
    ];
  });

  const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `laporan_absensi_sdn_jambu_${startDate}_sd_${endDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};