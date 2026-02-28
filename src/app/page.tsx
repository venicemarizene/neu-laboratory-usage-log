
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LogIn, ShieldCheck, Microscope, QrCode, Camera, Loader2, AlertCircle } from 'lucide-react';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const router = useRouter();
  const { auth, firestore } = useAuth() ? { auth: useAuth(), firestore: useFirestore() } : { auth: null, firestore: null };
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!isUserLoading && user) {
      if (user.email?.endsWith('@neu.edu.ph')) {
        // In a real app, we'd check the 'role' field in Firestore
        // For this prototype, we'll just check if it's an admin email or default to professor
        if (user.email === 'admin@neu.edu.ph') {
          router.push('/admin');
        } else {
          router.push('/professor');
        }
      }
    }
  }, [user, isUserLoading, router]);

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
      console.error('Sign-in error:', error);
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
        // Mocking a successful scan of a professor's QR string
        const mockScannedQR = 'PROF_QR_101'; 
        handleQRLogin(mockScannedQR);
      }, 3000);

    } catch (error) {
      console.error('Camera error:', error);
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

  const handleQRLogin = async (qrString: string) => {
    if (!firestore) return;
    
    // In a real implementation, we would call a Cloud Function to issue a custom token
    // For this prototype, we simulate the validation and redirect
    const q = query(collection(firestore, 'user_profiles'), where('qrString', '==', qrString), limit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      if (userData.isBlocked) {
        toast({
          variant: 'destructive',
          title: 'Access Blocked',
          description: 'Your account has been restricted by an administrator.',
        });
        stopScanning();
        return;
      }

      toast({
        title: 'QR Code Validated',
        description: `Welcome back, ${userData.name}!`,
      });
      
      // Simulate login by navigating (Real login would happen via custom token)
      router.push(userData.role === 'Admin' ? '/admin' : '/professor');
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid QR Code',
        description: 'The scanned QR code is not recognized.',
      });
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
            <Microscope className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-primary font-headline">NEU Lab Log</h1>
          <p className="text-muted-foreground">Institutional Laboratory Access Management System</p>
        </div>

        <Card className="border-none shadow-xl">
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>
              Sign in with your institutional Google account or use your personal QR code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <Dialog onOpenChange={(open) => !open && stopScanning()}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  onClick={startScanning}
                  className="w-full h-12 border-2 hover:bg-accent transition-all flex items-center justify-center gap-3"
                >
                  <QrCode className="w-5 h-5 text-accent-foreground" />
                  Sign in with QR Code
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Scan Access Token</DialogTitle>
                  <DialogDescription>
                    Point your camera at your institutional QR code to sign in automatically.
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
                  
                  {!hasCameraPermission && hasCameraPermission !== null && (
                    <Alert variant="destructive">
                      <AlertTitle>Camera Error</AlertTitle>
                      <AlertDescription>
                        Please allow camera access in your browser settings to use QR login.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <p className="text-sm text-muted-foreground">
                    Scanning for valid institutional QR tokens...
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          By continuing, you agree to follow the institutional laboratory safety protocols and data usage policies. Only <strong>@neu.edu.ph</strong> accounts are authorized.
        </p>
      </div>
    </div>
  );
}
