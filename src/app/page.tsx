"use client";

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Monitor, Loader2, ShieldCheck, UserCircle, LogOut, Info } from 'lucide-react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthService } from '@/lib/services/auth-service';
import { UserService } from '@/lib/services/user-service';

/**
 * Main Landing and Authentication Page.
 * Uses Service Layers for Auth and User management.
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

  const handleSignIn = async (targetRole: 'admin' | 'professor') => {
    if (!auth || !firestore) return;
    setIsLoggingIn(true);

    try {
      const signedInUser = await AuthService.signInWithGoogle(auth);
      if (!signedInUser) throw new Error("Sign in failed");

      const email = signedInUser.email?.toLowerCase() || '';

      // Domain Restriction Logic
      if (!email.endsWith("@neu.edu.ph")) {
        alert("Only NEU emails are allowed!");
        await AuthService.logout(auth);
        setIsLoggingIn(false);
        return;
      }

      // Sync Profile & Role Check
      const profile = await UserService.syncProfile(
        firestore, 
        signedInUser, 
        targetRole === 'admin' ? 'Admin' : 'Professor'
      );

      // Account Blocking Check
      if (profile.isBlocked) {
        alert("Your account has been blocked. Please contact the administrator.");
        await AuthService.logout(auth);
        setIsLoggingIn(false);
        return;
      }

      toast({
        title: 'Authentication Successful',
        description: `Welcome, ${signedInUser.displayName}.`,
      });
      
      router.push(profile.role === 'Admin' ? '/admin' : '/professor');
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast({
          variant: 'destructive',
          title: 'Sign In Error',
          description: error.message || 'An unexpected error occurred.',
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      await AuthService.logout(auth);
      toast({ title: 'Signed out', description: 'Institutional session ended.' });
    }
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-6 text-center animate-in fade-in duration-300">
        <div className="space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl transform transition-transform duration-200 hover:scale-105">
            <Monitor className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary font-headline">NEU LabTrack</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Institutional Laboratory Management</p>
        </div>

        {user && (
          <div className="p-3 bg-card border rounded-xl shadow-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center font-bold text-primary shadow-inner text-xs">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold leading-none">{user.displayName || 'Faculty'}</p>
                <p className="text-[10px] text-muted-foreground font-medium">{user.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-8 text-[10px] text-destructive hover:bg-destructive/10 transition-all duration-200">
              <LogOut className="w-3 h-3 mr-1" />
              Sign Out
            </Button>
          </div>
        )}

        <Card className="border-none shadow-2xl overflow-hidden rounded-2xl">
          <Tabs defaultValue="professor" className="w-full">
            <TabsList className="w-full grid grid-cols-2 rounded-none h-14 bg-muted/30">
              <TabsTrigger value="professor" className="data-[state=active]:bg-card data-[state=active]:shadow-sm flex items-center gap-2 text-sm font-semibold">
                <UserCircle className="w-4 h-4" />
                Professor
              </TabsTrigger>
              <TabsTrigger value="admin" className="data-[state=active]:bg-card data-[state=active]:shadow-sm flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="w-4 h-4" />
                Admin Portal
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="professor" className="p-6 space-y-6 m-0">
              <div className="space-y-4">
                <Alert className="bg-primary/5 border-primary/20 text-left">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm font-medium">
                    Redirection: Session Logging Portal only.
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={() => handleSignIn('professor')}
                  disabled={isLoggingIn}
                  className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-md gap-3"
                >
                  {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <Monitor className="w-5 h-5" />}
                  Professor Sign-In
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="admin" className="p-6 space-y-6 m-0">
              <div className="space-y-4">
                <Alert className="bg-primary/5 border-primary/20 text-left">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm font-medium">
                    Redirection: Admin Analytics Dashboard.
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={() => handleSignIn('admin')}
                  disabled={isLoggingIn}
                  className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-md gap-3"
                >
                  {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                  Admin Sign-In
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-xs font-medium text-muted-foreground">
          Institutional <span className="text-primary font-bold">@neu.edu.ph</span> access only.
        </p>
      </div>
    </div>
  );
}
