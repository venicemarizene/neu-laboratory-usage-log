
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
 * Features a medium-sized layout with a balanced, clean design.
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
      
      // Simulation of instant room detection
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
      <nav className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-primary" />
          <span className="font-extrabold text-base tracking-tight text-primary">NEU LabTrack</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-bold leading-none">{user.displayName || 'Professor'}</span>
            <span className="text-[10px] text-muted-foreground">{user.email}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-8 text-xs font-bold text-muted-foreground hover:text-destructive">
            <LogOut className="w-3 h-3 mr-1.5" />
            Sign Out
          </Button>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-4">
          <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
            <CardHeader className="pb-4 text-center pt-8 px-8">
              <CardTitle className="text-3xl font-black text-slate-900">Welcome back!</CardTitle>
              <CardDescription className="text-lg font-semibold text-muted-foreground mt-1">Which room would you like to use?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-8 pb-10">
              {status === 'idle' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Laboratory Room</label>
                    <Select value={room} onValueChange={setRoom}>
                      <SelectTrigger className="h-16 rounded-xl border-slate-200 text-lg font-bold shadow-sm focus:ring-primary">
                        <SelectValue placeholder="Select Laboratory" />
                      </SelectTrigger>
                      <SelectContent>
                        {roomList.map((num) => (
                          <SelectItem key={num} value={num} className="font-bold text-base py-2.5">{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <Dialog onOpenChange={(o) => !o && stopScanning()}>
                      <DialogTrigger asChild>
                        <Button variant="outline" onClick={startScanning} className="h-16 rounded-xl gap-3 border-2 border-slate-200 font-bold text-lg hover:bg-slate-50 transition-all">
                          <QrCode className="w-6 h-6 text-primary" />
                          Auto-Log via QR
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md rounded-2xl">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-black">QR Auto-Log Mode</DialogTitle>
                          <DialogDescription className="text-sm font-medium">Position the room QR code within the frame for instant recording.</DialogDescription>
                        </DialogHeader>
                        <div className="aspect-video relative rounded-xl bg-black overflow-hidden border-2 border-slate-100 shadow-inner">
                          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-48 h-48 border-2 border-accent/60 rounded-2xl animate-pulse relative">
                              <div className="absolute top-0 left-0 w-full h-0.5 bg-accent/80 animate-[scan_2s_linear_infinite]" />
                            </div>
                          </div>
                          {hasCameraPermission === false && (
                            <div className="absolute inset-0 bg-black/95 flex items-center justify-center text-white p-6 text-center">
                              <div className="space-y-3">
                                <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
                                <p className="font-black text-xl">Camera Access Required</p>
                                <p className="text-xs opacity-60">Please enable camera permissions in your browser settings.</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-center">
                           <Badge variant="secondary" className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest gap-1.5 bg-accent/10 text-accent-foreground border-accent/20 rounded-full">
                             <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
                             Auto-Entry Active
                           </Badge>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button 
                      onClick={() => performEntry(room)} 
                      disabled={!room || isProcessing}
                      className="w-full h-20 text-xl font-black bg-primary hover:bg-primary/90 rounded-xl gap-3 transition-all shadow-lg active:scale-[0.98] border-b-4 border-primary/20"
                    >
                      {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowRight className="w-6 h-6" />}
                      {isProcessing ? 'Processing...' : `Log Entry ${room}`}
                    </Button>
                  </div>
                </div>
              )}

              {status === 'success' && (
                <div className="text-center py-8 space-y-6 animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-500 border-2 border-green-100 shadow-inner">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-900">Session Verified</h3>
                    <p className="text-base font-bold text-slate-500">Your presence in Lab {room} has been recorded.</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setRoom('');
                      setStatus('idle');
                      router.replace('/professor');
                    }} 
                    className="w-full h-16 text-lg font-bold rounded-xl border-2 border-slate-200"
                  >
                    Return to Terminal
                  </Button>
                </div>
              )}

              {status === 'blocked' && (
                <div className="text-center py-8 space-y-6 animate-in shake duration-500">
                  <div className="w-24 h-24 bg-destructive/5 rounded-full flex items-center justify-center mx-auto text-destructive border-2 border-destructive/10">
                    <AlertTriangle className="w-12 h-12" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-destructive">Access Restricted</h3>
                    <p className="text-base font-bold text-slate-500 px-6 leading-tight">Your account has been flagged. Please see the laboratory administrator.</p>
                  </div>
                  <Button onClick={handleSignOut} variant="destructive" className="w-full h-16 text-lg font-bold rounded-xl shadow-lg">
                    Sign Out
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="px-6 py-5 bg-white border border-slate-200 rounded-2xl flex items-center gap-6 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl shrink-0 shadow-inner">
              {user.email?.[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black text-slate-900 truncate">{user.displayName || 'Professor'}</p>
              <p className="text-sm font-bold text-muted-foreground truncate opacity-70">{user.email}</p>
            </div>
            <Badge variant="outline" className="ml-auto text-[10px] font-black uppercase tracking-[0.15em] h-8 px-3 border-slate-200 bg-slate-50 rounded-lg">
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
