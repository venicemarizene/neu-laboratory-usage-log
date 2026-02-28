
"use client"

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, UserRound, Mail, QrCode, Loader2, ShieldAlert, UserX, UserCheck } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';

export default function ProfessorManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const firestore = useFirestore();
  const { toast } = useToast();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'user_profiles');
  }, [firestore]);

  const { data: users, isLoading } = useCollection(usersQuery);

  const toggleBlocked = (uid: string, currentStatus: boolean, profName: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'user_profiles', uid);
    
    // Toggle the isBlocked status in Firestore
    updateDocumentNonBlocking(docRef, { isBlocked: !currentStatus });
    
    toast({
      title: !currentStatus ? 'Access Restricted' : 'Access Restored',
      description: `${profName}'s account has been ${!currentStatus ? 'blocked' : 'unblocked'}.`,
      variant: !currentStatus ? 'destructive' : 'default',
    });
  };

  const filtered = useMemo(() => {
    return (users || []).filter(p => {
      const name = p.name || '';
      const email = p.email || '';
      const term = searchTerm.toLowerCase();
      
      const matchesSearch = name.toLowerCase().includes(term) || email.toLowerCase().includes(term);
      
      // Show all institutional users so admin can find and manage them, 
      // but prioritize displaying those with the Professor role or who have logged usage.
      return matchesSearch;
    });
  }, [users, searchTerm]);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Professor Directory</h1>
          <p className="text-muted-foreground font-medium">Search faculty and manage system access permissions</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by professor name or email..." 
            className="pl-10 border-2 h-12 rounded-xl bg-card"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-card">
        <CardHeader className="bg-card border-b pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">Access Control Center</CardTitle>
              <CardDescription>
                Review faculty accounts and toggle laboratory access. Blocked users cannot register new sessions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Retrieving Directory...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold py-5 px-6">Faculty Member</TableHead>
                  <TableHead className="font-bold py-5">Institutional Email</TableHead>
                  <TableHead className="font-bold py-5">Current Status</TableHead>
                  <TableHead className="text-right font-bold py-5 px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-24">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <UserRound className="w-12 h-12 opacity-20" />
                        <p className="font-bold text-lg">No matching records found</p>
                        <p className="text-sm">Try searching with a different name or email address.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((prof) => (
                    <TableRow key={prof.id} className="hover:bg-slate-50/80 transition-colors group">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm transition-transform group-hover:scale-110 ${
                            prof.isBlocked ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                          }`}>
                            {prof.name?.[0] || prof.email?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block leading-none mb-1">{prof.name || 'Anonymous Faculty'}</span>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{prof.role || 'User'}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                          <Mail className="w-4 h-4 text-primary/40" />
                          {prof.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {prof.isBlocked ? (
                          <Badge variant="destructive" className="gap-1 px-3 py-1 rounded-full font-bold">
                            <UserX className="w-3 h-3" />
                            Access Blocked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 px-3 py-1 rounded-full font-bold border-green-200 bg-green-50 text-green-700">
                            <UserCheck className="w-3 h-3" />
                            Authorized
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex items-center justify-end gap-3">
                          <span className={`text-xs font-bold uppercase ${prof.isBlocked ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {prof.isBlocked ? 'Blocked' : 'Active'}
                          </span>
                          <Switch 
                            checked={!!prof.isBlocked}
                            onCheckedChange={() => toggleBlocked(prof.id, !!prof.isBlocked, prof.name || prof.email)}
                            className="data-[state=checked]:bg-destructive"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
