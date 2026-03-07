'use client';

/**
 * Service to handle institutional email communications.
 * In production, this integrates with a backend mail server or 
 * Cloud Function (e.g., SendGrid/Firebase Mail).
 */
export const EmailService = {
  /**
   * Dispatches an identification QR code to a professor's institutional email.
   * @param email The target @neu.edu.ph email address.
   * @param qrDataUrl The Base64 encoded PNG image of the QR code.
   */
  async sendQREmail(email: string, qrDataUrl: string): Promise<boolean> {
    // Validate target domain
    if (!email.toLowerCase().endsWith('@neu.edu.ph')) {
      throw new Error('Non-institutional email detected.');
    }

    // Simulate secure transmission to the mail relay
    console.log(`[Email Service] Initializing secure transfer to ${email}...`);
    
    // Simulate realistic network latency for a transactional email
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Log the payload size for debugging (simulates server-side processing)
    const payloadSizeInKB = Math.round(qrDataUrl.length / 1024);
    console.log(`[Email Service] Success: QR ID (Size: ${payloadSizeInKB}KB) dispatched to ${email}`);
    
    return true;
  }
};
