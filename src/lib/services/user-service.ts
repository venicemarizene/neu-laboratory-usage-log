'use client';

import { Firestore, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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

const ADMIN_EMAIL = 'venicemarizene.linga@neu.edu.ph';

/**
 * Service to manage user profiles in Firestore.
 */
export const UserService = {
  /**
   * Retrieves a user's profile from the 'users' collection.
   */
  async getProfile(db: Firestore, uid: string): Promise<UserMetadata | null> {
    const docRef = doc(db, 'users', uid);
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as UserMetadata;
      }
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'get'
        }));
      }
      throw error;
    }
    return null;
  },

  /**
   * Synchronizes user metadata. 
   * Authoritative Logic: Enforces the specific Admin email.
   * Only 'venicemarizene.linga@neu.edu.ph' can be an admin.
   */
  async syncProfile(db: Firestore, user: FirebaseUser, requestedRole: 'professor' | 'admin'): Promise<UserMetadata> {
    const docRef = doc(db, 'users', user.uid);
    const userEmail = (user.email || '').toLowerCase().trim();
    
    // Determine the authoritative role
    let finalRole: 'professor' | 'admin' = 'professor';
    if (userEmail === ADMIN_EMAIL) {
      finalRole = 'admin';
    } else {
      // Force anyone else to be a professor even if they requested admin role
      finalRole = 'professor';
    }

    try {
      const userSnap = await getDoc(docRef);

      if (userSnap.exists()) {
        const existingData = userSnap.data() as UserMetadata;
        
        // Corrective logic: If the admin email is currently a professor in DB, upgrade it.
        // If a non-admin email is currently an admin in DB, downgrade it.
        if (existingData.role !== finalRole) {
          await updateDoc(docRef, { role: finalRole });
          return { ...existingData, role: finalRole };
        }
        
        return existingData;
      }

      // Profile doesn't exist, create it with the enforced role
      const newProfile: UserMetadata = {
        id: user.uid,
        email: userEmail,
        role: finalRole,
        status: 'active',
        createdAt: serverTimestamp()
      };

      await setDoc(docRef, newProfile).catch(err => {
        if (err.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'create',
            requestResourceData: newProfile
          }));
        }
        throw err;
      });
      
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
