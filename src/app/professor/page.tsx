
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
import { doc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/services/auth-service';
import { LogService } from '@/lib/services/log-service';
import jsQR from 'jsqr';

/**
 * Standard Professor Portal for laboratory entry logging.
 * Features a medium-sized container and session duration management.
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
  const [status, setStatus] = useState<'idle' | 'success' | 'blocked' | 'unauthorized'>('idle');
  
  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  
  const { data: userData, isLoading: isUserDataLoading } = useDoc(userRef);
  
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);

  const roomList = Array.from({ length: 11 }, (_, i) => `M${101 + i}`);

  const isWaiting = isUserLoading || (user && isUserDataLoading && !userData);

  useEffect(() => {
    if (isWaiting) return;
    
    if (!user) {
      router.replace('/');
      return;
    }

    if (userData?.role === 'admin') {
      router.replace('/admin');
      return;
    }

    if (userData?.status === 'blocked') {
      setStatus('blocked');
      AuthService.logout(auth!).then(() => router.replace('/'));
      return;
    }

    // Handle auto-entry from Landing Page QR scan
    const resolvedSearchParams = (searchParams as any);
    if (resolvedSearchParams?.auto === 'true' && resolvedSearchParams?.room) {
      setRoom(resolvedSearchParams.room);
      setStatus('success');
      return;
    }
  }, [user, userData, isWaiting, router, auth, searchParams]);

  const handleSignOut = async () => {
    if (auth && firestore && user?.email) {
      setIsProcessing(true);
      // End the active session before signing out to calculate duration
      await LogService.endActiveSession(firestore, user.email);
      await AuthService.logout(auth);
      router.push('/');
    }
  };

  const performEntry = async (selectedRoom: string) => {
    if (!selectedRoom || !firestore || !user?.email) return;
    setIsProcessing(true);
    
    try {
      await LogService.startSession(firestore, user.email, selectedRoom);
      setStatus('success');
      toast({ title: "Entry Logged", description: `Laboratory ${selectedRoom} session started.` });
    } catch (error: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'logs', operation: 'create', requestResourceData: { professorEmail: user.email, roomNumber: selectedRoom },
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const scanFrame = () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code) {
        const foundRoom = roomList.find(r => code.data.includes(r));
        if (foundRoom) {
          handleQRDetected(foundRoom);
          return;
        }
      }
    }
    requestRef.current = requestAnimationFrame(scanFrame);
  };

  const startScanning = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        requestRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (error) {
      setHasCameraPermission(false);
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
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

  if (isWaiting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground font-bold text-sm tracking-tight italic">Accessing Portal...</p>
        </div>
      </div>
    );
  }

  if (userData?.role === 'admin' || userData?.status === 'blocked') return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-primary" />
          <span className="font-extrabold text-base tracking-tight text-primary">NEU LabTrack</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-bold leading-none">{user?.displayName || 'Professor'}</span>
            <span className="text-[10px] text-muted-foreground">{user?.email}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={isProcessing} className="h-8 text-xs font-bold text-muted-foreground hover:text-destructive">
            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <LogOut className="w-3 h-3 mr-1.5" />}
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
                          <canvas ref={canvasRef} className="hidden" />
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
                    <p className="text-base font-bold text-slate-500">Thank you for using room {room}.</p>
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
            </CardContent>
          </Card>

          <div className="px-6 py-5 bg-white border border-slate-200 rounded-2xl flex items-center gap-6 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl shrink-0 shadow-inner">
              {user?.email?.[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black text-slate-900 truncate">{user?.displayName || 'Professor'}</p>
              <p className="text-sm font-bold text-muted-foreground truncate opacity-70">{user?.email}</p>
            </div>
            <Badge variant="outline" className="ml-auto text-[10px] font-black uppercase tracking-[0.15em] h-8 px-3 border-slate-200 bg-slate-50 rounded-lg">
              {userData?.role || 'Professor'}
            </Badge>
          </div>
        </div>
      </main>
    </div>
  );
}
