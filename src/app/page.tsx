
"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle, LogIn, Monitor, QrCode, Loader2, ShieldCheck, UserCircle, LogOut } from 'lucide-react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
  const router = useRouter();
  const { auth } = useAuth() ? { auth: useAuth() } : { auth: null };
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleGoogleSignIn = async (targetRole: 'admin' | 'professor') => {
    if (!auth || !firestore) return;
    setIsLoggingIn(true);
    
    // Removing hd: 'neu.edu.ph' to be more inclusive of subdomains (e.g. @student.neu.edu.ph)
    // which Google's hd parameter sometimes filters too strictly.
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ 
      prompt: 'select_account'
    });

    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email?.toLowerCase();

      // Flexible regex for any institutional subdomain under neu.edu.ph
      const isInstitutional = !!email?.match(/@(.+\.)?neu\.edu\.ph$/);

      if (!isInstitutional) {
        await signOut(auth);
        toast({
          variant: 'destructive',
          title: 'Access Restricted',
          description: 'Only institutional accounts (@neu.edu.ph) are permitted.',
        });
        return;
      }

      const userRef = doc(firestore, 'user_profiles', result.user.uid);
      await setDoc(userRef, {
        id: result.user.uid,
        name: result.user.displayName || 'Anonymous Faculty',
        email: result.user.email,
        role: targetRole === 'admin' ? 'Admin' : 'Professor',
        isBlocked: false,
        qrString: targetRole === 'admin' ? `ADMIN_${result.user.uid.slice(0,5)}` : `PROF_${result.user.uid.slice(0,5)}`
      }, { merge: true });

      toast({
        title: 'Sign-in Successful',
        description: `Welcome to the ${targetRole === 'admin' ? 'Admin' : 'Professor'} portal.`,
      });
      router.push(`/${targetRole === 'admin' ? 'admin' : 'professor'}`);

    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: error.message || 'An unexpected error occurred during sign-in.',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      toast({ title: 'Signed out', description: 'Session ended successfully.' });
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
      
      setTimeout(async () => {
        const mockScannedQR = 'ADMIN_QR_001'; 
        handleQRLogin(mockScannedQR);
      }, 800);

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
    if (qrString === 'ADMIN_QR_001') {
      toast({ title: 'Access Verified', description: 'Entering Administrator Panel.' });
      router.push('/admin');
    } else if (qrString.startsWith('PROF')) {
      toast({ title: 'Access Verified', description: 'Entering Professor Portal.' });
      router.push('/professor');
    } else {
      toast({ variant: 'destructive', title: 'Invalid Token', description: 'Institutional QR code not recognized.' });
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
          <div className="mx-auto w-20 h-20 bg-primary rounded-3xl flex items-center justify-center shadow-2xl transform transition-transform duration-200 hover:scale-110">
            <Monitor className="w-12 h-12 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-primary font-headline">NEU LabTrack</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-xs">NEU Computer Laboratory Usage Log</p>
        </div>

        {user && (
          <div className="p-4 bg-card border rounded-xl shadow-sm flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold text-primary shadow-inner">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold leading-none">{user.displayName || 'Faculty Member'}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <LogOut className="w-4 h-4 mr-1" />
              Sign Out
            </Button>
          </div>
        )}

        <Card className="border-none shadow-2xl overflow-hidden rounded-2xl">
          <Tabs defaultValue="professor" className="w-full">
            <TabsList className="w-full grid grid-cols-2 rounded-none h-16 bg-muted/30">
              <TabsTrigger value="professor" className="data-[state=active]:bg-card data-[state=active]:shadow-sm flex items-center gap-2 text-base font-semibold">
                <UserCircle className="w-5 h-5" />
                Professor
              </TabsTrigger>
              <TabsTrigger value="admin" className="data-[state=active]:bg-card data-[state=active]:shadow-sm flex items-center gap-2 text-base font-semibold">
                <ShieldCheck className="w-5 h-5" />
                Admin Portal
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="professor" className="p-8 space-y-6 m-0 animate-in fade-in duration-200">
              <div className="text-center space-y-2">
                <CardTitle className="text-2xl font-bold">Staff Portal</CardTitle>
                <CardDescription>Register your laboratory usage via Google or QR scanner.</CardDescription>
              </div>
              
              <Button 
                onClick={() => handleGoogleSignIn('professor')}
                disabled={isLoggingIn}
                className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-lg flex items-center justify-center gap-3 transition-all duration-200 active:scale-95"
              >
                {isLoggingIn ? <Loader2 className="animate-spin" /> : <LogIn className="w-6 h-6" />}
                Sign in with Google
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs font-bold uppercase">
                  <span className="bg-card px-3 text-muted-foreground">Quick Access</span>
                </div>
              </div>

              <QRScannerDialog trigger={
                <Button 
                  variant="outline" 
                  onClick={startScanning}
                  className="w-full h-14 border-2 hover:bg-accent hover:text-accent-foreground font-bold flex items-center justify-center gap-3 transition-all duration-200 active:scale-95"
                >
                  <QrCode className="w-6 h-6" />
                  Scan Professor QR
                </Button>
              } onStop={stopScanning} videoRef={videoRef} hasCameraPermission={hasCameraPermission} isScanning={isScanning} />
            </TabsContent>

            <TabsContent value="admin" className="p-8 space-y-6 m-0 animate-in fade-in duration-200">
              <div className="text-center space-y-2">
                <CardTitle className="text-2xl font-bold">Admin Portal</CardTitle>
                <CardDescription>Oversight and laboratory management for authorized personnel.</CardDescription>
              </div>

              <Button 
                onClick={() => handleGoogleSignIn('admin')}
                disabled={isLoggingIn}
                className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-lg flex items-center justify-center gap-3 transition-all duration-200 active:scale-95"
              >
                {isLoggingIn ? <Loader2 className="animate-spin" /> : <ShieldCheck className="w-6 h-6" />}
                Admin Google Sign-In
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs font-bold uppercase">
                  <span className="bg-card px-3 text-muted-foreground">Admin QR Login</span>
                </div>
              </div>

              <QRScannerDialog trigger={
                <Button 
                  variant="outline" 
                  onClick={startScanning}
                  className="w-full h-14 border-2 hover:bg-accent hover:text-accent-foreground font-bold flex items-center justify-center gap-3 transition-all duration-200 active:scale-95"
                >
                  <QrCode className="w-6 h-6" />
                  Scan Admin Access QR
                </Button>
              } onStop={stopScanning} videoRef={videoRef} hasCameraPermission={hasCameraPermission} isScanning={isScanning} />
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-sm font-medium text-muted-foreground">
          Institutional access for verified <span className="text-primary">@neu.edu.ph</span> accounts.
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
          <DialogTitle className="text-xl font-bold">Scan Access Token</DialogTitle>
          <DialogDescription>
            Point your camera at your institutional QR code.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center space-y-6 py-6">
          <div className="relative w-full aspect-square max-w-[320px] overflow-hidden rounded-2xl border-4 border-dashed border-primary/20 bg-black flex items-center justify-center shadow-2xl">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
            {hasCameraPermission === false && (
              <div className="z-10 text-white text-center p-6 bg-black/60 backdrop-blur-sm h-full w-full flex flex-col items-center justify-center">
                <AlertCircle className="w-14 h-14 mx-auto mb-4 text-destructive" />
                <p className="text-lg font-bold mb-2">Camera Access Required</p>
                <p className="text-sm opacity-90">Please enable camera permissions.</p>
              </div>
            )}
            {isScanning && hasCameraPermission && (
              <div className="absolute inset-0 z-20 pointer-events-none border-[6px] border-accent/60 animate-pulse m-10 rounded-xl" />
            )}
          </div>
          <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Waiting for token detection...
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
