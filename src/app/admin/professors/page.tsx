
"use client"

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, UserRound, Mail, QrCode, Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';

export default function ProfessorManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const { firestore } = useFirestore() ? { firestore: useFirestore() } : { firestore: null };
  const { toast } = useToast();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'user_profiles');
  }, [firestore]);

  const { data: users, isLoading } = useCollection(usersQuery);

  const professors = (users || []).filter(u => u.role === 'Professor');

  const toggleBlocked = (uid: string, currentStatus: boolean) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'user_profiles', uid);
    
    updateDocumentNonBlocking(docRef, { isBlocked: !currentStatus });
    
    toast({
      title: !currentStatus ? 'Access Revoked' : 'Access Restored',
      description: `Professor account status has been updated.`,
      variant: !currentStatus ? 'destructive' : 'default',
    });
  };

  const filtered = professors.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold font-headline text-primary">Professor Directory</h1>
        <p className="text-muted-foreground">Manage laboratory access and profile statuses</p>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Staff Access Control</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Find a professor..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>QR Token</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Block Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      No professors found in the directory.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((prof) => (
                    <TableRow key={prof.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <UserRound className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-medium">{prof.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          {prof.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <QrCode className="w-3 h-3" />
                          {prof.qrString || 'No Token'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={prof.isBlocked ? "destructive" : "secondary"}>
                          {prof.isBlocked ? "Blocked" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch 
                          checked={prof.isBlocked}
                          onCheckedChange={() => toggleBlocked(prof.id, !!prof.isBlocked)}
                        />
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
