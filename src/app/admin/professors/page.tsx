"use client"

import { useState, useMemo, use, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, UserRound, Mail, Loader2, ShieldAlert, UserX, UserCheck, X, QrCode, Download, Send } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { QRCodeCanvas } from 'qrcode.react';
import { EmailService } from '@/lib/services/email-service';

export default function ProfessorManagement(props: { params: Promise<any>; searchParams: Promise<any> }) {
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEmailing, setIsEmailing] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const firestore = useFirestore();
  const { toast } = useToast();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const { data: users, isLoading } = useCollection(usersQuery);

  const toggleBlocked = (uid: string, currentStatus: string, email: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'users', uid);
    
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    updateDocumentNonBlocking(docRef, { status: newStatus });
    
    toast({
      title: newStatus === 'blocked' ? 'Access Restricted' : 'Access Restored',
      description: `${email}'s account has been ${newStatus}.`,
      variant: newStatus === 'blocked' ? 'destructive' : 'default',
    });
  };

  const generateQR = (user: any) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'users', user.id);
    updateDocumentNonBlocking(docRef, { qrValue: user.email });
    setSelectedUser({ ...user, qrValue: user.email });
    toast({ title: 'QR Generated', description: `Permanent QR code created for ${user.email}` });
  };

  const downloadQR = (email: string) => {
    const canvas = qrRef.current;
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = `${email.split('@')[0]}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const emailQR = async (email: string) => {
    const canvas = qrRef.current;
    if (!canvas) return;

    setIsEmailing(true);
    const url = canvas.toDataURL("image/png");
    
    try {
      await EmailService.sendQREmail(email, url);
      toast({
        title: 'QR Sent',
        description: `The identification QR code has been emailed to ${email}.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Email Failed',
        description: 'Could not send the QR code at this time.',
      });
    } finally {
      setIsEmailing(false);
    }
  };

  const filtered = useMemo(() => {
    if (!users) return [];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return users;

    return users.filter(p => {
      const email = (p.email || '').toLowerCase();
      const role = (p.role || '').toLowerCase();
      return email.includes(term) || role.includes(term);
    });
  }, [users, searchTerm]);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">System Users</h1>
          <p className="text-muted-foreground font-medium">Manage institutional accounts and system access</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by email..." 
            className="pl-10 pr-10 border-2 h-12 rounded-xl bg-card focus-visible:ring-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
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
                Review accounts, toggle access, and manage identification QR codes.
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
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="font-bold py-5 px-6">Institutional Email</TableHead>
                  <TableHead className="font-bold py-5">Role</TableHead>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((userDoc) => (
                    <TableRow key={userDoc.id} className="hover:bg-slate-50/80 transition-colors group">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm transition-transform duration-300 group-hover:scale-110 ${
                            userDoc.status === 'blocked' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                          }`}>
                            {(userDoc.email || 'U')[0].toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-800">{userDoc.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="uppercase text-[10px] tracking-widest font-black">
                          {userDoc.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {userDoc.status === 'blocked' ? (
                          <Badge variant="destructive" className="gap-1 px-3 py-1 rounded-full font-bold">
                            <UserX className="w-3 h-3" />
                            Blocked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 px-3 py-1 rounded-full font-bold border-green-200 bg-green-50 text-green-700">
                            <UserCheck className="w-3 h-3" />
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex items-center justify-end gap-3">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 gap-2 font-bold text-primary hover:bg-primary/5"
                                onClick={() => userDoc.qrValue ? setSelectedUser(userDoc) : generateQR(userDoc)}
                              >
                                <QrCode className="w-4 h-4" />
                                {userDoc.qrValue ? 'View QR' : 'Generate QR'}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-xs text-center">
                              <DialogHeader>
                                <DialogTitle className="text-xl font-bold">Laboratory QR</DialogTitle>
                                <DialogDescription className="font-medium">{userDoc.email}</DialogDescription>
                              </DialogHeader>
                              <div className="flex justify-center p-4 bg-white rounded-2xl border-2 border-slate-50 shadow-inner my-4">
                                <QRCodeCanvas 
                                  ref={qrRef}
                                  value={userDoc.qrValue || userDoc.email} 
                                  size={200}
                                  level="H"
                                  includeMargin
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <Button 
                                  className="w-full h-12 font-bold gap-2 rounded-xl"
                                  onClick={() => downloadQR(userDoc.email)}
                                >
                                  <Download className="w-4 h-4" />
                                  Download PNG
                                </Button>
                                <Button 
                                  variant="outline"
                                  className="w-full h-12 font-bold gap-2 rounded-xl border-2"
                                  disabled={isEmailing}
                                  onClick={() => emailQR(userDoc.email)}
                                >
                                  {isEmailing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                  {isEmailing ? 'Sending...' : 'Email QR Code'}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <div className="flex items-center gap-3 ml-4">
                            <span className={`text-[10px] font-black uppercase tracking-tighter ${userDoc.status === 'blocked' ? 'text-destructive' : 'text-muted-foreground'}`}>
                              Block
                            </span>
                            <Switch 
                              checked={userDoc.status === 'blocked'}
                              onCheckedChange={() => toggleBlocked(userDoc.id, userDoc.status, userDoc.email)}
                              className="data-[state=checked]:bg-destructive"
                            />
                          </div>
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
