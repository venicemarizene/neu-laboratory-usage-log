
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
  qrValue?: string;
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
   */
  async syncProfile(db: Firestore, user: FirebaseUser): Promise<UserMetadata> {
    const docRef = doc(db, 'users', user.uid);
    const userEmail = (user.email || '').toLowerCase().trim();
    
    try {
      const userSnap = await getDoc(docRef);

      if (userSnap.exists()) {
        const existingData = userSnap.data() as UserMetadata;
        
        if (userEmail === ADMIN_EMAIL && existingData.role !== 'admin') {
          await updateDoc(docRef, { role: 'admin' }).catch(err => {
            if (err.code === 'permission-denied') {
              errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: { role: 'admin' }
              }));
            }
          });
          return { ...existingData, role: 'admin' };
        }
        
        return existingData;
      }

      const finalRole: 'professor' | 'admin' = userEmail === ADMIN_EMAIL ? 'admin' : 'professor';

      const newProfile: UserMetadata = {
        id: user.uid,
        email: userEmail,
        role: finalRole,
        status: 'active',
        qrValue: userEmail, // Initialize with email as requested
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
