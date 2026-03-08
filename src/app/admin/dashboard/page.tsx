
"use client"

import { useState, useMemo, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Monitor, Activity, Clock, Timer, Calendar as CalendarIcon } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminDashboard(props: { params: Promise<any>; searchParams: Promise<any> }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roomFilter, setRoomFilter] = useState('all');
  const firestore = useFirestore();

  const logsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roomLogs'), orderBy('timeIn', 'desc'), limit(1000));
  }, [firestore]);

  const { data: logs, isLoading: isLogsLoading } = useCollection(logsQuery);

  const stats = useMemo(() => {
    if (!logs) return { active: 0, today: 0, uniqueProfs: 0 };
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const todayLogs = logs.filter(l => l.timeIn && l.timeIn.toDate() >= startOfDay);
    const activeLogs = logs.filter(l => l.status === 'active');
    const uniqueProfs = new Set(logs.map(l => l.professorEmail)).size;

    return {
      active: activeLogs.length,
      today: todayLogs.length,
      uniqueProfs: uniqueProfs
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter(log => {
      const matchesSearch = log.professorEmail.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRoom = roomFilter === 'all' || log.room === roomFilter;
      return matchesSearch && matchesRoom;
    });
  }, [logs, searchTerm, roomFilter]);

  const roomList = Array.from({ length: 11 }, (_, i) => `M${101 + i}`);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tight">Institutional Analytics</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Room Usage Monitor</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-xl bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest opacity-80 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Active Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{stats.active}</div>
            <p className="text-xs mt-2 opacity-70">Professors currently in labs</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-xl bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" /> Today's Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-primary">{stats.today}</div>
            <p className="text-xs mt-2 text-muted-foreground">Total room logs recorded today</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-xl bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Total Faculty
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-primary">{stats.uniqueProfs}</div>
            <p className="text-xs mt-2 text-muted-foreground">Unique professors logged</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-card">
        <CardHeader className="px-8 py-6 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-black">Room Usage Logs</CardTitle>
              <CardDescription>Activity logs for M101–M111</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search professor..." 
                  className="pl-9 h-10 w-64 rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={roomFilter} onValueChange={setRoomFilter}>
                <SelectTrigger className="w-32 rounded-xl font-bold">
                  <SelectValue placeholder="Room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  {roomList.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-black px-8">Professor</TableHead>
                <TableHead className="font-black">Room</TableHead>
                <TableHead className="font-black">Time In</TableHead>
                <TableHead className="font-black">Time Out</TableHead>
                <TableHead className="font-black px-8 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLogsLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20">Loading logs...</TableCell></TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground">No records found</TableCell></TableRow>
              ) : (
                filteredLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="px-8 font-bold">{log.professorEmail}</TableCell>
                    <TableCell><Badge variant="outline">{log.room}</Badge></TableCell>
                    <TableCell className="text-xs font-medium">{log.timeIn?.toDate() ? format(log.timeIn.toDate(), "MMM d, h:mm a") : '-'}</TableCell>
                    <TableCell className="text-xs font-medium">{log.timeOut?.toDate() ? format(log.timeOut.toDate(), "MMM d, h:mm a") : '-'}</TableCell>
                    <TableCell className="px-8 text-right">
                      <Badge className={cn(
                        "text-[10px] font-black uppercase",
                        log.status === 'active' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"
                      )}>
                        {log.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
