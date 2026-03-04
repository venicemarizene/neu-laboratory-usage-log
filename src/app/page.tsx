
"use client";

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Monitor, Loader2, ShieldCheck, UserCircle, LogOut, Info, QrCode, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AuthService } from '@/lib/services/auth-service';
import { UserService } from '@/lib/services/user-service';
import { collection, addDoc } from 'firebase/firestore';

/**
 * Main Landing Page with One-Touch QR Entry.
 * Allows professors to log room usage directly from the landing page.
 * Enhanced to support "One-Touch" authentication + logging flow for signed-out users.
 */
export default function Home(props: { params: Promise<any>; searchParams: Promise<any> }) {
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState('professor');

  // QR Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [detectedRoom, setDetectedRoom] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const roomList = Array.from({ length: 11 }, (_, i) => `M${101 + i}`);

  /**
   * Universal Login Flow with Intent-Based Role Assignment.
   */
  const handleGoogleLogin = async () => {
    if (!auth || !firestore) return;
    setIsLoggingIn(true);

    const intendedRole = activeTab as 'professor' | 'admin';

    try {
      const signedInUser = await AuthService.signInWithGoogle(auth);
      
      if (!signedInUser) {
        setIsLoggingIn(false);
        return;
      }

      const email = (signedInUser.email || '').toLowerCase().trim();

      if (!email.endsWith("@neu.edu.ph")) {
        alert("Only NEU emails are allowed!");
        await AuthService.logout(auth);
        setIsLoggingIn(false);
        return;
      }

      const profile = await UserService.syncProfile(firestore, signedInUser, intendedRole);

      if (profile.status === 'blocked') {
        alert("Your account has been blocked. Please contact the administrator.");
        await AuthService.logout(auth);
        setIsLoggingIn(false);
        return;
      }

      toast({ title: 'Authenticated', description: `Welcome, ${signedInUser.displayName}` });
      
      if (profile.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/professor');
      }
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast({
          variant: 'destructive',
          title: 'Authentication Error',
          description: error.message || 'Failed to sign in.',
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  /**
   * Processes QR detection. 
   * If not authenticated, triggers login first, then performs instant room entry.
   */
  const handleQRDetected = async (room: string) => {
    setDetectedRoom(room);
    let currentUser = user;

    if (!currentUser) {
      if (!auth || !firestore) return;
      
      setIsLoggingIn(true);
      try {
        const signedInUser = await AuthService.signInWithGoogle(auth);
        
        if (!signedInUser) {
          setIsLoggingIn(false);
          setDetectedRoom(null);
          return;
        }

        const email = (signedInUser.email || '').toLowerCase().trim();
        if (!email.endsWith("@neu.edu.ph")) {
          alert("Only NEU emails are allowed!");
          await AuthService.logout(auth);
          setIsLoggingIn(false);
          setDetectedRoom(null);
          return;
        }

        const profile = await UserService.syncProfile(firestore, signedInUser, 'professor');

        if (profile.status === 'blocked') {
          alert("Your account has been blocked.");
          await AuthService.logout(auth);
          setIsLoggingIn(false);
          setDetectedRoom(null);
          return;
        }

        currentUser = signedInUser;
      } catch (error: any) {
        setIsLoggingIn(false);
        setDetectedRoom(null);
        return;
      } finally {
        setIsLoggingIn(false);
      }
    }

    // Record the entry
    try {
      const logData = {
        professorId: currentUser.uid,
        professorName: currentUser.displayName || currentUser.email || 'Professor',
        roomNumber: room,
        timestamp: new Date().toISOString(),
        status: 'Active'
      };
      
      await addDoc(collection(firestore, 'room_logs'), logData);
      
      toast({ title: "Entry Recorded", description: `Auto-logged into ${room}` });
      stopScanning();
      router.push(`/professor?room=${room}&auto=true`);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to record entry.' });
    }
  };

  const startScanning = async () => {
    setIsScanning(true);
    setDetectedRoom(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      // Simulation of a QR room detection: pick a random room from M101-M111
      const randomRoom = roomList[Math.floor(Math.random() * roomList.length)];
      setTimeout(() => handleQRDetected(randomRoom), 2000);
    } catch (error) {
      setHasCameraPermission(false);
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
    setDetectedRoom(null);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      await AuthService.logout(auth);
      toast({ title: 'Signed Out', description: 'You have been disconnected.' });
    }
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
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl">
            <Monitor className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary font-headline">NEU LabTrack</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Institutional Laboratory Management</p>
        </div>

        {user && (
          <div className="p-3 bg-card border rounded-xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center font-bold text-primary shadow-inner text-xs">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold leading-none">{user.displayName || 'Staff'}</p>
                <p className="text-[10px] text-muted-foreground font-medium">{user.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-8 text-[10px] text-destructive hover:bg-destructive/10">
              <LogOut className="w-3 h-3 mr-1" />
              Sign Out
            </Button>
          </div>
        )}

        <Card className="border-none shadow-2xl overflow-hidden rounded-2xl bg-card">
          <Tabs defaultValue="professor" onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-2 rounded-none h-14 bg-muted/30">
              <TabsTrigger value="professor" className="flex items-center gap-2 text-sm font-semibold">
                <UserCircle className="w-4 h-4" />
                Professor
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="w-4 h-4" />
                Admin
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="professor" className="p-6 space-y-6 m-0">
              <div className="space-y-4 text-left">
                <Alert className="bg-primary/5 border border-primary/20">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm font-medium">
                    Use your @neu.edu.ph account. Scan a room QR code for instant entry.
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-1 gap-3">
                  <Button 
                    onClick={handleGoogleLogin}
                    disabled={isLoggingIn}
                    className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-md gap-3"
                  >
                    {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <Monitor className="w-5 h-5" />}
                    Sign in with Google
                  </Button>

                  <Dialog onOpenChange={(o) => !o && stopScanning()}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        onClick={startScanning}
                        className="w-full h-14 text-lg font-bold border-2 gap-3"
                      >
                        <QrCode className="w-5 h-5 text-primary" />
                        One-Touch QR Entry
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Instant Room Entry</DialogTitle>
                        <DialogDescription>
                          Scan the laboratory QR code. If you aren't signed in, you'll be prompted to authenticate to complete the entry.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="aspect-square relative rounded-2xl bg-black overflow-hidden border-4 border-muted shadow-2xl">
                        <video 
                          ref={videoRef} 
                          className="absolute inset-0 w-full h-full object-cover" 
                          autoPlay 
                          muted 
                          playsInline 
                        />
                        
                        {detectedRoom && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center backdrop-blur-[2px] z-10">
                            <div className="text-center bg-white p-6 rounded-2xl shadow-2xl animate-in zoom-in duration-300">
                              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                              <p className="font-black text-primary text-xl">Lab {detectedRoom} Detected</p>
                              {isLoggingIn ? (
                                <div className="mt-4 flex flex-col items-center gap-2">
                                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                  <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Authenticating...</p>
                                </div>
                              ) : (
                                <p className="text-sm font-medium text-muted-foreground mt-1">Completing Entry...</p>
                              )}
                            </div>
                          </div>
                        )}

                        {hasCameraPermission === false && (
                          <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white p-6 text-center">
                            <div>
                              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-destructive" />
                              <p className="font-bold">Camera access required</p>
                              <p className="text-xs text-muted-foreground mt-1">Please enable camera permissions in your browser.</p>
                            </div>
                          </div>
                        )}

                        <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                          <div className="w-full h-full border-2 border-accent/50 rounded-lg animate-pulse" />
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="admin" className="p-6 space-y-4 m-0">
              <div className="space-y-4 text-left">
                <Alert className="bg-accent/5 border border-accent/20">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  <AlertDescription className="text-sm font-medium">
                    Authenticate as an Administrator. Institutional access required.
                  </AlertDescription>
                </Alert>
                
                <Button 
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-md gap-3"
                >
                  {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                  Admin Google Login
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-xs font-medium text-muted-foreground">
          Institutional <span className="text-primary font-bold">@neu.edu.ph</span> domain enforced.
        </p>
      </div>
    </div>
  );
}
