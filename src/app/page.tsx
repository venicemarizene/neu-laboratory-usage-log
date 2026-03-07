
"use client";

import { useState, use, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Monitor, Loader2, ShieldCheck, UserCircle, LogOut, Info, QrCode, AlertCircle, CheckCircle2, Ban, X } from 'lucide-react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AuthService } from '@/lib/services/auth-service';
import { UserService } from '@/lib/services/user-service';
import jsQR from 'jsqr';

/**
 * Main Landing Page with "Login using QR Code" implementation.
 */
export default function Home(props: { params: Promise<any>; searchParams: Promise<any> }) {
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState('professor');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // QR Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingDetection, setIsProcessingDetection] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [detectedEmail, setDetectedEmail] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);

  // Auto-redirect if already logged in (Google or QR)
  useEffect(() => {
    if (isUserLoading || isLoggingIn || isProcessingDetection) return;

    const savedEmail = localStorage.getItem('identifiedProfessorEmail');
    if (user || savedEmail) {
      const email = user?.email || savedEmail;
      if (email && firestore) {
        UserService.syncProfileByEmail(firestore, email)
          .then(profile => {
            if (profile.status === 'active') {
              router.push(profile.role === 'admin' ? '/admin/dashboard' : '/professor/dashboard');
            } else {
              setErrorMessage("Your account has been blocked. Please contact the administrator.");
              if (user) AuthService.logout(auth!);
              localStorage.removeItem('identifiedProfessorEmail');
            }
          })
          .catch(() => {
            // No profile found yet, stay on login
          });
      }
    }
  }, [user, isUserLoading, isLoggingIn, isProcessingDetection, firestore, auth, router]);

  const handleGoogleLogin = async () => {
    if (!auth || !firestore) return;
    setIsLoggingIn(true);
    setErrorMessage(null);
    
    try {
      const signedInUser = await AuthService.signInWithGoogle(auth);
      if (!signedInUser) {
        setIsLoggingIn(false);
        return;
      }
      
      const email = (signedInUser.email || '').toLowerCase().trim();
      if (!email.endsWith("@neu.edu.ph")) {
        toast({ variant: 'destructive', title: 'Institutional Required', description: "Only @neu.edu.ph emails are allowed!" });
        await AuthService.logout(auth);
        setIsLoggingIn(false);
        return;
      }

      const profile = await UserService.syncProfile(firestore, signedInUser);
      
      if (profile.status === 'blocked') {
        setErrorMessage("Your account has been blocked. Please contact the administrator.");
        await AuthService.logout(auth);
        setIsLoggingIn(false);
        return;
      }

      toast({ title: 'Authenticated', description: `Welcome, ${signedInUser.displayName}` });
      router.push(profile.role === 'admin' ? '/admin/dashboard' : '/professor/dashboard');
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast({ variant: 'destructive', title: 'Authentication Error', description: error.message });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  /**
   * Process QR data: Extract email, verify in Firestore, and handle role-based redirection.
   */
  const handleQRDetected = async (data: string) => {
    if (isProcessingDetection || isLoggingIn || !firestore) return;
    
    const cleanData = data.trim();
    // Validate institutional domain
    const emailPattern = /[a-zA-Z0-9._%+-]+@neu\.edu\.ph/i;
    const emailMatch = cleanData.match(emailPattern);
    
    if (!emailMatch) {
      toast({ variant: 'destructive', title: 'Invalid QR Format', description: "This QR code does not contain a valid institutional email." });
      return;
    }

    const scannedEmail = emailMatch[0].toLowerCase();
    setIsProcessingDetection(true);
    setDetectedEmail(scannedEmail);
    
    try {
      // Condition 1: User Verification
      const profile = await UserService.syncProfileByEmail(firestore, scannedEmail);
      
      // Condition 2: Account Status
      if (profile.status === 'blocked') {
        setErrorMessage("Your account has been blocked. Please contact the administrator.");
        stopScanning();
        return;
      }

      // Condition 3: Role Verification & Redirection
      toast({ title: 'ID Verified', description: `Welcome, ${scannedEmail}` });
      localStorage.setItem('identifiedProfessorEmail', scannedEmail);
      localStorage.setItem('loginTimestamp', new Date().toISOString());
      
      setTimeout(() => {
        stopScanning();
        router.push(profile.role === 'admin' ? '/admin/dashboard' : '/professor/dashboard');
      }, 1000);

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'QR code not recognized', description: "Please contact the administrator." });
      setIsProcessingDetection(false);
      setDetectedEmail(null);
    }
  };

  const scanFrame = () => {
    if (!isScanning || isProcessingDetection || !videoRef.current || !canvasRef.current) return;
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
        handleQRDetected(code.data);
      }
    }
    if (!isProcessingDetection) {
      requestRef.current = requestAnimationFrame(scanFrame);
    }
  };

  const startScanning = async () => {
    setIsScanning(true);
    setIsProcessingDetection(false);
    setDetectedEmail(null);
    setErrorMessage(null);
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
      toast({ variant: 'destructive', title: 'Camera Permission Denied', description: 'Camera access is required to scan QR codes.' });
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
    setIsProcessingDetection(false);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-6 text-center animate-in fade-in duration-300">
        <div className="space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl">
            <Monitor className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary font-headline">NEU LabTrack</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Institutional Laboratory Management</p>
        </div>

        {errorMessage && (
          <Alert variant="destructive" className="animate-in slide-in-from-top-2 duration-300">
            <Ban className="h-4 w-4" />
            <AlertTitle className="font-bold">Access Restricted</AlertTitle>
            <AlertDescription className="font-semibold">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-2xl overflow-hidden rounded-2xl bg-card">
          <Tabs defaultValue="professor" onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-2 rounded-none h-14 bg-muted/30">
              <TabsTrigger value="professor" className="flex items-center gap-2 text-sm font-semibold">
                <UserCircle className="w-4 h-4" />
                Professor
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="w-4 h-4" />
                Admin
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="professor" className="p-6 space-y-6 m-0">
              <div className="space-y-4">
                <Button 
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn || isProcessingDetection}
                  className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-md gap-3 transition-all"
                >
                  {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <Monitor className="w-5 h-5" />}
                  Sign in with Google
                </Button>

                <Dialog onOpenChange={(o) => !o && stopScanning()}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      onClick={startScanning}
                      className="w-full h-14 text-lg font-bold border-2 gap-3 hover:bg-slate-50 transition-all"
                    >
                      <QrCode className="w-5 h-5 text-primary" />
                      Login using QR Code
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-black text-center">QR Identity Login</DialogTitle>
                      <DialogDescription className="text-center">Scan your Professor ID QR code for instant entry.</DialogDescription>
                    </DialogHeader>
                    <div className="aspect-square relative rounded-2xl bg-black overflow-hidden border-4 border-muted shadow-2xl">
                      <video 
                        ref={videoRef} 
                        className="absolute inset-0 w-full h-full object-cover" 
                        autoPlay 
                        muted 
                        playsInline 
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      
                      {isProcessingDetection && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center backdrop-blur-[2px] z-20">
                          <div className="text-center bg-white p-6 rounded-2xl shadow-2xl animate-in zoom-in duration-300">
                            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-2" />
                            <p className="font-black text-primary text-xl">Verifying...</p>
                          </div>
                        </div>
                      )}

                      {hasCameraPermission === false && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white p-6 text-center">
                          <div>
                            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-destructive" />
                            <p className="font-bold">Camera access required</p>
                          </div>
                        </div>
                      )}

                      <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                        <div className="w-full h-full border-2 border-accent/50 rounded-lg relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-full h-0.5 bg-accent/80 animate-[scan_2s_linear_infinite]" />
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            <TabsContent value="admin" className="p-6 space-y-4 m-0">
              <Button 
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-md gap-3 transition-all"
              >
                {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                Admin Google Login
              </Button>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-xs font-medium text-muted-foreground">
          Institutional <span className="text-primary font-bold">@neu.edu.ph</span> domain enforced.
        </p>
      </div>
      <style jsx global>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
}
