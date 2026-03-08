
'use client';

import { Firestore, collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, Timestamp, orderBy } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export const LogService = {
  /**
   * Starts a new laboratory session for a professor.
   */
  async startRoomSession(db: Firestore, email: string, room: string) {
    // End any existing active sessions first
    await this.endActiveRoomSession(db, email);

    const logData = {
      professorEmail: email,
      room: room,
      timeIn: serverTimestamp(),
      timeOut: null,
      status: 'active'
    };

    try {
      return await addDoc(collection(db, 'roomLogs'), logData);
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'roomLogs',
          operation: 'create',
          requestResourceData: logData
        }));
      }
      throw err;
    }
  },

  /**
   * Ends active room sessions for a specific professor.
   */
  async endActiveRoomSession(db: Firestore, email: string) {
    const q = query(
      collection(db, 'roomLogs'),
      where('professorEmail', '==', email),
      where('status', '==', 'active')
    );
    
    try {
      const querySnapshot = await getDocs(q);
      const updatePromises = querySnapshot.docs.map((logDoc) => {
        return updateDoc(doc(db, 'roomLogs', logDoc.id), {
          timeOut: serverTimestamp(),
          status: 'completed'
        });
      });
      await Promise.all(updatePromises);
    } catch (err: any) {
      console.error("Error ending active sessions:", err);
    }
  }
};
