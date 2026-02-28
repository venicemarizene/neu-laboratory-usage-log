
"use client"

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectScrollUpButton, SelectScrollDownButton } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Monitor, LogOut, CheckCircle2, AlertTriangle, Loader2, ArrowRight, QrCode, Camera, AlertCircle } from 'lucide-react';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

export default function ProfessorPortal() {
  const router = useRouter();
  const { auth, firestore } = useAuth() ? { auth: useAuth(), firestore: useFirestore() } : { auth: null, firestore: null };
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [room, setRoom] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'blocked'>('idle');
  const [profileData, setProfileData] = useState<any>(null);
  
  // QR Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const roomList = Array.from({ length: 11 }, (_, i) => `M${101 + i}`);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user && firestore) {
        const docRef = doc(firestore, 'user_profiles', user.uid);
        getDoc(docRef)
          .then((snap) => {
            if (snap.exists()) {
              setProfileData(snap.data());
            }
          })
          .catch((err) => {
            const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'get',
            });
            errorEmitter.emit('permission-error', permissionError);
          });
      }
    };
    fetchProfile();
  }, [user, firestore]);

  const startScanning = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Simulate scanning a QR code for a room (e.g., M105) after 2.5 seconds
      setTimeout(() => {
        const mockScannedRoom = 'M105'; 
        handleQRDetected(mockScannedRoom);
      }, 2500);

    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions to scan lab codes.',
      });
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const handleQRDetected = (detectedRoom: string) => {
    if (roomList.includes(detectedRoom)) {
      setRoom(detectedRoom);
      toast({
        title: 'Lab Detected',
        description: `Laboratory ${detectedRoom} identified via QR scan.`,
      });
      // Automatically trigger entry after a small delay
      setTimeout(() => {
        setIsScanning(false);
        stopScanning();
        performEntry(detectedRoom);
      }, 500);
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid Code',
        description: 'The scanned QR code does not correspond to a valid computer lab.',
      });
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/');
    }
  };

  const performEntry = (selectedRoom: string) => {
    if (!selectedRoom) return;
    setIsProcessing(true);
    
    // Artificial delay to simulate processing/verification
    setTimeout(() => {
      if (profileData?.isBlocked) {
        setStatus('blocked');
        setIsProcessing(false);
        return;
      }

      if (firestore && user) {
        const logData = {
          professorId: user.uid,
          professorName: user.displayName || profileData?.name || 'Professor',
          roomNumber: selectedRoom,
          timestamp: new Date().toISOString(),
          status: 'Active'
        };
        
        addDoc(collection(firestore, 'room_logs'), logData)
          .then(() => {
            setStatus('success');
            setIsProcessing(false);
          })
          .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: 'room_logs',
              operation: 'create',
              requestResourceData: logData,
            });
            errorEmitter.emit('permission-error', permissionError);
            setIsProcessing(false);
          });
      }
    }, 1200);
  };

  const handleManualEntry = () => {
    performEntry(room);
  };

  const handleReset = () => {
    setStatus('idle');
    setRoom('');
  };

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-xl flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <Monitor className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-primary font-headline">NEU LabTrack</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </header>

      <main className="w-full max-w-xl space-y-6">
        <Card className="border-none shadow-xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Monitor className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Lab Entry System</CardTitle>
            <CardDescription>Select your laboratory manually or use a QR scan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {status === 'idle' && (
              <>
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Manual Selection</label>
                  <Select value={room} onValueChange={setRoom}>
                    <SelectTrigger className="h-14 text-lg border-2 border-primary/20 hover:border-primary/40 transition-colors shadow-sm">
                      <SelectValue placeholder="Select Lab (M101 - M111)" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectScrollUpButton />
                      {roomList.map((roomNum) => (
                        <SelectItem key={roomNum} value={roomNum} className="text-lg py-3 cursor-pointer">
                          Computer Laboratory {roomNum}
                        </SelectItem>
                      ))}
                      <SelectScrollDownButton />
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs font-bold uppercase">
                    <span className="bg-card px-3 text-muted-foreground">OR</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <Dialog onOpenChange={(open) => !open && stopScanning()}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        onClick={startScanning}
                        className="h-14 border-2 border-primary/20 hover:border-primary hover:bg-primary/5 font-bold gap-3 shadow-sm transition-all active:scale-95"
                      >
                        <QrCode className="w-5 h-5 text-primary" />
                        Scan Lab QR Code
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Laboratory QR Scanner</DialogTitle>
                        <DialogDescription>
                          Scan the QR code located at the lab entrance to automatically register your session.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col items-center justify-center space-y-6 py-6">
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center border-4 border-primary/20 shadow-2xl">
                          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
                          {hasCameraPermission === false && (
                            <div className="z-10 text-white text-center p-6 bg-black/60 backdrop-blur-sm h-full w-full flex flex-col items-center justify-center">
                              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
                              <p className="text-lg font-bold">Camera Access Required</p>
                              <p className="text-sm opacity-90">Please enable camera permissions in your browser settings to scan QR codes.</p>
                            </div>
                          )}
                          {isScanning && hasCameraPermission && (
                            <div className="absolute inset-0 z-20 pointer-events-none border-2 border-accent/40 animate-pulse m-8 rounded-lg">
                              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-accent" />
                              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-accent" />
                              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-accent" />
                              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-accent" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          Waiting for laboratory code...
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button 
                    onClick={handleManualEntry} 
                    disabled={!room || isProcessing}
                    className="h-16 text-xl font-black bg-primary hover:bg-primary/90 shadow-xl gap-3 transition-all active:scale-95 group"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    )}
                    {isProcessing ? 'Verifying...' : room ? `Enter Lab ${room}` : 'Select a Lab to Begin'}
                  </Button>
                </div>
              </>
            )}

            {status === 'success' && (
              <div className="text-center space-y-6 animate-in zoom-in-95 duration-500">
                <div className="p-10 bg-green-50 rounded-3xl border-2 border-green-200 space-y-6 shadow-inner">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg ring-8 ring-green-100">
                    <CheckCircle2 className="w-12 h-12 text-white" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-3xl font-black text-green-800 tracking-tight">Access Logged</h3>
                    <p className="text-green-700 font-bold text-xl leading-relaxed">
                      Thank you for using room <span className="underline decoration-green-400 decoration-4 underline-offset-4">{room}</span>.
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleReset} 
                  className="w-full h-14 text-lg font-bold border-2 hover:bg-slate-50 transition-all rounded-xl"
                >
                  Register Another Session
                </Button>
              </div>
            )}

            {status === 'blocked' && (
              <div className="text-center space-y-6 animate-in zoom-in-95 duration-500">
                <div className="p-8 bg-destructive/5 rounded-3xl border-2 border-destructive/20 space-y-4">
                  <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <AlertTriangle className="w-10 h-10 text-destructive" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-destructive tracking-tight">Account Restricted</h3>
                    <p className="text-muted-foreground font-medium text-lg px-4">Your faculty access has been temporarily suspended. Please visit the Laboratory Administrator's office for resolution.</p>
                  </div>
                </div>
                <Button variant="outline" onClick={handleReset} className="w-full h-14 text-lg font-bold border-2 rounded-xl">
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-card p-6 rounded-3xl shadow-lg border border-slate-100 flex items-center gap-5 transition-all hover:shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-accent text-primary flex items-center justify-center font-black text-2xl shadow-inner transform rotate-3">
            {user.displayName?.[0] || user.email?.[0]?.toUpperCase() || 'P'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-lg truncate">{user.displayName || profileData?.name || 'Faculty Member'}</p>
            <p className="text-sm text-muted-foreground font-medium truncate">{user.email}</p>
          </div>
          <Badge className="px-4 py-1.5 font-bold bg-primary/10 text-primary border-primary/20 rounded-lg">
            {profileData?.role || 'Professor'}
          </Badge>
        </div>
      </main>
    </div>
  );
}
