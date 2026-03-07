
'use client';

import { Firestore, collection, addDoc, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Service to manage laboratory usage logs in Firestore.
 * Handles automatic session completion and duration calculations.
 */
export const LogService = {
  /**
   * Starts a new laboratory session for a professor.
   * Automatically ends any existing active session for that professor.
   */
  async startSession(db: Firestore, email: string, room: string) {
    // Authoritative check: close previous sessions before starting a new one
    await this.endActiveSession(db, email);

    const logData = {
      professorEmail: email,
      roomNumber: room,
      loginTime: new Date().toISOString(),
      logoutTime: null,
      duration: 0,
      status: 'active'
    };

    return addDoc(collection(db, 'logs'), logData).catch(err => {
      if (err.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'logs',
          operation: 'create',
          requestResourceData: logData
        }));
      }
      throw err;
    });
  },

  /**
   * Finds and completes all active laboratory sessions for a specific professor.
   * Calculates the final duration in minutes.
   */
  async endActiveSession(db: Firestore, email: string) {
    const q = query(
      collection(db, 'logs'),
      where('professorEmail', '==', email),
      where('status', '==', 'active')
    );
    
    try {
      const querySnapshot = await getDocs(q);
      
      const updatePromises = querySnapshot.docs.map(async (activeLog) => {
        const data = activeLog.data();
        const loginTime = new Date(data.loginTime);
        const logoutTime = new Date();
        
        // Calculate duration in minutes, minimum 1 minute
        const duration = Math.max(1, Math.round((logoutTime.getTime() - loginTime.getTime()) / 60000));
        
        const updateData = {
          logoutTime: logoutTime.toISOString(),
          duration: duration,
          status: 'completed'
        };

        return updateDoc(doc(db, 'logs', activeLog.id), updateData).catch(err => {
          if (err.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: `logs/${activeLog.id}`,
              operation: 'update',
              requestResourceData: updateData
            }));
          }
        });
      });

      await Promise.all(updatePromises);
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'logs',
          operation: 'list'
        }));
      }
      console.error("Error ending active sessions:", err);
    }
  }
};
