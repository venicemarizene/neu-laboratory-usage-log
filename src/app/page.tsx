
"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle, LogIn, Monitor, QrCode, Loader2, ShieldCheck, UserCircle, LogOut, Info } from 'lucide-react';
import { useAuth, useUser, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

  const syncUserProfile = (userId: string, data: any) => {
    if (!firestore) return;
    const userRef = doc(firestore, 'user_profiles', userId);
    
    const profileData: any = {
      id: userId,
      name: data.name || data.displayName || 'Anonymous Faculty',
      email: data.email,
      role: data.role || 'Professor',
      isBlocked: false,
      qrString: data.role === 'Admin' ? `ADMIN_${userId.slice(0,5)}` : `PROF_${userId.slice(0,5)}`
    };

    // Use non-blocking utilities to update profile in background
    setDocumentNonBlocking(userRef, profileData, { merge: true });

    if (data.role === 'Admin') {
      const adminRoleRef = doc(firestore, 'roles_admin', userId);
      setDocumentNonBlocking(adminRoleRef, { active: true }, { merge: true });
    }
  };

  const handleGoogleSignIn = async (targetRole: 'admin' | 'professor') => {
    if (!auth || !firestore) return;
    setIsLoggingIn(true);
    
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ 
      prompt: 'select_account'
    });

    try {
      const result = await signInWithPopup(auth, provider);
      const userEmail = result.user.email?.toLowerCase();
      const isInstitutional = !!userEmail?.match(/@([^@]+\.)?neu\.edu\.ph$/i);

      if (!isInstitutional) {
        await signOut(auth);
        toast({
          variant: 'destructive',
          title: 'Institutional Account Required',
          description: 'Access is restricted to official @neu.edu.ph Google accounts.',
        });
        return;
      }

      syncUserProfile(result.user.uid, {
        name: result.user.displayName,
        email: result.user.email,
        role: targetRole === 'admin' ? 'Admin' : 'Professor'
      });

      toast({
        title: 'Institutional Access Granted',
        description: `Authenticated as ${targetRole}. Redirecting...`,
      });
      
      router.push(`/${targetRole === 'admin' ? 'admin' : 'professor'}`);

    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') return;
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: error.message || 'An unexpected error occurred during institutional sign-in.',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      toast({ title: 'Signed out', description: 'Institutional session ended.' });
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
      }, 1500);

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
      router.push('/admin');
    } else if (qrString.startsWith('PROF')) {
      router.push('/professor');
    } else {
      toast({ variant: 'destructive', title: 'Invalid Token', description: 'Institutional QR code not recognized.' });
    }
    stopScanning();
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-6 text-center animate-in fade-in duration-300">
        <div className="space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl transform transition-transform duration-200 hover:scale-105">
            <Monitor className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary font-headline">NEU LabTrack</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Institutional Laboratory Management</p>
        </div>

        {user && (
          <div className="p-3 bg-card border rounded-xl shadow-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center font-bold text-primary shadow-inner text-xs">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold leading-none">{user.displayName || 'Faculty'}</p>
                <p className="text-[10px] text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-8 text-[10px] text-destructive hover:bg-destructive/10 transition-all duration-200">
              <LogOut className="w-3 h-3 mr-1" />
              Sign Out
            </Button>
          </div>
        )}

        <Card className="border-none shadow-2xl overflow-hidden rounded-2xl">
          <Tabs defaultValue="professor" className="w-full">
            <TabsList className="w-full grid grid-cols-2 rounded-none h-14 bg-muted/30">
              <TabsTrigger value="professor" className="data-[state=active]:bg-card data-[state=active]:shadow-sm flex items-center gap-2 text-sm font-semibold transition-all duration-200">
                <UserCircle className="w-4 h-4" />
                Professor
              </TabsTrigger>
              <TabsTrigger value="admin" className="data-[state=active]:bg-card data-[state=active]:shadow-sm flex items-center gap-2 text-sm font-semibold transition-all duration-200">
                <ShieldCheck className="w-4 h-4" />
                Admin Portal
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="professor" className="p-6 space-y-6 m-0">
              <div className="space-y-4">
                <Alert variant="default" className="bg-primary/5 border-primary/20 py-4 text-left">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm font-medium">
                    Institutional Google accounts required for faculty entry.
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={() => handleGoogleSignIn('professor')}
                  disabled={isLoggingIn}
                  className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-md flex items-center justify-center gap-3 transition-all duration-200 active:scale-95"
                >
                  {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                  Sign In with Institutional Google
                </Button>
              </div>
              
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[10px] font-bold uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Quick Access</span>
                </div>
              </div>

              <QRScannerDialog trigger={
                <Button 
                  variant="outline" 
                  onClick={startScanning}
                  className="w-full h-14 border-2 hover:bg-accent hover:text-accent-foreground font-bold flex items-center justify-center gap-3 transition-all duration-200 active:scale-95"
                >
                  <QrCode className="w-5 h-5" />
                  Scan Professor QR
                </Button>
              } onStop={stopScanning} videoRef={videoRef} hasCameraPermission={hasCameraPermission} isScanning={isScanning} />
            </TabsContent>

            <TabsContent value="admin" className="p-6 space-y-6 m-0">
              <div className="space-y-4">
                <Alert variant="default" className="bg-primary/5 border-primary/20 py-4 text-left">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm font-medium">
                    Admin privileges are tied to verified institutional identities.
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={() => handleGoogleSignIn('admin')}
                  disabled={isLoggingIn}
                  className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-md flex items-center justify-center gap-3 transition-all duration-200 active:scale-95"
                >
                  {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                  Admin Portal Google Sign-In
                </Button>
              </div>
              
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[10px] font-bold uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Admin QR Entry</span>
                </div>
              </div>

              <QRScannerDialog trigger={
                <Button 
                  variant="outline" 
                  onClick={startScanning}
                  className="w-full h-14 border-2 hover:bg-accent hover:text-accent-foreground font-bold flex items-center justify-center gap-3 transition-all duration-200 active:scale-95"
                >
                  <QrCode className="w-5 h-5" />
                  Scan Admin Access QR
                </Button>
              } onStop={stopScanning} videoRef={videoRef} hasCameraPermission={hasCameraPermission} isScanning={isScanning} />
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-xs font-medium text-muted-foreground">
          Verified <span className="text-primary font-bold">@neu.edu.ph</span> Google accounts are required.
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
            Point your camera at your institutional QR code for instant entry.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center space-y-4 py-4">
          <div className="relative w-full aspect-square max-w-[280px] overflow-hidden rounded-2xl border-4 border-dashed border-primary/20 bg-black flex items-center justify-center shadow-2xl">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
            {hasCameraPermission === false && (
              <div className="z-10 text-white text-center p-6 bg-black/60 backdrop-blur-sm h-full w-full flex flex-col items-center justify-center">
                <AlertCircle className="w-10 h-10 mx-auto mb-4 text-destructive" />
                <p className="text-base font-bold mb-2">Camera Access Required</p>
              </div>
            )}
            {isScanning && hasCameraPermission && (
              <div className="absolute inset-0 z-20 pointer-events-none border-[4px] border-accent/60 animate-pulse m-8 rounded-xl" />
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            Waiting for institutional token...
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
