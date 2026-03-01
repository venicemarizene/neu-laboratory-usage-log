
'use client';

import { 
  Auth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  signOut, 
  User 
} from 'firebase/auth';

export const AuthService = {
  /**
   * Authenticates a professor via Google Sign-In.
   */
  async signInWithGoogle(auth: Auth): Promise<User | null> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    return result.user;
  },

  /**
   * Authenticates an admin via Email/Password.
   */
  async signInWithEmail(auth: Auth, email: string, pass: string): Promise<User | null> {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  },

  /**
   * Terminates the current session.
   */
  async logout(auth: Auth): Promise<void> {
    await signOut(auth);
  }
};
