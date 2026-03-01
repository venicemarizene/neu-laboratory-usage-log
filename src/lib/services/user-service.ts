'use client';

import { Firestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';

/**
 * Interface representing user metadata stored in Firestore.
 */
export interface UserMetadata {
  id: string;
  email: string;
  role: 'professor' | 'admin';
  status: 'active' | 'blocked';
  createdAt: any;
}

/**
 * Service to manage user profiles in Firestore.
 */
export const UserService = {
  /**
   * Retrieves a user's profile from the 'users' collection.
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
    
    // If user exists, return existing profile to prevent role/status overwriting
    if (existing) return existing;

    // For new users, create the profile with initial metadata
    const newProfile: UserMetadata = {
      id: user.uid,
      email: user.email || '',
      role: role,
      status: 'active',
      createdAt: serverTimestamp()
    };

    const docRef = doc(db, 'users', user.uid);
    await setDoc(docRef, newProfile, { merge: true });

    return newProfile;
  },

  /**
   * Checks if a specific user account is blocked.
   */
  async isBlocked(db: Firestore, uid: string): Promise<boolean> {
    const profile = await this.getProfile(db, uid);
    return profile?.status === 'blocked';
  }
};
