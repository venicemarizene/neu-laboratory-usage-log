
"use client"

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Monitor, LogOut, CheckCircle2, Loader2, QrCode, Clock, MapPin, AlertCircle } from 'lucide-react';
import { useUser, useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/services/auth-service';
import { LogService } from '@/lib/services/log-service';
import jsQR from 'jsqr';

export default function ProfessorPortal() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  const [lastLoggedRoom, setLastLoggedRoom] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);

  const activeLogQuery = useMemoFirebase(() => {
    if (!firestore || !user?.email) return null;
    return query(
      collection(firestore, 'roomLogs'), 
      where('professorEmail', '==', user.email),
      where('status', '==', 'active'),
      limit(1)
    );
  }, [firestore, user?.email]);

  const { data: activeLogs, isLoading: isActiveLogLoading } = useCollection(activeLogQuery);
  const activeSession = activeLogs?.[0] || null;

  useEffect(() => {
    if (!isUserLoading && !user) router.replace('/');
  }, [user, isUserLoading, router]);

  const handleSignOut = async () => {
    if (firestore && user?.email) {
      setIsProcessing(true);
      await LogService.endActiveRoomSession(firestore, user.email);
      if (auth) await AuthService.logout(auth);
      router.push('/');
    }
  };

  const performRoomLog = async (roomCode: string) => {
    if (isProcessing || !firestore || !user?.email) return;
    setIsProcessing(true);
    
    try {
      await LogService.startRoomSession(firestore, user.email, roomCode);
      setLastLoggedRoom(roomCode);
      setStatus('success');
      toast({ title: "Room Logged", description: `Laboratory ${roomCode} usage started.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Logging Failed', description: error.message });
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
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        try {
          const qrData = JSON.parse(code.data);
          if (qrData.room) {
            stopScanning();
            performRoomLog(qrData.room);
            return;
          }
        } catch (e) {
          // Not valid JSON or missing room, ignore or show hint
        }
      }
    }
    requestRef.current = requestAnimationFrame(scanFrame);
  };

  const startScanning = async () => {
    setIsScanning(true);
    setStatus('idle');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          requestRef.current = requestAnimationFrame(scanFrame);
        };
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Camera Required', description: 'Enable camera to scan room QR codes.' });
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  if (isUserLoading || isActiveLogLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-body">
      <nav className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-primary" />
          <span className="font-extrabold text-lg tracking-tight text-primary">NEU LabTrack</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={isProcessing} className="font-bold text-muted-foreground hover:text-destructive gap-2">
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          Sign Out
        </Button>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
        <div className="w-full max-w-xl text-center space-y-2">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Professor Portal</h2>
          <p className="text-muted-foreground font-medium italic">Identify and log your room usage via QR</p>
        </div>

        <div className="w-full max-w-xl space-y-6">
          {status === 'success' ? (
            <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white animate-in zoom-in duration-300">
              <CardContent className="p-10 text-center space-y-6">
                <div className="mx-auto w-24 h-24 bg-green-50 rounded-full flex items-center justify-center text-green-500 border-2 border-green-100">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900">Session Verified</h3>
                  <p className="text-lg font-bold text-muted-foreground">Thank you for using room <span className="text-primary">{lastLoggedRoom}</span>.</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setStatus('idle')}
                  className="w-full h-14 rounded-2xl font-bold text-lg border-2"
                >
                  Back to Dashboard
                </Button>
              </CardContent>
            </Card>
          ) : activeSession ? (
            <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white animate-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="text-center pt-8">
                <CardTitle className="text-2xl font-black">Active Usage Session</CardTitle>
                <CardDescription>You are currently logged into a laboratory unit.</CardDescription>
              </CardHeader>
              <CardContent className="p-10 text-center space-y-8">
                <div className="bg-primary/5 border-2 border-primary/20 rounded-3xl p-8 space-y-4">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                    <Clock className="w-8 h-8 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-primary opacity-70">Room Number</p>
                    <h3 className="text-5xl font-black text-slate-900">{activeSession.room}</h3>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    Started at {activeSession.timeIn?.toDate() ? format(activeSession.timeIn.toDate(), "h:mm a") : '—'}
                  </div>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={handleSignOut}
                  disabled={isProcessing}
                  className="w-full h-16 rounded-2xl font-black text-lg gap-3 shadow-lg shadow-destructive/20"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                  End Session & Sign Out
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Dialog onOpenChange={(o) => !o && stopScanning()}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={startScanning}
                    className="w-full h-40 rounded-3xl flex-col gap-4 bg-primary hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
                  >
                    <div className="bg-white/20 p-4 rounded-2xl">
                      <QrCode className="w-12 h-12 text-white" />
                    </div>
                    <span className="text-2xl font-black uppercase tracking-wider">Scan Room QR</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-3xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-black text-center">Laboratory Scanner</DialogTitle>
                    <DialogDescription className="text-center font-medium">Position the room's QR code within the frame to log usage.</DialogDescription>
                  </DialogHeader>
                  <div className="aspect-square relative rounded-2xl bg-black overflow-hidden border-4 border-muted shadow-inner">
                    <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                      <div className="w-full h-full border-2 border-primary/50 rounded-lg relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-primary animate-scan" />
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-primary shrink-0" />
                    <p className="text-xs font-bold text-muted-foreground">Ensure the JSON room data is clearly visible.</p>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-white rounded-3xl border shadow-sm text-center space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</p>
                  <p className="text-xl font-black text-green-600 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Ready
                  </p>
                </div>
                <div className="p-6 bg-white rounded-3xl border shadow-sm text-center space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Units</p>
                  <p className="text-xl font-black text-slate-800">11 Labs</p>
                </div>
              </div>
            </div>
          )}

          <div className="px-6 py-5 bg-white border border-slate-200 rounded-3xl flex items-center gap-6 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl shadow-inner">
              {user?.email?.[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black text-slate-900 truncate">{user?.displayName}</p>
              <p className="text-sm font-bold text-muted-foreground truncate opacity-70">{user?.email}</p>
            </div>
          </div>
        </div>

        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">
          Institutional Logging System • NEU
        </p>
      </main>
      
      <style jsx global>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  );
}
