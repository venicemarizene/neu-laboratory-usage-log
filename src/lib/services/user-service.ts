
'use client';

import { Firestore, doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
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
   * Synchronizes user metadata by email. Used for QR identification.
   */
  async syncProfileByEmail(db: Firestore, email: string): Promise<UserMetadata> {
    const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()));
    try {
      const snap = await getDocs(q);
      
      if (snap.empty) {
        throw new Error("No professor record found for this QR code.");
      }
      
      return snap.docs[0].data() as UserMetadata;
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'users',
          operation: 'list'
        }));
      }
      throw error;
    }
  },

  /**
   * Allows Admin to pre-provision a professor account.
   */
  async addProfessor(db: Firestore, email: string): Promise<void> {
    const cleanEmail = email.toLowerCase().trim();
    // Use email as doc ID for manual additions until they log in via Google
    const docRef = doc(db, 'users', cleanEmail);
    
    const newProfile: UserMetadata = {
      id: cleanEmail,
      email: cleanEmail,
      role: 'professor',
      status: 'active',
      qrValue: cleanEmail,
      createdAt: serverTimestamp()
    };

    return setDoc(docRef, newProfile).catch(err => {
      if (err.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'create',
          requestResourceData: newProfile
        }));
      }
      throw err;
    });
  },

  /**
   * Synchronizes user metadata. 
   */
  async syncProfile(db: Firestore, user: FirebaseUser): Promise<UserMetadata> {
    const userEmail = (user.email || '').toLowerCase().trim();
    const docRef = doc(db, 'users', user.uid);
    
    try {
      // 1. Check if UID-based document already exists
      const userSnap = await getDoc(docRef);

      if (userSnap.exists()) {
        const existingData = userSnap.data() as UserMetadata;
        
        // Ensure Admin role is synced
        if (userEmail === ADMIN_EMAIL && existingData.role !== 'admin') {
          await updateDoc(docRef, { role: 'admin' });
          return { ...existingData, role: 'admin' };
        }
        
        return existingData;
      }

      // 2. Check if a pre-provisioned email-based document exists
      const emailQ = query(collection(db, 'users'), where('email', '==', userEmail));
      const emailSnap = await getDocs(emailQ);

      let baseData: Partial<UserMetadata> = {};
      if (!emailSnap.empty) {
        const preProvisioned = emailSnap.docs[0].data() as UserMetadata;
        baseData = preProvisioned;
        // Delete the pre-provisioned doc if it was using email as ID
        if (emailSnap.docs[0].id === userEmail) {
          await deleteDoc(doc(db, 'users', userEmail));
        }
      }

      const finalRole: 'professor' | 'admin' = userEmail === ADMIN_EMAIL ? 'admin' : (baseData.role || 'professor');

      const newProfile: UserMetadata = {
        ...baseData,
        id: user.uid,
        email: userEmail,
        role: finalRole,
        status: baseData.status || 'active',
        qrValue: baseData.qrValue || userEmail, 
        createdAt: baseData.createdAt || serverTimestamp()
      };

      await setDoc(docRef, newProfile);
      return newProfile;
    } catch (error: any) {
      if (error.code === 'permission-denied') {
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
