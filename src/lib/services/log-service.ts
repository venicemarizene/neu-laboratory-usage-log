'use client';

import { Firestore, collection, addDoc, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Service to manage laboratory usage logs in Firestore.
 */
export const LogService = {
  /**
   * Starts a new laboratory session.
   */
  async startSession(db: Firestore, email: string, room: string) {
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
   * Ends active sessions for a professor.
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
