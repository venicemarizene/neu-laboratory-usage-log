
"use client"

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, UserRound, Mail, QrCode, Loader2, ShieldAlert } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
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
    
    // Ensure we preserve existing fields while toggling status
    updateDocumentNonBlocking(docRef, { isBlocked: !currentStatus });
    
    toast({
      title: !currentStatus ? 'Access Restricted' : 'Access Restored',
      description: `${profName}'s account has been ${!currentStatus ? 'blocked' : 'unblocked'}.`,
      variant: !currentStatus ? 'destructive' : 'default',
    });
  };

  const filtered = (users || []).filter(p => 
    p.role === 'Professor' && (
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline text-primary">Professor Directory</h1>
          <p className="text-muted-foreground">Manage laboratory access and profile statuses</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search professors..." 
            className="pl-10 border-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-card border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            Access Control Management
          </CardTitle>
          <CardDescription>Toggle account status to grant or revoke computer lab access.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Loading directory...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold">Faculty Member</TableHead>
                  <TableHead className="font-bold">Contact Email</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="text-right font-bold">Restrict Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">
                      No matching professor records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((prof) => (
                    <TableRow key={prof.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                            {prof.name?.[0] || prof.email?.[0]?.toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-700">{prof.name || 'Anonymous Faculty'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground font-medium">
                          <Mail className="w-3 h-3" />
                          {prof.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={prof.isBlocked ? "destructive" : "outline"}
                          className={prof.isBlocked ? "" : "border-green-200 bg-green-50 text-green-700"}
                        >
                          {prof.isBlocked ? "Blocked" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end pr-4">
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
