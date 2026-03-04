'use client';

import { Firestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
   * Synchronizes user metadata. Automatically creates a record if it doesn't exist.
   * Updates the role if it differs from the requested intent (Dynamic Role Switching).
   */
  async syncProfile(db: Firestore, user: FirebaseUser, requestedRole: 'professor' | 'admin'): Promise<UserMetadata> {
    console.log("User after sign-in:", user.email, user.uid);
    console.log("Checking Firestore document existence...");
    
    const docRef = doc(db, 'users', user.uid);
    
    try {
      const userSnap = await getDoc(docRef);
      console.log("Firestore userSnap exists?", userSnap.exists());

      if (userSnap.exists()) {
        const existingData = userSnap.data() as UserMetadata;
        console.log("User data:", existingData);
        
        if (existingData.role !== requestedRole) {
          console.log(`Updating role from ${existingData.role} to ${requestedRole}`);
          await updateDoc(docRef, { role: requestedRole }).catch(err => {
            if (err.code === 'permission-denied') {
              errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: { role: requestedRole }
              }));
            }
            throw err;
          });
          existingData.role = requestedRole;
        }
        
        return existingData;
      }

      console.log("Creating new user document for:", user.email);
      const newProfile: UserMetadata = {
        id: user.uid,
        email: (user.email || '').toLowerCase().trim(),
        role: requestedRole,
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