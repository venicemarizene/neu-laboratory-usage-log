"use client"

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, Users, LogOut, Monitor, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser, useAuth, useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useEffect, useState, use } from 'react';
import { AuthService } from '@/lib/services/auth-service';

export default function AdminLayout(props: {
  children: React.ReactNode;
  params: Promise<any>;
}) {
  const params = use(props.params);
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isDataLoading } = useDoc(userRef);

  useEffect(() => {
    if (isUserLoading || isDataLoading) return;

    if (!user) {
      setIsAuthorized(false);
      router.push('/');
      return;
    }

    // Role and status guard
    if (!userData || userData.role !== 'admin' || userData.status === 'blocked') {
      console.log("Admin layout access denied for:", user.email, "Role:", userData?.role, "Status:", userData?.status);
      setIsAuthorized(false);
      alert("Access Denied: Administrative privileges required.");
      router.push('/');
      return;
    }

    setIsAuthorized(true);
  }, [user, userData, isUserLoading, isDataLoading, router]);

  const handleSignOut = async () => {
    if (auth) {
      await AuthService.logout(auth);
      router.push('/');
    }
  };

  if (isUserLoading || isDataLoading || isAuthorized === null || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground font-bold text-sm tracking-tight italic">Verifying Admin Privileges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background animate-in fade-in duration-300">
      <aside className="w-64 bg-primary text-primary-foreground hidden md:flex flex-col p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-10 px-2">
          <Monitor className="w-8 h-8 text-accent" />
          <span className="text-xl font-bold tracking-tight font-headline">NEU LabTrack</span>
        </div>
        
        <nav className="flex-1 space-y-2">
          <Link 
            href="/admin" 
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors duration-200 ${
              pathname === '/admin' ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <Link 
            href="/admin/professors" 
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors duration-200 ${
              pathname === '/admin/professors' ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Professor Directory</span>
          </Link>
        </nav>

        <div className="pt-6 border-t border-white/10 space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-accent/20 rounded-lg">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">Admin Mode</span>
          </div>
          <Button 
            variant="ghost" 
            onClick={handleSignOut}
            className="w-full justify-start text-white hover:bg-white/10 gap-3 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 border-b bg-card px-8 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-lg text-primary">Admin Dashboard</h2>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold leading-none">{user?.displayName || 'Administrator'}</p>
              <p className="text-xs text-muted-foreground font-medium">{user?.email}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold text-primary shadow-inner">
              {user?.email?.[0].toUpperCase() || 'A'}
            </div>
          </div>
        </header>
        <div className="flex-1 p-8 overflow-y-auto bg-slate-50/50">
          {props.children}
        </div>
      </main>
    </div>
  );
}
