import type { UserProfile, RoomLog, UsageStats } from './types';

// Using static timestamps to prevent hydration mismatches during development
const BASE_TIME = 1740000000000; // Fixed timestamp for consistency

export const MOCK_USERS: UserProfile[] = [
  {
    uid: 'admin-1',
    name: 'Admin User',
    email: 'admin@neu.edu',
    role: 'Admin',
    blocked: false,
    qrString: 'ADMIN_QR_001',
    createdAt: BASE_TIME - 86400000 * 30,
  },
  {
    uid: 'prof-1',
    name: 'Dr. Jane Smith',
    email: 'j.smith@neu.edu',
    role: 'Professor',
    blocked: false,
    qrString: 'PROF_QR_101',
    createdAt: BASE_TIME - 86400000 * 10,
  },
  {
    uid: 'prof-2',
    name: 'Prof. Alan Turing',
    email: 'a.turing@neu.edu',
    role: 'Professor',
    blocked: true,
    qrString: 'PROF_QR_102',
    createdAt: BASE_TIME - 86400000 * 5,
  },
  {
    uid: 'prof-3',
    name: 'Dr. Grace Hopper',
    email: 'g.hopper@neu.edu',
    role: 'Professor',
    blocked: false,
    qrString: 'PROF_QR_103',
    createdAt: BASE_TIME - 86400000 * 2,
  },
];

export const MOCK_LOGS: RoomLog[] = [
  { id: '1', professorName: 'Dr. Jane Smith', roomNumber: 'Lab 101', timestamp: BASE_TIME - 3600000, status: 'Active' },
  { id: '2', professorName: 'Dr. Grace Hopper', roomNumber: 'Lab 204', timestamp: BASE_TIME - 7200000, status: 'Active' },
  { id: '3', professorName: 'Dr. Jane Smith', roomNumber: 'Lab 101', timestamp: BASE_TIME - 86400000, status: 'Active' },
  { id: '4', professorName: 'Dr. Grace Hopper', roomNumber: 'Lab 305', timestamp: BASE_TIME - 86400000 * 2, status: 'Active' },
];

export function getStats(): UsageStats {
  const today = new Date().setHours(0, 0, 0, 0);
  return {
    totalUsesToday: MOCK_LOGS.filter(l => l.timestamp >= today).length,
    totalUniqueProfessors: new Set(MOCK_LOGS.map(l => l.professorName)).size,
    totalBlockedUsers: MOCK_USERS.filter(u => u.blocked).length,
  };
}
