import { Auth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';

export const AuthService = {
  /**
   * Initiates Google Sign-In with Popup.
   */
  async signInWithGoogle(auth: Auth): Promise<User | null> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    return result.user;
  },

  /**
   * Signs the current user out.
   */
  async logout(auth: Auth): Promise<void> {
    await signOut(auth);
  }
};
