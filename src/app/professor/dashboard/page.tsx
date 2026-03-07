
"use client"

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, LogOut, CheckCircle2, AlertTriangle, Loader2, ArrowRight, QrCode, AlertCircle, Ban, Download, ShieldCheck, Send } from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/services/auth-service';
import { LogService } from '@/lib/services/log-service';
import { UserService } from '@/lib/services/user-service';
import jsQR from 'jsqr';
import { QRCodeCanvas } from 'qrcode.react';
import { EmailService } from '@/lib/services/email-service';

/**
 * Professor Portal for Laboratory Entry and Identity Management.
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
  const [isEmailing, setIsEmailing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'blocked' | 'unauthorized'>('idle');
  const [userData, setUserData] = useState<any>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  // Identity initialization from localStorage for QR-based sessions
  const [qrIdentityEmail, setQrIdentityEmail] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('identifiedProfessorEmail');
    }
    return null;
  });

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  
  const { data: userDocData, isLoading: isUserDataLoading } = useDoc(userRef);
  
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);

  const roomList = [
    'LAB101', 'LAB102', 'LAB103', 'LAB104', 'LAB105', 'LAB106', 'LAB107', 'LAB108', 'LAB109', 'LAB110', 'LAB111', 'LAB204'
  ];

  useEffect(() => {
    if (qrIdentityEmail && firestore) {
      setIsSessionLoading(true);
      UserService.syncProfileByEmail(firestore, qrIdentityEmail)
        .then(profile => {
          setUserData(profile);
          if (profile.status === 'blocked') setStatus('blocked');
          setIsSessionLoading(false);
        })
        .catch(() => setIsSessionLoading(false));
    } else {
      setIsSessionLoading(false);
    }
  }, [firestore, qrIdentityEmail]);

  const activeEmail = user?.email || qrIdentityEmail;
  const activeUserData = userDocData || userData;
  const isWaiting = isUserLoading || (isSessionLoading && !!qrIdentityEmail);

  useEffect(() => {
    if (isWaiting) return;
    
    if (!activeEmail) {
      router.replace('/');
      return;
    }

    if (activeUserData?.status === 'blocked') {
      setStatus('blocked');
      setTimeout(() => {
        localStorage.removeItem('identifiedProfessorEmail');
        if (auth) AuthService.logout(auth);
        router.replace('/');
      }, 3000);
    }
  }, [activeEmail, activeUserData, isWaiting, router, auth]);

  const handleSignOut = async () => {
    if (firestore && activeEmail) {
      setIsProcessing(true);
      await LogService.endActiveSession(firestore, activeEmail);
      localStorage.removeItem('identifiedProfessorEmail');
      localStorage.removeItem('loginTimestamp');
      if (auth) await AuthService.logout(auth);
      router.push('/');
    }
  };

  const performEntry = async (selectedRoom: string) => {
    if (!selectedRoom || !firestore || !activeEmail) return;
    setIsProcessing(true);
    
    try {
      await LogService.startSession(firestore, activeEmail, selectedRoom);
      setStatus('success');
      toast({ title: "Entry Logged", description: `Laboratory ${selectedRoom} session started.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error logging session', description: error.message });
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
      canvas.width = 640;
      canvas.height = 480;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        const cleanData = code.data.trim().toUpperCase();
        const foundRoom = roomList.find(r => cleanData.includes(r));
        if (foundRoom) {
          setRoom(foundRoom);
          stopScanning();
          performEntry(foundRoom);
          return;
        }
      }
    }
    requestRef.current = requestAnimationFrame(scanFrame);
  };

  const startScanning = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        requestRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (error) {
      setHasCameraPermission(false);
      toast({ variant: 'destructive', title: 'Camera Permission Required', description: 'Camera access is required to scan QR codes.' });
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  };

  const downloadMyQR = () => {
    const canvas = qrRef.current;
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = `${activeEmail?.split('@')[0]}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-primary" />
          <span className="font-extrabold text-base tracking-tight text-primary">NEU LabTrack</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-bold leading-none">{activeUserData?.email?.split('@')[0]}</span>
            <span className="text-[10px] text-muted-foreground">{activeEmail}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={isProcessing} className="h-8 text-xs font-bold text-muted-foreground hover:text-destructive">
            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <LogOut className="w-3 h-3 mr-1.5" />}
            Sign Out
          </Button>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-4">
          {status === 'blocked' ? (
            <Alert variant="destructive" className="shadow-xl">
              <Ban className="h-4 w-4" />
              <AlertTitle>Account Blocked</AlertTitle>
              <AlertDescription>Your account has been blocked. Please contact the administrator.</AlertDescription>
            </Alert>
          ) : (
            <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
              <Tabs defaultValue="entry">
                <TabsList className="w-full grid grid-cols-2 rounded-none h-14 bg-muted/30">
                  <TabsTrigger value="entry" className="font-bold text-sm">Room Entry</TabsTrigger>
                  <TabsTrigger value="qr" className="font-bold text-sm">My QR Code</TabsTrigger>
                </TabsList>

                <TabsContent value="entry" className="p-0 m-0">
                  <CardHeader className="text-center pt-8">
                    <CardTitle className="text-3xl font-black text-slate-900">Laboratory Entry</CardTitle>
                    <CardDescription className="text-lg font-semibold text-muted-foreground">Log your room usage below</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 px-8 pb-10">
                    {status === 'success' ? (
                      <div className="text-center py-8 space-y-4 animate-in zoom-in duration-300">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                        <h3 className="text-2xl font-black">Session Logged!</h3>
                        <p className="font-bold text-muted-foreground">Room {room} is now active.</p>
                        <Button variant="outline" onClick={() => setStatus('idle')} className="w-full h-12 rounded-xl">Back to Entry</Button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Select Room</label>
                          <Select value={room} onValueChange={setRoom}>
                            <SelectTrigger className="h-16 rounded-xl text-lg font-bold shadow-sm">
                              <SelectValue placeholder="Choose Laboratory" />
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
                              <Button variant="outline" onClick={startScanning} className="h-16 rounded-xl gap-3 border-2 font-bold text-lg hover:bg-slate-50 transition-all">
                                <QrCode className="w-6 h-6 text-primary" />
                                Auto Log via QR
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md rounded-2xl">
                              <DialogHeader>
                                <DialogTitle className="text-xl font-black">Room QR Scanner</DialogTitle>
                                <DialogDescription>Scan the laboratory's QR code to instantly log your entry.</DialogDescription>
                              </DialogHeader>
                              <div className="aspect-video relative rounded-xl bg-black overflow-hidden border-2 border-slate-100 shadow-inner">
                                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
                                <canvas ref={canvasRef} className="hidden" />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="w-48 h-48 border-2 border-accent/60 rounded-2xl animate-pulse relative">
                                    <div className="absolute top-0 left-0 w-full h-0.5 bg-accent/80 animate-[scan_2s_linear_infinite]" />
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Button 
                            onClick={() => performEntry(room)} 
                            disabled={!room || isProcessing}
                            className="w-full h-20 text-xl font-black bg-primary hover:bg-primary/90 rounded-xl gap-3 transition-all shadow-lg active:scale-[0.98]"
                          >
                            {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowRight className="w-6 h-6" />}
                            Log Entry {room}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </TabsContent>

                <TabsContent value="qr" className="p-8 text-center space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900">My Identification QR</h3>
                    <p className="text-sm font-semibold text-muted-foreground">Present this QR code for institutional identification.</p>
                  </div>
                  <div className="flex justify-center p-6 bg-white rounded-3xl border-4 border-slate-50 shadow-inner max-w-[280px] mx-auto">
                    <QRCodeCanvas 
                      ref={qrRef}
                      value={activeUserData?.qrValue || activeEmail || ''} 
                      size={200}
                      level="M"
                      includeMargin
                    />
                  </div>
                  <Button 
                    className="w-full h-14 font-black gap-2 rounded-xl shadow-md"
                    onClick={downloadMyQR}
                  >
                    <Download className="w-4 h-4" />
                    Download QR Code
                  </Button>
                </TabsContent>
              </Tabs>
            </Card>
          )}

          <div className="px-6 py-5 bg-white border border-slate-200 rounded-2xl flex items-center gap-6 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl shrink-0 shadow-inner">
              {activeEmail?.[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black text-slate-900 truncate">{activeUserData?.email?.split('@')[0]}</p>
              <p className="text-sm font-bold text-muted-foreground truncate opacity-70">{activeEmail}</p>
            </div>
            <Badge variant="outline" className="ml-auto text-[10px] font-black uppercase tracking-widest h-8 px-3 border-slate-200 bg-slate-50 rounded-lg">
              {activeUserData?.role || 'Professor'}
            </Badge>
          </div>
        </div>
      </main>
      <style jsx global>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
}
