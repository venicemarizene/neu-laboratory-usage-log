'use client';

import { Firestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';

/**
 * Represents the metadata stored for each user in the system.
 */
export interface UserMetadata {
  id: string;
  email: string;
  role: 'professor' | 'admin';
  status: 'active' | 'blocked';
  createdAt: string;
}

export const UserService = {
  /**
   * Retrieves user metadata from the 'users' collection.
   */
  async getProfile(db: Firestore, uid: string): Promise<UserMetadata | null> {
    const docRef = doc(db, 'users', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserMetadata;
    }
    return null;
  },

  /**
   * Synchronizes user metadata. Automatically creates a record if it doesn't exist.
   */
  async syncProfile(db: Firestore, user: FirebaseUser, role: 'professor' | 'admin'): Promise<UserMetadata> {
    const existing = await this.getProfile(db, user.uid);
    
    // If the profile exists, we return it. We don't overwrite the role or status 
    // to prevent unauthorized role escalation or unblocking.
    if (existing) return existing;

    // For new users, create the initial profile.
    const newProfile: UserMetadata = {
      id: user.uid,
      email: user.email || '',
      role: role,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    const docRef = doc(db, 'users', user.uid);
    await setDoc(docRef, newProfile, { merge: true });

    return newProfile;
  },

  /**
   * Checks if a user's account is blocked.
   */
  async isBlocked(db: Firestore, uid: string): Promise<boolean> {
    const profile = await this.getProfile(db, uid);
    return profile?.status === 'blocked';
  }
};
