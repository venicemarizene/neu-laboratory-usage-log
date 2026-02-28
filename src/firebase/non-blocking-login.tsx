
'use client';

/**
 * Utility for authentication operations. 
 * Strictly restricted to official Google SSO for institutional accounts.
 */

import {
  Auth,
  signOut
} from 'firebase/auth';

/**
 * Centralized sign out logic.
 */
export async function performSignOut(authInstance: Auth): Promise<void> {
  await signOut(authInstance);
}
