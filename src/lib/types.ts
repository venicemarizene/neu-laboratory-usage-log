export type UserRole = 'Admin' | 'Professor';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  blocked: boolean;
  qrString: string;
  createdAt: number;
}

export interface RoomLog {
  id: string;
  professorName: string;
  roomNumber: string;
  timestamp: number;
  status: 'Active';
}

export interface UsageStats {
  totalUsesToday: number;
  totalUniqueProfessors: number;
  totalBlockedUsers: number;
}
