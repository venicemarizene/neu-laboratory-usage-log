
"use client";

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Monitor, Loader2, ShieldCheck, UserCircle, AlertCircle } from 'lucide-react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AuthService } from '@/lib/services/auth-service';
import { UserService } from '@/lib/services/user-service';

/**
 * Main Landing Page - Google Institutional Login for all users.
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (isUserLoading || isLoggingIn) return;

    if (user && firestore) {
      UserService.syncProfile(firestore, user)
        .then(profile => {
          if (profile.status === 'active') {
            router.push(profile.role === 'admin' ? '/admin/dashboard' : '/professor/dashboard');
          } else {
            setErrorMessage("Your account has been blocked. Please contact the administrator.");
            AuthService.logout(auth!);
          }
        })
        .catch(() => {
          // Stay on login
        });
    }
  }, [user, isUserLoading, isLoggingIn, firestore, auth, router]);

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
          <Alert variant="destructive" className="animate-in slide-in-from-top-2 duration-300 text-left">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-bold">Login Error</AlertTitle>
            <AlertDescription className="font-semibold">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-2xl overflow-hidden rounded-2xl bg-card">
          <Tabs defaultValue="professor" className="w-full">
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
              <Button 
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-md gap-3 transition-all"
              >
                {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <Monitor className="w-5 h-5" />}
                Sign in with Google
              </Button>
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
    </div>
  );
}
