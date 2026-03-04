'use client';

import { 
  Auth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  signOut, 
  User 
} from 'firebase/auth';

/**
 * Service to handle Firebase Authentication operations.
 */
export const AuthService = {
  /**
   * Authenticates a user via Google Sign-In using a popup window.
   */
  async signInWithGoogle(auth: Auth): Promise<User | null> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    return result.user;
  },

  /**
   * Authenticates a user via Email and Password for Admin credentials.
   */
  async signInWithEmail(auth: Auth, email: string, pass: string): Promise<User | null> {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  },

  /**
   * Terminates the current Firebase session.
   */
  async logout(auth: Auth): Promise<void> {
    await signOut(auth);
  }
};
