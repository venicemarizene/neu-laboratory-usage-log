import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, ShieldCheck, Microscope } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg transform transition hover:scale-105">
            <Microscope className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-primary font-headline">NEU Lab Log</h1>
          <p className="text-muted-foreground">Institutional Laboratory Access Management System</p>
        </div>

        <Card className="border-none shadow-xl">
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>
              Sign in with your institutional Google account to manage or log lab usage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/professor" className="block">
              <Button className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90 transition-all flex items-center justify-center gap-3">
                <LogIn className="w-5 h-5" />
                Sign in with Google
              </Button>
            </Link>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Administrative</span>
              </div>
            </div>

            <Link href="/admin" className="block">
              <Button variant="outline" className="w-full h-12 border-2 hover:bg-accent transition-all flex items-center justify-center gap-3">
                <ShieldCheck className="w-5 h-5 text-accent-foreground" />
                Admin Dashboard Login
              </Button>
            </Link>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          By continuing, you agree to follow the institutional laboratory safety protocols and data usage policies.
        </p>
      </div>
    </div>
  );
}