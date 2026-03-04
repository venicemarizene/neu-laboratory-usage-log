
"use client"

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Monitor, LogOut, CheckCircle2, AlertTriangle, Loader2, ArrowRight, QrCode, AlertCircle, Sparkles, User } from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/services/auth-service';
import { cn } from '@/lib/utils';

/**
 * Minimized Professor Portal for laboratory entry logging.
 * Focuses on efficiency with a clean, centered interface.
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
      
      // Simulate detection for demo
      setTimeout(() => handleQRDetected('M105'), 2000);
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
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm tracking-tight">NEU LabTrack</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-xs font-bold leading-none">{user.displayName || 'Professor'}</span>
            <span className="text-[10px] text-muted-foreground">{user.email}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-8 text-xs font-medium text-muted-foreground hover:text-destructive">
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Sign Out
          </Button>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <Card className="border-none shadow-sm rounded-xl overflow-hidden bg-white">
            <CardHeader className="pb-4 text-center">
              <CardTitle className="text-xl font-bold">Access Terminal</CardTitle>
              <CardDescription className="text-xs">Log your laboratory session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {status === 'idle' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lab Room</label>
                    <Select value={room} onValueChange={setRoom}>
                      <SelectTrigger className="h-11 rounded-lg border-slate-200">
                        <SelectValue placeholder="Select Lab" />
                      </SelectTrigger>
                      <SelectContent>
                        {roomList.map((num) => (
                          <SelectItem key={num} value={num}>{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <Dialog onOpenChange={(o) => !o && stopScanning()}>
                      <DialogTrigger asChild>
                        <Button variant="outline" onClick={startScanning} className="h-11 rounded-lg gap-2 border-slate-200 font-semibold text-sm">
                          <QrCode className="w-4 h-4 text-primary" />
                          Auto-Log QR
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle className="text-lg font-bold">QR Auto-Log</DialogTitle>
                          <DialogDescription className="text-xs">Scanning a lab code records entry instantly.</DialogDescription>
                        </DialogHeader>
                        <div className="aspect-video relative rounded-lg bg-black overflow-hidden border">
                          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-32 h-32 border border-accent/40 rounded-lg animate-pulse relative">
                              <div className="absolute top-0 left-0 w-full h-0.5 bg-accent/60 animate-[scan_2s_linear_infinite]" />
                            </div>
                          </div>
                          {hasCameraPermission === false && (
                            <div className="absolute inset-0 bg-black/90 flex items-center justify-center text-white p-6 text-center text-xs">
                              <div className="space-y-2">
                                <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
                                <p className="font-bold">Camera Access Required</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button 
                      onClick={() => performEntry(room)} 
                      disabled={!room || isProcessing}
                      className="w-full h-11 text-sm font-bold bg-primary hover:bg-primary/90 rounded-lg gap-2 transition-all"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      {isProcessing ? 'Logging...' : `Log Entry ${room}`}
                    </Button>
                  </div>
                </div>
              )}

              {status === 'success' && (
                <div className="text-center py-6 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-500 border border-green-100">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900">Session Active</h3>
                    <p className="text-xs text-slate-500">Logged into Lab {room}.</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setRoom('');
                      setStatus('idle');
                    }} 
                    className="w-full h-10 text-xs font-bold rounded-lg border-slate-200"
                  >
                    Back to Terminal
                  </Button>
                </div>
              )}

              {status === 'blocked' && (
                <div className="text-center py-6 space-y-4 animate-in shake duration-300">
                  <div className="w-16 h-16 bg-destructive/5 rounded-full flex items-center justify-center mx-auto text-destructive border border-destructive/10">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-destructive">Account Restricted</h3>
                    <p className="text-xs text-slate-500 px-4">Contact the administrator for access.</p>
                  </div>
                  <Button onClick={handleSignOut} variant="destructive" className="w-full h-10 text-xs font-bold rounded-lg">
                    Sign Out
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="px-4 py-3 bg-white border border-slate-200 rounded-xl flex items-center gap-3 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-primary font-bold text-xs shrink-0">
              {user.email?.[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{user.displayName || 'Professor'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
            <Badge variant="outline" className="ml-auto text-[9px] font-bold uppercase tracking-widest h-5 px-1.5 border-slate-200">
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
