import Link from 'next/link';
import { LayoutDashboard, Users, ClipboardList, LogOut, Microscope } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start text-white hover:bg-white/10 gap-3">
              <LogOut className="w-5 h-5" />
              Sign Out
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card px-8 flex items-center justify-between">
          <h2 className="font-semibold text-lg text-primary">Administrator Panel</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">admin@neu.edu</span>
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center font-bold text-primary text-xs">
              AD
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