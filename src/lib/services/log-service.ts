
'use client';

import { Firestore, collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy, limit } from 'firebase/firestore';

/**
 * Service to manage laboratory usage logs in Firestore.
 */
export const LogService = {
  /**
   * Starts a new laboratory session.
   * Automatically terminates any existing active sessions for this professor first.
   */
  async startSession(db: Firestore, email: string, room: string) {
    // 1. Terminate any dangling active sessions for this professor
    await this.endActiveSession(db, email);

    // 2. Create the new session record
    const logData = {
      professorEmail: email,
      roomNumber: room,
      loginTime: new Date().toISOString(),
      logoutTime: null,
      duration: 0,
      status: 'active'
    };
    return addDoc(collection(db, 'logs'), logData);
  },

  /**
   * Finds the professor's current active session and marks it as completed.
   * Calculates duration in minutes.
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
        
        // Calculate duration in minutes (rounded)
        const duration = Math.max(1, Math.round((logoutTime.getTime() - loginTime.getTime()) / 60000));
        
        return updateDoc(doc(db, 'logs', activeLog.id), {
          logoutTime: logoutTime.toISOString(),
          duration: duration,
          status: 'completed'
        });
      });

      await Promise.all(updatePromises);
    } catch (error) {
      console.error("Error ending active sessions:", error);
    }
  }
};
