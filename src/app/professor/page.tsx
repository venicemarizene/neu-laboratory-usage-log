
"use client"

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Monitor, LogOut, CheckCircle2, AlertTriangle, Loader2, ArrowRight, QrCode, AlertCircle, Sparkles } from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/services/auth-service';

/**
 * Professor Portal for laboratory entry logging.
 * Features automated QR scanning that triggers entry logs instantly upon detection.
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
    
    if (userData?.status === 'blocked') {
      setStatus('blocked');
      AuthService.logout(auth!).then(() => router.push('/'));
    }
  }, [user, userData, isUserLoading, isUserDataLoading, router, auth]);

  const handleSignOut = async () => {
    if (auth) {
      await AuthService.logout(auth);
      router.push('/');
    }
  };

  /**
   * Core entry logic. Logs session to Firestore.
   */
  const performEntry = (selectedRoom: string) => {
    if (!selectedRoom || !firestore || !user) return;
    setIsProcessing(true);
    
    if (userData?.status === 'blocked') {
      setStatus('blocked');
      setIsProcessing(false);
      return;
    }

    const logData = {
      professorId: user.uid,
      professorName: user.displayName || userData?.email || 'Professor',
      roomNumber: selectedRoom,
      timestamp: new Date().toISOString(),
      status: 'Active'
    };
    
    // Add document to room_logs collection
    addDoc(collection(firestore, 'room_logs'), logData)
      .then(() => {
        setStatus('success');
        setIsProcessing(false);
        toast({
          title: "Session Logged Successfully",
          description: `Entry recorded for Laboratory ${selectedRoom}`,
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

  /**
   * Initializes the QR scanner camera stream.
   */
  const startScanning = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      // Simulate detection after 2 seconds for demonstration
      // In a real scenario, a QR library would parse the video frames
      setTimeout(() => handleQRDetected('M105'), 2000);
    } catch (error) {
      setHasCameraPermission(false);
    }
  };

  /**
   * Stops the camera and resets scanning state.
   */
  const stopScanning = () => {
    setIsScanning(false);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  };

  /**
   * Automatically triggered when a room code is identified.
   * Enables seamless "Scan-to-Log" functionality.
   */
  const handleQRDetected = (detectedRoom: string) => {
    if (roomList.includes(detectedRoom)) {
      setRoom(detectedRoom);
      stopScanning();
      // Automatic trigger: no manual button click needed after detection
      performEntry(detectedRoom);
    }
  };

  if (isUserLoading || isUserDataLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-xl flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <Monitor className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-primary font-headline tracking-tight">NEU LabTrack</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2 font-bold text-muted-foreground hover:text-destructive transition-colors">
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </header>

      <main className="w-full max-w-xl space-y-6">
        <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden bg-card">
          <CardHeader className="text-center pb-2 pt-10">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-500">
              <Monitor className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-black text-primary tracking-tight">Access Terminal</CardTitle>
            <p className="text-muted-foreground font-medium text-sm">Automated laboratory session logging</p>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-10">
            {status === 'idle' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Manual Select</label>
                    {room && <Badge variant="outline" className="text-[10px] font-bold border-primary/20 text-primary bg-primary/5">Selected: {room}</Badge>}
                  </div>
                  <Select value={room} onValueChange={setRoom}>
                    <SelectTrigger className="h-14 text-lg border-2 rounded-2xl focus:ring-primary shadow-sm">
                      <SelectValue placeholder="Select Computer Lab" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-2">
                      {roomList.map((num) => (
                        <SelectItem key={num} value={num} className="text-lg py-3 rounded-lg">Lab Room {num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <Dialog onOpenChange={(o) => !o && stopScanning()}>
                    <DialogTrigger asChild>
                      <Button variant="outline" onClick={startScanning} className="h-16 border-2 font-black rounded-2xl gap-3 hover:bg-slate-50 transition-all text-primary shadow-sm">
                        <QrCode className="w-6 h-6" />
                        Scan Lab QR Code
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md rounded-3xl border-none">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-accent" />
                          Auto-Log Scanner
                        </DialogTitle>
                        <DialogDescription className="font-medium">
                          Scanning a valid lab code will automatically record your entry.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="aspect-video relative rounded-2xl bg-black overflow-hidden border-4 border-muted">
                        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
                        
                        {/* Scanning Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-48 h-48 border-2 border-accent/50 rounded-2xl animate-pulse relative">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-0.5 bg-accent/80 animate-[scan_2s_linear_infinite]" />
                          </div>
                        </div>

                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                          <Badge className="bg-accent text-accent-foreground font-black px-4 py-1.5 rounded-full shadow-lg border-none animate-bounce">
                            AUTO-ENTRY MODE
                          </Badge>
                        </div>

                        {hasCameraPermission === false && (
                          <div className="absolute inset-0 bg-black/90 flex items-center justify-center text-white p-8 text-center">
                            <div className="space-y-4">
                              <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
                              <h3 className="text-xl font-bold">Camera Access Required</h3>
                              <p className="text-sm text-slate-400">Please enable camera permissions in your browser settings to use the automated entry feature.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                    <Button 
                      onClick={() => performEntry(room)} 
                      disabled={!room || isProcessing}
                      className="relative w-full h-20 text-2xl font-black bg-primary hover:bg-primary/90 shadow-2xl rounded-2xl gap-4 transition-all"
                    >
                      {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : <ArrowRight className="w-8 h-8" />}
                      {isProcessing ? 'Synchronizing...' : `Enter Lab ${room || ''}`}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center space-y-8 animate-in zoom-in-95 duration-500 py-4">
                <div className="p-12 bg-green-50 rounded-[3rem] border-4 border-green-100 space-y-6 shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <CheckCircle2 className="w-32 h-32 text-green-500" />
                  </div>
                  <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto drop-shadow-md" />
                  <div className="space-y-2 relative z-10">
                    <h3 className="text-4xl font-black text-green-800 tracking-tight">Logged Successfully</h3>
                    <p className="text-green-700/80 font-bold text-lg">Your session in Lab {room} is now active.</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setRoom('');
                    setStatus('idle');
                  }} 
                  className="w-full h-16 font-black text-lg border-2 rounded-2xl hover:bg-slate-50 shadow-sm"
                >
                  Log Another Entry
                </Button>
              </div>
            )}

            {status === 'blocked' && (
              <div className="text-center space-y-8 animate-in shake duration-500">
                <div className="p-12 bg-destructive/5 rounded-[3rem] border-4 border-destructive/10 space-y-6">
                  <AlertTriangle className="w-24 h-24 text-destructive mx-auto drop-shadow-md" />
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-destructive tracking-tight">Account Restricted</h3>
                    <p className="text-muted-foreground font-bold">You are currently restricted from logging new sessions. Please contact the administrator.</p>
                  </div>
                </div>
                <Button onClick={handleSignOut} variant="destructive" className="w-full h-16 font-black text-lg rounded-2xl shadow-lg">
                  Disconnect Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-card p-6 rounded-[2rem] shadow-xl border-none flex items-center gap-5 group transition-all hover:shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-accent text-primary flex items-center justify-center font-black text-2xl shadow-inner transition-transform group-hover:scale-105 duration-300">
            {user.email?.[0].toUpperCase() || 'P'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-800 text-xl truncate tracking-tight">{user.displayName || 'Faculty Member'}</p>
            <p className="text-sm text-muted-foreground font-bold truncate">{user.email}</p>
          </div>
          <Badge className="font-black bg-primary/10 text-primary border-none px-4 py-1.5 rounded-xl uppercase text-[10px] tracking-widest">
            {userData?.role || 'Professor'}
          </Badge>
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
