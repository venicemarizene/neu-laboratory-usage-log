"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Monitor, LogOut, CheckCircle2, Loader2, ArrowRight, Ban } from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/services/auth-service';
import { LogService } from '@/lib/services/log-service';

export default function ProfessorPortal() {
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
  
  const roomList = Array.from({ length: 11 }, (_, i) => `M${101 + i}`);

  const isWaiting = isUserLoading || (user && isUserDataLoading && !userData);

  useEffect(() => {
    if (isWaiting) return;
    
    if (!user) {
      router.replace('/');
      return;
    }

    if (userData?.role === 'admin') {
      router.replace('/admin/dashboard');
      return;
    }

    if (userData?.status === 'blocked') {
      setStatus('blocked');
      setTimeout(() => {
        AuthService.logout(auth!).then(() => router.replace('/'));
      }, 3000);
      return;
    }
  }, [user, userData, isWaiting, router, auth]);

  const handleSignOut = async () => {
    if (auth && firestore && user?.email) {
      setIsProcessing(true);
      await LogService.endActiveRoomSession(firestore, user.email);
      await AuthService.logout(auth);
      router.push('/');
    }
  };

  const performEntry = async (selectedRoom: string) => {
    if (!selectedRoom || !firestore || !user?.email) return;
    setIsProcessing(true);
    
    try {
      await LogService.startRoomSession(firestore, user.email, selectedRoom);
      setStatus('success');
      toast({ title: "Entry Logged", description: `Laboratory ${selectedRoom} session started.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsProcessing(false);
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

  if (status === 'blocked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Alert variant="destructive" className="max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-500 border-2">
          <Ban className="h-6 w-6" />
          <AlertTitle className="text-xl font-black mb-2">Access Denied</AlertTitle>
          <AlertDescription className="text-base font-bold leading-relaxed">
            Your account has been blocked. Please contact the administrator.
          </AlertDescription>
        </Alert>
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
              <CardTitle className="text-3xl font-black text-slate-900">Laboratory Entry</CardTitle>
              <CardDescription className="text-lg font-semibold text-muted-foreground mt-1">Select your room to begin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-8 pb-10">
              {status === 'idle' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Laboratory Selection</label>
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

                  <Button 
                    onClick={() => performEntry(room)} 
                    disabled={!room || isProcessing}
                    className="w-full h-20 text-xl font-black bg-primary hover:bg-primary/90 rounded-xl gap-3 transition-all shadow-lg active:scale-[0.98] border-b-4 border-primary/20"
                  >
                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowRight className="w-6 h-6" />}
                    {isProcessing ? 'Recording...' : `Log Entry ${room}`}
                  </Button>
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
                    }} 
                    className="w-full h-16 text-lg font-bold rounded-xl border-2 border-slate-200"
                  >
                    Close Session
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
              <p className="text-lg font-black text-slate-900 truncate">{user?.displayName || 'Faculty Member'}</p>
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
