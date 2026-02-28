
"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Microscope, QrCode, LogOut, CheckCircle2, AlertTriangle, Camera, Loader2 } from 'lucide-react';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function ProfessorPortal() {
  const router = useRouter();
  const { auth, firestore } = useAuth() ? { auth: useAuth(), firestore: useFirestore() } : { auth: null, firestore: null };
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [room, setRoom] = useState('');
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'blocked'>('idle');
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user && firestore) {
        const q = query(collection(firestore, 'user_profiles'), where('id', '==', user.uid), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setProfileData(snap.docs[0].data());
        }
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

  const handleScan = () => {
    if (!room) return;
    setScanning(true);
    
    // Simulate real database check
    setTimeout(async () => {
      setScanning(false);
      if (profileData?.isBlocked) {
        setStatus('blocked');
      } else {
        try {
          if (firestore && user) {
            await addDoc(collection(firestore, 'room_logs'), {
              professorId: user.uid,
              professorName: user.displayName || profileData?.name || 'Professor',
              roomNumber: room,
              timestamp: new Date().toISOString(),
              status: 'Active'
            });
          }
          setStatus('success');
        } catch (error) {
          console.error('Logging error:', error);
          toast({
            variant: 'destructive',
            title: 'Logging Failed',
            description: 'Could not record room entry. Please check your connection.',
          });
        }
      }
    }, 2000);
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
          <Microscope className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-primary font-headline">NEU Lab Log</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </header>

      <main className="w-full max-w-xl space-y-6">
        <Card className="border-none shadow-xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Register Room Usage</CardTitle>
            <CardDescription>Scan the laboratory QR code to log your session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Select Lab Room</label>
              <Select value={room} onValueChange={setRoom}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select a laboratory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lab 101">Lab 101 - BioTech</SelectItem>
                  <SelectItem value="Lab 102">Lab 102 - Nanoscale</SelectItem>
                  <SelectItem value="Lab 204">Lab 204 - Optics</SelectItem>
                  <SelectItem value="Lab 305">Lab 305 - Robotics</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {status === 'idle' && (
              <Button 
                onClick={handleScan} 
                disabled={!room || scanning}
                className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 gap-3"
              >
                {scanning ? <Loader2 className="animate-spin" /> : <Camera className="w-6 h-6" />}
                {scanning ? 'Validating...' : 'Scan Room QR Code'}
              </Button>
            )}

            {status === 'success' && (
              <div className="text-center space-y-4 animate-in zoom-in-95 duration-300">
                <div className="p-6 bg-green-50 rounded-xl border border-green-100 space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                  <h3 className="text-xl font-bold text-green-700">Access Logged!</h3>
                  <p className="text-green-600">Thank you for using room {room}. Your session is now active.</p>
                </div>
                <Button variant="outline" onClick={handleReset} className="w-full h-12">Log Another Room</Button>
              </div>
            )}

            {status === 'blocked' && (
              <div className="text-center space-y-4 animate-in zoom-in-95 duration-300">
                <div className="p-6 bg-destructive/10 rounded-xl border border-destructive/20 space-y-3">
                  <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
                  <h3 className="text-xl font-bold text-destructive">Access Denied</h3>
                  <p className="text-muted-foreground">Your account has been restricted. Please contact the Lab Administrator for assistance.</p>
                </div>
                <Button variant="outline" onClick={handleReset} className="w-full h-12">Try Again</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-card p-6 rounded-xl shadow-sm space-y-3">
          <h4 className="font-semibold text-primary">Your Profile</h4>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-accent text-primary flex items-center justify-center font-bold">
              {user.displayName?.[0] || user.email?.[0]?.toUpperCase() || 'P'}
            </div>
            <div className="flex-1">
              <p className="font-medium">{user.displayName || profileData?.name || 'Professor'}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Badge variant="outline">{profileData?.role || 'Professor'}</Badge>
          </div>
        </div>
      </main>
    </div>
  );
}
