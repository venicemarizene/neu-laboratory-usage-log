
"use client"

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Monitor, LogOut, CheckCircle2, AlertTriangle, Loader2, ArrowRight, QrCode, AlertCircle } from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/services/auth-service';

/**
 * Enhanced Professor Portal for laboratory entry logging.
 * Features a minimized but accessible welcome experience and One-Touch QR support.
 */
export default function ProfessorPortal(props: { params: Promise<any>; searchParams: Promise<any> }) {
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [room, setRoom] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'blocked'>('idle');
  
  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  
  const { data: userData, isLoading: isUserDataLoading } = useDoc(userRef);
  
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const roomList = Array.from({ length: 11 }, (_, i) => `M${101 + i}`);

  useEffect(() => {
    if (isUserLoading || isUserDataLoading) return;

    if (!user) {
      router.push('/');
      return;
    }
    
    // Handle Auto-Log success state from Home page scan
    if (searchParams.auto === 'true' && searchParams.room) {
      setRoom(searchParams.room);
      setStatus('success');
      return;
    }

    if (userData?.status === 'blocked') {
      setStatus('blocked');
      AuthService.logout(auth!).then(() => router.push('/'));
    }
  }, [user, userData, isUserLoading, isUserDataLoading, router, auth, searchParams]);

  const handleSignOut = async () => {
    if (auth) {
      await AuthService.logout(auth);
      router.push('/');
    }
  };

  const performEntry = (selectedRoom: string) => {
    if (!selectedRoom || !firestore || !user) return;
    setIsProcessing(true);
    
    const logData = {
      professorId: user.uid,
      professorName: user.displayName || userData?.email || 'Professor',
      roomNumber: selectedRoom,
      timestamp: new Date().toISOString(),
      status: 'Active'
    };
    
    addDoc(collection(firestore, 'room_logs'), logData)
      .then(() => {
        setStatus('success');
        setIsProcessing(false);
        toast({
          title: "Entry Logged",
          description: `Laboratory ${selectedRoom} session started.`,
        });
      })
      .catch(async () => {
        const permissionError = new FirestorePermissionError({
          path: 'room_logs',
          operation: 'create',
          requestResourceData: logData,
        });
        errorEmitter.emit('permission-error', permissionError);
        setIsProcessing(false);
      });
  };

  const startScanning = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      // Simulation of instant room detection: pick a random room from M101-M111
      const randomRoom = roomList[Math.floor(Math.random() * roomList.length)];
      setTimeout(() => handleQRDetected(randomRoom), 2000);
    } catch (error) {
      setHasCameraPermission(false);
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  };

  const handleQRDetected = (detectedRoom: string) => {
    if (roomList.includes(detectedRoom)) {
      setRoom(detectedRoom);
      stopScanning();
      performEntry(detectedRoom);
    }
  };

  if (isUserLoading || isUserDataLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="h-20 border-b bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <Monitor className="w-6 h-6 text-primary" />
          <span className="font-extrabold text-lg tracking-tight text-primary">NEU LabTrack</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-sm font-bold leading-none">{user.displayName || 'Professor'}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
          <Button variant="ghost" size="lg" onClick={handleSignOut} className="h-10 text-sm font-bold text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-6">
          <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white">
            <CardHeader className="pb-6 text-center pt-10 px-10">
              <CardTitle className="text-4xl font-black text-slate-900">Welcome back!</CardTitle>
              <CardDescription className="text-xl font-semibold text-muted-foreground mt-2">Which room would you like to use?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 px-10 pb-12">
              {status === 'idle' && (
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] ml-2">Laboratory Room</label>
                    <Select value={room} onValueChange={setRoom}>
                      <SelectTrigger className="h-20 rounded-2xl border-slate-200 text-xl font-bold shadow-sm focus:ring-primary">
                        <SelectValue placeholder="Select Laboratory" />
                      </SelectTrigger>
                      <SelectContent>
                        {roomList.map((num) => (
                          <SelectItem key={num} value={num} className="font-bold text-lg py-3">{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    <Dialog onOpenChange={(o) => !o && stopScanning()}>
                      <DialogTrigger asChild>
                        <Button variant="outline" onClick={startScanning} className="h-20 rounded-2xl gap-4 border-2 border-slate-200 font-bold text-xl hover:bg-slate-50 transition-all">
                          <QrCode className="w-7 h-7 text-primary" />
                          Auto-Log via QR
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-xl rounded-3xl">
                        <DialogHeader>
                          <DialogTitle className="text-2xl font-black">QR Auto-Log Mode</DialogTitle>
                          <DialogDescription className="text-base font-medium">Position the room QR code within the frame for instant recording.</DialogDescription>
                        </DialogHeader>
                        <div className="aspect-video relative rounded-2xl bg-black overflow-hidden border-4 border-slate-100 shadow-inner">
                          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-64 h-64 border-2 border-accent/60 rounded-3xl animate-pulse relative">
                              <div className="absolute top-0 left-0 w-full h-1 bg-accent/80 animate-[scan_2s_linear_infinite] shadow-[0_0_20px_rgba(var(--accent),0.8)]" />
                            </div>
                          </div>
                          {hasCameraPermission === false && (
                            <div className="absolute inset-0 bg-black/95 flex items-center justify-center text-white p-10 text-center">
                              <div className="space-y-4">
                                <AlertCircle className="w-16 h-16 mx-auto text-destructive" />
                                <p className="font-black text-2xl">Camera Access Required</p>
                                <p className="text-base opacity-60">Please enable camera permissions in your browser settings to use the QR scanner.</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-center">
                           <Badge variant="secondary" className="px-5 py-2 text-xs font-black uppercase tracking-widest gap-2 bg-accent/10 text-accent-foreground border-accent/20 rounded-full">
                             <div className="w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
                             Auto-Entry Active
                           </Badge>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button 
                      onClick={() => performEntry(room)} 
                      disabled={!room || isProcessing}
                      className="w-full h-24 text-2xl font-black bg-primary hover:bg-primary/90 rounded-2xl gap-4 transition-all shadow-xl active:scale-[0.98] border-b-8 border-primary/20"
                    >
                      {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : <ArrowRight className="w-8 h-8" />}
                      {isProcessing ? 'Processing Entry...' : `Log Entry ${room}`}
                    </Button>
                  </div>
                </div>
              )}

              {status === 'success' && (
                <div className="text-center py-12 space-y-8 animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-32 h-32 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-500 border-4 border-green-100 shadow-inner">
                    <CheckCircle2 className="w-16 h-16" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-4xl font-black text-slate-900">Session Verified</h3>
                    <p className="text-xl font-bold text-slate-500">Your presence in Lab {room} has been recorded.</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setRoom('');
                      setStatus('idle');
                      router.replace('/professor');
                    }} 
                    className="w-full h-20 text-xl font-bold rounded-2xl border-2 border-slate-200"
                  >
                    Return to Terminal
                  </Button>
                </div>
              )}

              {status === 'blocked' && (
                <div className="text-center py-12 space-y-8 animate-in shake duration-500">
                  <div className="w-32 h-32 bg-destructive/5 rounded-full flex items-center justify-center mx-auto text-destructive border-4 border-destructive/10">
                    <AlertTriangle className="w-16 h-16" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-4xl font-black text-destructive">Access Restricted</h3>
                    <p className="text-lg font-bold text-slate-500 px-10 leading-tight">Your account has been flagged. Please see the laboratory administrator for restoration.</p>
                  </div>
                  <Button onClick={handleSignOut} variant="destructive" className="w-full h-20 text-xl font-bold rounded-2xl shadow-xl">
                    Sign Out Immediately
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="px-10 py-8 bg-white border border-slate-200 rounded-3xl flex items-center gap-8 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-2xl shrink-0 shadow-inner">
              {user.email?.[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-black text-slate-900 truncate">{user.displayName || 'Professor'}</p>
              <p className="text-base font-bold text-muted-foreground truncate opacity-70">{user.email}</p>
            </div>
            <Badge variant="outline" className="ml-auto text-xs font-black uppercase tracking-[0.2em] h-10 px-5 border-slate-200 bg-slate-50 rounded-xl">
              {userData?.role || 'Professor'}
            </Badge>
          </div>
        </div>
      </main>
      
      <style jsx global>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
