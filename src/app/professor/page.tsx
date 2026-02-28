
"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Monitor, LogOut, CheckCircle2, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function ProfessorPortal() {
  const router = useRouter();
  const { auth, firestore } = useAuth() ? { auth: useAuth(), firestore: useFirestore() } : { auth: null, firestore: null };
  const { user, isUserLoading } = useUser();

  const [room, setRoom] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'blocked'>('idle');
  const [profileData, setProfileData] = useState<any>(null);

  const roomList = Array.from({ length: 11 }, (_, i) => `M${101 + i}`);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user && firestore) {
        const docRef = doc(firestore, 'user_profiles', user.uid);
        getDoc(docRef)
          .then((snap) => {
            if (snap.exists()) {
              setProfileData(snap.data());
            }
          })
          .catch((err) => {
            const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'get',
            });
            errorEmitter.emit('permission-error', permissionError);
          });
      }
    };
    fetchProfile();
  }, [user, firestore]);

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/');
    }
  };

  const handleEnterLab = () => {
    if (!room) return;
    setIsProcessing(true);
    
    // Artificial delay to simulate processing/verification
    setTimeout(() => {
      if (profileData?.isBlocked) {
        setStatus('blocked');
        setIsProcessing(false);
        return;
      }

      if (firestore && user) {
        const logData = {
          professorId: user.uid,
          professorName: user.displayName || profileData?.name || 'Professor',
          roomNumber: room,
          timestamp: new Date().toISOString(),
          status: 'Active'
        };
        
        addDoc(collection(firestore, 'room_logs'), logData)
          .then(() => {
            setStatus('success');
            setIsProcessing(false);
          })
          .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: 'room_logs',
              operation: 'create',
              requestResourceData: logData,
            });
            errorEmitter.emit('permission-error', permissionError);
            setIsProcessing(false);
          });
      }
    }, 1500);
  };

  const handleReset = () => {
    setStatus('idle');
    setRoom('');
  };

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
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
        <Card className="border-none shadow-xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Monitor className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Computer Lab Entry</CardTitle>
            <CardDescription>Select a laboratory and register your session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-600 uppercase tracking-wider">Choose Computer Laboratory</label>
              <Select value={room} onValueChange={setRoom}>
                <SelectTrigger className="h-14 text-lg border-2 border-primary/20 hover:border-primary/40 transition-colors">
                  <SelectValue placeholder="Select Lab (M101 - M111)" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {roomList.map((roomNum) => (
                    <SelectItem key={roomNum} value={roomNum} className="text-lg py-3 cursor-pointer">
                      Computer Laboratory {roomNum}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {status === 'idle' && (
              <Button 
                onClick={handleEnterLab} 
                disabled={!room || isProcessing}
                className="w-full h-16 text-xl font-bold bg-primary hover:bg-primary/90 shadow-lg gap-3 transition-all active:scale-95"
              >
                {isProcessing ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <ArrowRight className="w-6 h-6" />
                )}
                {isProcessing ? 'Processing Entry...' : room ? `Enter Lab ${room}` : 'Select a Lab to Enter'}
              </Button>
            )}

            {status === 'success' && (
              <div className="text-center space-y-6 animate-in zoom-in-95 duration-500">
                <div className="p-8 bg-green-50 rounded-2xl border-2 border-green-200 space-y-4 shadow-inner">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-green-700">Access Granted</h3>
                    <p className="text-green-600 font-bold text-xl">
                      Thank you for using room {room}.
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleReset} 
                  className="w-full h-14 text-lg font-bold border-2 hover:bg-slate-50 transition-colors"
                >
                  Register New Session
                </Button>
              </div>
            )}

            {status === 'blocked' && (
              <div className="text-center space-y-6 animate-in zoom-in-95 duration-500">
                <div className="p-8 bg-destructive/5 rounded-2xl border-2 border-destructive/20 space-y-4">
                  <AlertTriangle className="w-16 h-16 text-destructive mx-auto" />
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-destructive">Account Restricted</h3>
                    <p className="text-muted-foreground font-medium">Your faculty account has been blocked from registering sessions. Please contact the Lab Administrator for assistance.</p>
                  </div>
                </div>
                <Button variant="outline" onClick={handleReset} className="w-full h-14 text-lg font-bold border-2">
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-card p-6 rounded-2xl shadow-lg border border-slate-100 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent text-primary flex items-center justify-center font-black text-xl shadow-inner">
            {user.displayName?.[0] || user.email?.[0]?.toUpperCase() || 'P'}
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-800 text-lg">{user.displayName || profileData?.name || 'Professor'}</p>
            <p className="text-sm text-muted-foreground font-medium">{user.email}</p>
          </div>
          <Badge className="px-3 py-1 font-bold bg-primary/10 text-primary border-primary/20">
            {profileData?.role || 'Professor'}
          </Badge>
        </div>
      </main>
    </div>
  );
}
