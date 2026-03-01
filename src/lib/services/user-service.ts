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
   * Includes debug logs for tracking execution flow.
   */
  async syncProfile(db: Firestore, user: FirebaseUser, requestedRole: 'professor' | 'admin'): Promise<UserMetadata> {
    console.log("Checking Firestore document existence for UID:", user.uid);
    const docRef = doc(db, 'users', user.uid);
    
    try {
      const userSnap = await getDoc(docRef);
      console.log("Firestore userSnap exists?", userSnap.exists());

      if (userSnap.exists()) {
        const data = userSnap.data() as UserMetadata;
        console.log("User data retrieved:", data);
        return data;
      }

      // If user does not exist, create new record
      console.log("Creating new user document for:", user.email);
      const newProfile: UserMetadata = {
        id: user.uid,
        email: (user.email || '').toLowerCase().trim(),
        role: requestedRole,
        status: 'active',
        createdAt: serverTimestamp()
      };

      await setDoc(docRef, newProfile);
      console.log("User document created successfully.");
      return newProfile;
    } catch (error) {
      console.error("Error in syncProfile:", error);
      throw error;
    }
  },

  /**
   * Checks if a specific user account is blocked.
   */
  async isBlocked(db: Firestore, uid: string): Promise<boolean> {
    const profile = await this.getProfile(db, uid);
    return profile?.status === 'blocked';
  }
};
