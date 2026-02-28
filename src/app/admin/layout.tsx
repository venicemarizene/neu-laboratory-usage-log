
"use client"

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Users, LogOut, Microscope, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useEffect } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { auth } = useAuth() ? { auth: useAuth() } : { auth: null };
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/');
    }
  };

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-primary text-primary-foreground hidden md:flex flex-col p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-10 px-2">
          <Microscope className="w-8 h-8 text-accent" />
          <span className="text-xl font-bold tracking-tight font-headline">NEU Lab</span>
        </div>
        
        <nav className="flex-1 space-y-2">
          <Link href="/admin" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors">
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <Link href="/admin/professors" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors">
            <Users className="w-5 h-5" />
            <span>Professors</span>
          </Link>
        </nav>

        <div className="pt-6 border-t border-white/10">
          <Button 
            variant="ghost" 
            onClick={handleSignOut}
            className="w-full justify-start text-white hover:bg-white/10 gap-3"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card px-8 flex items-center justify-between">
          <h2 className="font-semibold text-lg text-primary">Administrator Panel</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center font-bold text-primary text-xs">
              {user.displayName?.[0] || 'A'}
            </div>
          </div>
        </header>
        <div className="p-8 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
