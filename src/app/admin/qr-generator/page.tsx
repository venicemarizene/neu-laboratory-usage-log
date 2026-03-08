"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RoomQRGenerator() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-muted-foreground font-bold italic">Redirecting to Dashboard...</p>
    </div>
  );
}
