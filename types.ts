export type UserRole = 'teacher' | 'principal';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  nip?: string;
  username: string;
  gender: 'male' | 'female';
  employmentStatus?: string;
  position?: string;
  workUnit?: string;
  avatar?: string; // URL foto profil dari spreadsheet
}

export type AttendanceType = 'present' | 'sick' | 'leave' | 'sppd';

export interface SppdData {
  activityType: string;
  activityDetail: string;
  destination: string;
  startDate: string;
  endDate: string;
  resultReport: string;
  attachments: string[]; // Array of Base64 strings
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:mm
  checkOutTime?: string; // HH:mm
  type: AttendanceType;
  notes?: string; // For sickness/leave description
  sppdData?: SppdData; // Replaces lkpdContent
  location?: string;
  photo?: string; // Base64 string of the selfie
  attachment?: string; // Base64 string of proof for sick/leave
  leaveStartDate?: string;
  leaveEndDate?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  dashboardMode?: UserRole; // Defines which dashboard view to show
}