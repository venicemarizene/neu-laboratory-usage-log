"use client";

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Monitor, Loader2, ShieldCheck, UserCircle, LogOut, Info, Lock } from 'lucide-react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthService } from '@/lib/services/auth-service';
import { UserService } from '@/lib/services/user-service';

/**
 * Main Landing Page with Dual Authentication and Dynamic Role Guarding.
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
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [activeTab, setActiveTab] = useState('professor');

  /**
   * Automatic redirection for active sessions.
   */
  useEffect(() => {
    if (isUserLoading || !user || !firestore) return;

    const checkAndRedirect = async () => {
      try {
        const profile = await UserService.getProfile(firestore, user.uid);
        if (profile) {
          if (profile.status === 'blocked') {
            await AuthService.logout(auth!);
            return;
          }
          if (profile.role === 'admin') router.push('/admin');
          else router.push('/professor');
        }
      } catch (error) {
        console.error("Session redirection check failed:", error);
      }
    };
    checkAndRedirect();
  }, [user, isUserLoading, firestore, router, auth]);

  /**
   * Universal Google Login Flow.
   * Uses active tab to determine intended role.
   */
  const handleGoogleLogin = async () => {
    if (!auth || !firestore) return;
    setIsLoggingIn(true);

    const intendedRole = activeTab as 'professor' | 'admin';

    try {
      const signedInUser = await AuthService.signInWithGoogle(auth);
      
      if (!signedInUser) {
        setIsLoggingIn(false);
        return;
      }

      const email = (signedInUser.email || '').toLowerCase().trim();

      // Institutional Guard: Only @neu.edu.ph
      if (!email.endsWith("@neu.edu.ph")) {
        alert("Only NEU emails are allowed!");
        await AuthService.logout(auth);
        setIsLoggingIn(false);
        return;
      }

      // Sync Profile with the Intended Role from the active tab
      const profile = await UserService.syncProfile(firestore, signedInUser, intendedRole);

      // Check account status
      if (profile.status === 'blocked') {
        alert("Your account has been blocked. Please contact the administrator.");
        await AuthService.logout(auth);
        setIsLoggingIn(false);
        return;
      }

      // Successful Redirection based on the NEW synced role
      toast({ title: 'Authenticated', description: `Welcome, ${signedInUser.displayName}` });
      if (profile.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/professor');
      }
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error("Google Sign-In error:", error);
        toast({
          variant: 'destructive',
          title: 'Authentication Error',
          description: error.message || 'Failed to sign in.',
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  /**
   * Admin Login Flow: Email/Password Authentication.
   */
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    setIsLoggingIn(true);

    let signedInUser = null;

    try {
      signedInUser = await AuthService.signInWithEmail(auth, adminEmail, adminPassword);
    } catch (error: any) {
      if (
        (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') &&
        adminEmail === 'admin@neu.edu.ph' && 
        adminPassword === 'adminpassword'
      ) {
        try {
          signedInUser = await AuthService.signUpWithEmail(auth, adminEmail, adminPassword);
        } catch (signUpError: any) {
          console.error("Failed to provision admin:", signUpError);
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: 'Invalid administrative credentials.',
        });
        setIsLoggingIn(false);
        return;
      }
    }

    if (!signedInUser) {
      setIsLoggingIn(false);
      return;
    }

    try {
      const profile = await UserService.syncProfile(firestore, signedInUser, 'admin');

      if (profile.status === 'blocked') {
        alert("Administrative access blocked.");
        await AuthService.logout(auth);
        setIsLoggingIn(false);
        return;
      }

      toast({ title: 'Access Granted', description: 'Redirecting to admin portal...' });
      router.push('/admin');
    } catch (error: any) {
      console.error("Profile sync error:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to synchronize administrative profile.',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      await AuthService.logout(auth);
      toast({ title: 'Signed Out', description: 'You have been disconnected.' });
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
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl">
            <Monitor className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary font-headline">NEU LabTrack</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Institutional Laboratory Management</p>
        </div>

        {user && (
          <div className="p-3 bg-card border rounded-xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center font-bold text-primary shadow-inner text-xs">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold leading-none">{user.displayName || 'Staff'}</p>
                <p className="text-[10px] text-muted-foreground font-medium">{user.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-8 text-[10px] text-destructive hover:bg-destructive/10">
              <LogOut className="w-3 h-3 mr-1" />
              Sign Out
            </Button>
          </div>
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
                <Alert className="bg-primary/5 border border-primary/20 text-left">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm font-medium">
                    Authenticate as a **Professor** with your @neu.edu.ph account.
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-md gap-3"
                >
                  {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <Monitor className="w-5 h-5" />}
                  Professor Google Login
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="admin" className="p-6 space-y-4 m-0">
              <div className="space-y-4">
                <Alert className="bg-accent/5 border border-accent/20 text-left">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  <AlertDescription className="text-sm font-medium">
                    Authenticate as an **Administrator**. You can use Google or email.
                  </AlertDescription>
                </Alert>
                
                <Button 
                  variant="outline"
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full h-14 border-2 font-bold gap-3"
                >
                  {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Admin Google Login
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or password</span></div>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-4 text-left">
                  <div className="space-y-2">
                    <Label htmlFor="email">Admin Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="admin@neu.edu.ph" 
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required 
                    />
                  </div>
                  <Button 
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full h-12 font-bold bg-primary hover:bg-primary/90 shadow-md gap-2"
                  >
                    {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    Login as Admin
                  </Button>
                </form>
              </div>
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
