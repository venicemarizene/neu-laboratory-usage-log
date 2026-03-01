"use client"

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    
    // Status guard
    if (userData?.status === 'blocked') {
      setStatus('blocked');
      console.log("Professor access denied: account blocked.");
      alert("Your account is restricted. Please contact the administrator.");
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
    
    addDoc(collection(firestore, 'room_logs'), logData)
      .then(() => {
        setStatus('success');
        setIsProcessing(false);
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
      
      // Mock detection for demo
      setTimeout(() => handleQRDetected('M105'), 3000);
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
          <h1 className="text-xl font-bold text-primary font-headline">NEU LabTrack</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </header>

      <main className="w-full max-w-xl space-y-6">
        <Card className="border border-primary/10 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Monitor className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Lab Entry System</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {status === 'idle' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Laboratory Selection</label>
                  <Select value={room} onValueChange={setRoom}>
                    <SelectTrigger className="h-14 text-lg border-2">
                      <SelectValue placeholder="Select Computer Lab" />
                    </SelectTrigger>
                    <SelectContent>
                      {roomList.map((num) => (
                        <SelectItem key={num} value={num} className="text-lg">Lab {num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <Dialog onOpenChange={(o) => !o && stopScanning()}>
                    <DialogTrigger asChild>
                      <Button variant="outline" onClick={startScanning} className="h-14 border-2 font-bold gap-3">
                        <QrCode className="w-5 h-5 text-primary" />
                        Scan Lab QR Code
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Lab QR Scanner</DialogTitle>
                        <DialogDescription>Scan the code at the lab entrance.</DialogDescription>
                      </DialogHeader>
                      <div className="aspect-video relative rounded-xl bg-black overflow-hidden">
                        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
                        {hasCameraPermission === false && (
                          <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white p-6 text-center">
                            <div>
                              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-destructive" />
                              <p>Camera access required for scanning.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button 
                    onClick={() => performEntry(room)} 
                    disabled={!room || isProcessing}
                    className="h-16 text-xl font-black bg-primary hover:bg-primary/90 shadow-xl gap-3"
                  >
                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowRight className="w-6 h-6" />}
                    {isProcessing ? 'Verifying...' : `Enter Lab ${room || ''}`}
                  </Button>
                </div>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center space-y-6 animate-in zoom-in-95 duration-300">
                <div className="p-10 bg-green-50 rounded-3xl border-2 border-green-200 space-y-6">
                  <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-green-800">Access Logged</h3>
                    <p className="text-green-700 font-bold">Session started in Lab {room}.</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setStatus('idle')} className="w-full h-14 font-bold">
                  New Session
                </Button>
              </div>
            )}

            {status === 'blocked' && (
              <div className="text-center space-y-6">
                <div className="p-10 bg-destructive/5 rounded-3xl border-2 border-destructive/20 space-y-4">
                  <AlertTriangle className="w-16 h-16 text-destructive mx-auto" />
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-destructive">Access Denied</h3>
                    <p className="text-muted-foreground font-medium">Your account is restricted. Contact support.</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-card p-6 rounded-3xl shadow-lg border border-primary/5 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-accent text-primary flex items-center justify-center font-black text-2xl shadow-inner">
            {user.email?.[0].toUpperCase() || 'P'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-lg truncate">{user.displayName || 'Faculty'}</p>
            <p className="text-sm text-muted-foreground font-medium truncate">{user.email}</p>
          </div>
          <Badge className="font-bold bg-primary/10 text-primary border-primary/20">
            {userData?.role || 'Professor'}
          </Badge>
        </div>
      </main>
    </div>
  );
}
