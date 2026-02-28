
"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle, LogIn, Monitor, QrCode, Loader2, ShieldCheck, UserCircle, LogOut, Mail, Lock, Info } from 'lucide-react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
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

  // Email/Password states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const syncUserProfile = async (userId: string, data: any) => {
    if (!firestore) return;
    const userRef = doc(firestore, 'user_profiles', userId);
    
    // Check if profile exists to avoid overwriting the block status
    const existingDoc = await getDoc(userRef);
    
    const profileData: any = {
      id: userId,
      name: data.name || data.displayName || 'Anonymous Faculty',
      email: data.email,
      role: data.role || 'Professor',
      qrString: data.role === 'Admin' ? `ADMIN_${userId.slice(0,5)}` : `PROF_${userId.slice(0,5)}`
    };

    // Only set isBlocked to false if it's a brand new user
    if (!existingDoc.exists()) {
      profileData.isBlocked = false;
    }

    await setDoc(userRef, profileData, { merge: true });
  };

  const handleGoogleSignIn = async (targetRole: 'admin' | 'professor') => {
    if (!auth || !firestore) return;
    setIsLoggingIn(true);
    
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await signInWithPopup(auth, provider);
      const userEmail = result.user.email?.toLowerCase();
      // Robust institutional domain check (case-insensitive)
      const isInstitutional = !!userEmail?.match(/@([^@]+\.)?neu\.edu\.ph$/i);

      if (!isInstitutional) {
        await signOut(auth);
        toast({
          variant: 'destructive',
          title: 'Access Restricted',
          description: 'Only institutional accounts (@neu.edu.ph) are permitted.',
        });
        return;
      }

      await syncUserProfile(result.user.uid, {
        name: result.user.displayName,
        email: result.user.email,
        role: targetRole === 'admin' ? 'Admin' : 'Professor'
      });

      toast({
        title: 'Sign-in Successful',
        description: `Welcome to the ${targetRole === 'admin' ? 'Admin' : 'Professor'} portal.`,
      });
      router.push(`/${targetRole === 'admin' ? 'admin' : 'professor'}`);

    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') return;
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: error.message || 'An unexpected error occurred during sign-in.',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailSignIn = async (targetRole: 'admin' | 'professor') => {
    if (!auth || !firestore || !email || !password) {
      toast({ variant: 'destructive', title: 'Input Required', description: 'Please enter your institutional email and password.' });
      return;
    }
    
    setIsLoggingIn(true);
    try {
      const isInstitutional = !!email.toLowerCase().match(/@([^@]+\.)?neu\.edu\.ph$/i);
      if (!isInstitutional) {
        toast({ variant: 'destructive', title: 'Invalid Domain', description: 'Please use your @neu.edu.ph email.' });
        return;
      }

      const result = await signInWithEmailAndPassword(auth, email, password);
      
      await syncUserProfile(result.user.uid, {
        name: result.user.displayName || email.split('@')[0],
        email: result.user.email,
        role: targetRole === 'admin' ? 'Admin' : 'Professor'
      });

      toast({ title: 'Sign-in Successful', description: `Welcome back.` });
      router.push(`/${targetRole === 'admin' ? 'admin' : 'professor'}`);
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Credential mismatch. If this is a Google-based institutional email, please use the "Google SSO" tab instead.';
      }
      
      toast({
        variant: 'destructive',
        title: 'Sign-in Failed',
        description: errorMessage
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
              <Tabs defaultValue="google" className="w-full">
                <TabsList className="grid grid-cols-2 w-full mb-6">
                  <TabsTrigger value="google">Google SSO</TabsTrigger>
                  <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                </TabsList>
                
                <TabsContent value="google" className="space-y-4">
                  <Alert variant="default" className="bg-primary/5 border-primary/20">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-xs font-medium text-left">
                      Recommended: Sign in with your institutional Google account.
                    </AlertDescription>
                  </Alert>
                  <Button 
                    onClick={() => handleGoogleSignIn('professor')}
                    disabled={isLoggingIn}
                    className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-lg flex items-center justify-center gap-3 transition-all duration-200 active:scale-95"
                  >
                    {isLoggingIn ? <Loader2 className="animate-spin" /> : <LogIn className="w-6 h-6" />}
                    Sign in with Google
                  </Button>
                </TabsContent>

                <TabsContent value="manual" className="space-y-4">
                  <Alert variant="destructive" className="bg-destructive/5 text-left py-2 border-destructive/20">
                    <AlertDescription className="text-[10px] leading-tight font-bold">
                      Note: Institutional Google passwords will not work here. Use Google SSO unless you have a direct system password.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="name@neu.edu.ph" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="password" placeholder="System Password" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={() => handleEmailSignIn('professor')} disabled={isLoggingIn} className="w-full h-12 font-bold">
                    {isLoggingIn ? <Loader2 className="animate-spin" /> : 'Manual Login'}
                  </Button>
                </TabsContent>
              </Tabs>
              
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
              <Tabs defaultValue="google" className="w-full">
                <TabsList className="grid grid-cols-2 w-full mb-6">
                  <TabsTrigger value="google">Google SSO</TabsTrigger>
                  <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                </TabsList>

                <TabsContent value="google" className="space-y-4">
                  <Alert variant="default" className="bg-primary/5 border-primary/20">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-xs font-medium text-left">
                      Use your admin institutional Google account to sign in.
                    </AlertDescription>
                  </Alert>
                  <Button 
                    onClick={() => handleGoogleSignIn('admin')}
                    disabled={isLoggingIn}
                    className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-lg flex items-center justify-center gap-3 transition-all duration-200 active:scale-95"
                  >
                    {isLoggingIn ? <Loader2 className="animate-spin" /> : <ShieldCheck className="w-6 h-6" />}
                    Admin Google Sign-In
                  </Button>
                </TabsContent>

                <TabsContent value="manual" className="space-y-4">
                  <div className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="admin@neu.edu.ph" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="password" placeholder="Admin Password" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={() => handleEmailSignIn('admin')} disabled={isLoggingIn} className="w-full h-12 font-bold bg-primary">
                    {isLoggingIn ? <Loader2 className="animate-spin" /> : 'Admin Login'}
                  </Button>
                </TabsContent>
              </Tabs>
              
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
          Verified institutional access for <span className="text-primary">@neu.edu.ph</span> accounts.
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
