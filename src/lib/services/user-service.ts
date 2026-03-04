'use client';

import { Firestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
   * Updates the role if it differs from the requested intent (Dynamic Role Switching).
   */
  async syncProfile(db: Firestore, user: FirebaseUser, requestedRole: 'professor' | 'admin'): Promise<UserMetadata> {
    console.log("Syncing profile for:", user.email, "Intended Role:", requestedRole);
    
    const docRef = doc(db, 'users', user.uid);
    
    try {
      const userSnap = await getDoc(docRef);

      if (userSnap.exists()) {
        const existingData = userSnap.data() as UserMetadata;
        
        // Dynamic Role Switching: If the user intends to log in with a different role
        // than what is currently stored, we update the role in Firestore.
        if (existingData.role !== requestedRole) {
          console.log(`Updating role from ${existingData.role} to ${requestedRole}`);
          await updateDoc(docRef, { role: requestedRole });
          existingData.role = requestedRole;
        }
        
        return existingData;
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
