
"use client"

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, LogOut, CheckCircle2, Loader2, QrCode, ArrowRight, Clock, MapPin, Download } from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/services/auth-service';
import { LogService } from '@/lib/services/log-service';
import jsQR from 'jsqr';
import { QRCodeCanvas } from 'qrcode.react';

/**
 * Professor Portal for Room QR Logging and Identity Management.
 */
export default function ProfessorPortal(props: { params: Promise<any>; searchParams: Promise<any> }) {
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);

  const roomList = ['M101', 'M102', 'M103', 'M104', 'M105', 'M106', 'M107', 'M108', 'M109', 'M110', 'M111'];

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  
  const { data: userData, isLoading: isUserDataLoading } = useDoc(userRef);

  // Check for active logs
  const activeLogQuery = useMemoFirebase(() => {
    if (!firestore || !user?.email) return null;
    return query(
      collection(firestore, 'logs'), 
      where('professorEmail', '==', user.email),
      where('status', '==', 'active'),
      limit(1)
    );
  }, [firestore, user?.email]);

  const { data: activeLogs, isLoading: isActiveLogLoading } = useCollection(activeLogQuery);
  const activeSession = activeLogs?.[0] || null;

  const isWaiting = isUserLoading || isUserDataLoading || isActiveLogLoading;

  useEffect(() => {
    if (isWaiting) return;
    if (!user) router.replace('/');
  }, [user, isWaiting, router]);

  const handleSignOut = async () => {
    if (firestore && user?.email) {
      setIsProcessing(true);
      await LogService.endActiveSession(firestore, user.email);
      if (auth) await AuthService.logout(auth);
      router.push('/');
    }
  };

  const performRoomLog = async (roomCode: string) => {
    if (isProcessing || !firestore || !user?.email) return;
    setIsProcessing(true);
    
    try {
      await LogService.startSession(firestore, user.email, roomCode);
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
        const decodedText = code.data.trim().toUpperCase();
        if (roomList.includes(decodedText)) {
          stopScanning();
          performRoomLog(decodedText);
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
        videoRef.current.onloadedmetadata = () => {
          requestRef.current = requestAnimationFrame(scanFrame);
        };
      }
    } catch (error) {
      setHasCameraPermission(false);
      toast({ variant: 'destructive', title: 'Camera Required', description: 'Enable camera to scan room QR codes.' });
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

  const downloadMyQR = () => {
    const canvas = qrRef.current;
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = `${user?.email?.split('@')[0]}-id.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isWaiting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-6">
          <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white">
            <Tabs defaultValue="dashboard">
              <TabsList className="w-full grid grid-cols-2 rounded-none h-14 bg-muted/20">
                <TabsTrigger value="dashboard" className="font-bold">Dashboard</TabsTrigger>
                <TabsTrigger value="id" className="font-bold">Institutional ID</TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="p-8 space-y-8 m-0">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-black text-slate-900">Laboratory Access</h2>
                  <p className="text-muted-foreground font-medium italic">Record your classroom usage via QR</p>
                </div>

                {activeSession ? (
                  <div className="bg-primary/5 border-2 border-primary/20 rounded-3xl p-8 text-center space-y-6 animate-in zoom-in duration-300">
                    <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary border-2 border-primary/20">
                      <Clock className="w-10 h-10 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase tracking-widest text-primary">Currently Occupying</p>
                      <h3 className="text-5xl font-black text-slate-900">{activeSession.roomNumber}</h3>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      Started at {new Date(activeSession.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <Button 
                      variant="destructive" 
                      onClick={handleSignOut}
                      className="w-full h-16 rounded-2xl font-black text-lg gap-3 shadow-lg shadow-destructive/20"
                    >
                      <LogOut className="w-5 h-5" />
                      End Session & Sign Out
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <Dialog onOpenChange={(o) => !o && stopScanning()}>
                      <DialogTrigger asChild>
                        <Button 
                          onClick={startScanning}
                          className="w-full h-32 rounded-3xl flex-col gap-4 bg-primary hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
                        >
                          <div className="bg-white/20 p-4 rounded-2xl">
                            <QrCode className="w-10 h-10 text-white" />
                          </div>
                          <span className="text-xl font-black uppercase tracking-wider">Scan Room QR</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md rounded-3xl">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-black text-center">Room Scanner</DialogTitle>
                          <DialogDescription className="text-center font-medium">Position the laboratory's room QR within the frame.</DialogDescription>
                        </DialogHeader>
                        <div className="aspect-square relative rounded-2xl bg-black overflow-hidden border-4 border-muted shadow-inner">
                          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
                          <canvas ref={canvasRef} className="hidden" />
                          <div className="absolute inset-0 border-[50px] border-black/40 pointer-events-none">
                            <div className="w-full h-full border-2 border-primary/50 rounded-lg relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-full h-0.5 bg-primary animate-[scan_2s_linear_infinite]" />
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <div className="grid grid-cols-2 gap-3 opacity-60">
                      <div className="p-4 bg-slate-50 rounded-2xl border text-center">
                        <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Total Rooms</p>
                        <p className="text-xl font-black">11 Units</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border text-center">
                        <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Status</p>
                        <p className="text-xl font-black text-green-600 flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Ready
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="id" className="p-8 text-center space-y-8 m-0">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900">Institutional Identity</h3>
                  <p className="text-sm font-medium text-muted-foreground italic">Authenticated via Google Institution</p>
                </div>
                <div className="flex justify-center p-6 bg-white rounded-3xl border-4 border-slate-50 shadow-inner max-w-[280px] mx-auto">
                  <QRCodeCanvas 
                    ref={qrRef}
                    value={userData?.email || user?.email || ''} 
                    size={200}
                    level="H"
                    includeMargin
                  />
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white font-black text-xl">
                      {user?.email?.[0].toUpperCase()}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{user?.displayName}</p>
                      <p className="text-xs font-bold text-primary truncate opacity-70">{user?.email}</p>
                    </div>
                  </div>
                  <Button 
                    className="w-full h-14 font-black gap-2 rounded-2xl shadow-lg"
                    onClick={downloadMyQR}
                  >
                    <Download className="w-4 h-4" />
                    Download Identification QR
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          <p className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">
            Secure Institutional Logging System • NEU
          </p>
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
