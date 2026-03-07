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
        const contextualError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'get'
        });
        errorEmitter.emit('permission-error', contextualError);
      }
      throw error;
    }
    return null;
  },

  /**
   * Synchronizes user metadata. 
   * Authoritative Logic: Enforces the specific Admin email.
   */
  async syncProfile(db: Firestore, user: FirebaseUser, requestedRole: 'professor' | 'admin'): Promise<UserMetadata> {
    const docRef = doc(db, 'users', user.uid);
    const userEmail = (user.email || '').toLowerCase().trim();
    
    let finalRole: 'professor' | 'admin' = 'professor';
    if (userEmail === ADMIN_EMAIL) {
      finalRole = 'admin';
    } else {
      finalRole = 'professor';
    }

    try {
      const userSnap = await getDoc(docRef);

      if (userSnap.exists()) {
        const existingData = userSnap.data() as UserMetadata;
        
        if (existingData.role !== finalRole) {
          await updateDoc(docRef, { role: finalRole }).catch(err => {
            if (err.code === 'permission-denied') {
              errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: { role: finalRole }
              }));
            }
          });
          return { ...existingData, role: finalRole };
        }
        
        return existingData;
      }

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
    } catch (error: any) {
      if (error.code === 'permission-denied' && !error.message.includes('denied by Firestore Security Rules')) {
         errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'get'
        }));
      }
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
