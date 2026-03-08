"use client"

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, LogOut, CheckCircle2, Loader2, Clock, MapPin, ArrowRight } from 'lucide-react';
import { useUser, useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/services/auth-service';
import { LogService } from '@/lib/services/log-service';
import { format } from 'date-fns';

/**
 * Professor Portal - Manual laboratory room logging.
 */
export default function ProfessorPortal() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [room, setRoom] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  const [lastLoggedRoom, setLastLoggedRoom] = useState<string | null>(null);

  // List of rooms for manual selection
  const roomList = Array.from({ length: 11 }, (_, i) => `M${101 + i}`);

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

  /**
   * Saves the selected room to Firestore.
   */
  const performRoomLog = async (roomCode: string) => {
    if (!firestore || !user?.email) return;

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

  if (isUserLoading || isActiveLogLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-body">
      {/* Navbar */}
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

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
        <div className="w-full max-w-xl text-center space-y-2">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Professor Portal</h2>
          <p className="text-muted-foreground font-medium italic">Select the laboratory you are currently using.</p>
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
                  onClick={() => {
                    setStatus('idle');
                    setRoom('');
                  }}
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
            <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white">
              <CardHeader className="text-center pt-8">
                <CardTitle className="text-2xl font-black">Manual Room Entry</CardTitle>
                <CardDescription>Select the laboratory you are currently using.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Laboratory Unit</label>
                  <Select value={room} onValueChange={setRoom}>
                    <SelectTrigger className="h-16 rounded-2xl border-2 font-bold text-lg focus:ring-primary">
                      <SelectValue placeholder="Choose a Room" />
                    </SelectTrigger>
                    <SelectContent>
                      {roomList.map(r => (
                        <SelectItem key={r} value={r} className="font-bold py-3">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={() => performRoomLog(room)}
                  disabled={!room || isProcessing}
                  className="w-full h-20 rounded-2xl font-black text-xl gap-3 shadow-lg bg-primary hover:bg-primary/90"
                >
                  {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowRight className="w-6 h-6" />}
                  Log Entry {room}
                </Button>
              </CardContent>
            </Card>
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
    </div>
  );
}