'use client';

/**
 * Mock service to simulate sending emails.
 * In a production environment, this would call a backend API 
 * (e.g., SendGrid, Mailgun, or Firebase Cloud Functions).
 */
export const EmailService = {
  /**
   * Simulates sending a QR code image to a specific email address.
   */
  async sendQREmail(email: string, qrDataUrl: string): Promise<boolean> {
    console.log(`[Mock Email Service] Sending QR Code to: ${email}`);
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // In a real app, you'd post the qrDataUrl to your server
    return true;
  }
};
