import { Firestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Professor';
  isBlocked: boolean;
  qrString: string;
}

export const UserService = {
  /**
   * Retrieves a user profile from Firestore.
   */
  async getProfile(db: Firestore, uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, 'user_profiles', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  },

  /**
   * Synchronizes a user's Google Auth data with their Firestore profile.
   * Only creates a profile if it doesn't exist.
   */
  async syncProfile(db: Firestore, user: User, targetRole: 'Admin' | 'Professor'): Promise<UserProfile> {
    const existing = await this.getProfile(db, user.uid);
    if (existing) return existing;

    const newProfile: UserProfile = {
      id: user.uid,
      name: user.displayName || 'Faculty Member',
      email: user.email || '',
      role: targetRole,
      isBlocked: false,
      qrString: targetRole === 'Admin' ? `ADMIN_${user.uid.slice(0, 5)}` : `PROF_${user.uid.slice(0, 5)}`
    };

    const docRef = doc(db, 'user_profiles', user.uid);
    await setDoc(docRef, newProfile, { merge: true });

    if (targetRole === 'Admin') {
      const adminRoleRef = doc(db, 'roles_admin', user.uid);
      await setDoc(adminRoleRef, { active: true }, { merge: true });
    }

    return newProfile;
  },

  /**
   * Checks if a user is currently blocked.
   */
  async isBlocked(db: Firestore, uid: string): Promise<boolean> {
    const profile = await this.getProfile(db, uid);
    return profile?.isBlocked === true;
  }
};
