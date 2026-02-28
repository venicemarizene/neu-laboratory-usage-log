
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, Monitor, QrCode, Loader2, AlertCircle, ShieldCheck, UserCircle } from 'lucide-react';
import { useAuth, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function Home() {
  const router = useRouter();
  const { auth, firestore } = useAuth() ? { auth: useAuth(), firestore: useFirestore() } : { auth: null, firestore: null };
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Check if current user is an admin
  const adminRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'roles_admin', user.uid);
  }, [firestore, user]);
  const { data: adminRoleDoc, isLoading: isAdminCheckLoading } = useDoc(adminRef);

  // Redirect logic
  useEffect(() => {
    if (!isUserLoading && !isAdminCheckLoading && user) {
      if (user.email?.endsWith('@neu.edu.ph')) {
        // Grant admin access if email is specific admin email OR exists in roles_admin collection
        if (user.email === 'admin@neu.edu.ph' || adminRoleDoc) {
          router.push('/admin');
        } else {
          router.push('/professor');
        }
      }
    }
  }, [user, isUserLoading, isAdminCheckLoading, adminRoleDoc, router]);

  const handleGoogleSignIn = async () => {
    if (!auth) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'neu.edu.ph' });

    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;

      if (!email?.endsWith('@neu.edu.ph')) {
        await signOut(auth);
        toast({
          variant: 'destructive',
          title: 'Invalid Domain',
          description: 'Only institutional accounts (@neu.edu.ph) are allowed.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Authentication Failed',
        description: error.message || 'Could not complete sign-in.',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const startScanning = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Simulate scanning a QR code after 3 seconds
      setTimeout(async () => {
        const mockScannedQR = 'ADMIN_QR_001'; // Simulated scan
        handleQRLogin(mockScannedQR);
      }, 3000);

    } catch (error) {
      setHasCameraPermission(false);
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const handleQRLogin = (qrString: string) => {
    if (!firestore) return;
    
    // In this prototype, we'll use mock validation for the QR scanner
    // In a real app, this would call a secure Cloud Function or verified Firestore document
    if (qrString === 'ADMIN_QR_001') {
      toast({ title: 'Admin QR Validated', description: 'Welcome, Administrator.' });
      router.push('/admin');
    } else if (qrString.startsWith('PROF')) {
      toast({ title: 'Professor QR Validated', description: 'Welcome, Professor.' });
      router.push('/professor');
    } else {
      toast({ variant: 'destructive', title: 'Invalid QR', description: 'Token not recognized.' });
    }
    stopScanning();
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg transform transition hover:scale-105">
            <Monitor className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-primary font-headline">NEU LabTrack</h1>
          <p className="text-muted-foreground">Institutional Computer Laboratory Management System</p>
        </div>

        <Card className="border-none shadow-xl overflow-hidden">
          <Tabs defaultValue="professor" className="w-full">
            <TabsList className="w-full grid grid-cols-2 rounded-none h-14 bg-muted/50">
              <TabsTrigger value="professor" className="data-[state=active]:bg-card flex items-center gap-2">
                <UserCircle className="w-4 h-4" />
                Professor
              </TabsTrigger>
              <TabsTrigger value="admin" className="data-[state=active]:bg-card flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Administrator
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="professor" className="p-6 space-y-4 m-0">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-xl">Staff Access</CardTitle>
                <CardDescription>Log in using your @neu.edu.ph account or scan your QR code.</CardDescription>
              </CardHeader>
              
              <Button 
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90 transition-all flex items-center justify-center gap-3"
              >
                {isLoggingIn ? <Loader2 className="animate-spin" /> : <LogIn className="w-5 h-5" />}
                Sign in with Google
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">OR</span>
                </div>
              </div>

              <QRScannerDialog trigger={
                <Button 
                  variant="outline" 
                  onClick={startScanning}
                  className="w-full h-12 border-2 hover:bg-accent transition-all flex items-center justify-center gap-3"
                >
                  <QrCode className="w-5 h-5" />
                  Scan Professor QR
                </Button>
              } onStop={stopScanning} videoRef={videoRef} hasCameraPermission={hasCameraPermission} isScanning={isScanning} />
            </TabsContent>

            <TabsContent value="admin" className="p-6 space-y-4 m-0">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-xl">Admin Portal</CardTitle>
                <CardDescription>Authorized laboratory oversight and management access.</CardDescription>
              </CardHeader>

              <Button 
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90 transition-all flex items-center justify-center gap-3"
              >
                {isLoggingIn ? <Loader2 className="animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                Admin Google Sign-In
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">OR</span>
                </div>
              </div>

              <QRScannerDialog trigger={
                <Button 
                  variant="outline" 
                  onClick={startScanning}
                  className="w-full h-12 border-2 hover:bg-accent transition-all flex items-center justify-center gap-3"
                >
                  <QrCode className="w-5 h-5" />
                  Scan Admin QR
                </Button>
              } onStop={stopScanning} videoRef={videoRef} hasCameraPermission={hasCameraPermission} isScanning={isScanning} />
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-xs text-muted-foreground">
          Access is restricted to authorized <strong>@neu.edu.ph</strong> personnel only.
        </p>
      </div>
    </div>
  );
}

interface QRScannerProps {
  trigger: React.ReactNode;
  onStop: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  hasCameraPermission: boolean | null;
  isScanning: boolean;
}

function QRScannerDialog({ trigger, onStop, videoRef, hasCameraPermission, isScanning }: QRScannerProps) {
  return (
    <Dialog onOpenChange={(open) => !open && onStop()}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Access Token</DialogTitle>
          <DialogDescription>
            Point your camera at your institutional QR code.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center space-y-4 py-4">
          <div className="relative w-full aspect-square max-w-[300px] overflow-hidden rounded-xl border-4 border-dashed border-muted bg-black flex items-center justify-center">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
            {!hasCameraPermission && hasCameraPermission !== null && (
              <div className="z-10 text-white text-center p-4">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-destructive" />
                <p className="text-sm font-medium">Camera access required</p>
              </div>
            )}
            {isScanning && (
              <div className="absolute inset-0 z-20 pointer-events-none border-2 border-accent animate-pulse m-8 rounded-lg" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Waiting for QR token detection...
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
