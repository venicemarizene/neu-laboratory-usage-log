
"use client"

import { useState, useEffect, useMemo, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Search, Calendar as CalendarIcon, Users, Monitor, Ban, Loader2, Activity, X, TrendingUp, TrendingDown, Zap, Timer } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import UsageReport from '@/components/UsageReport';

const roomList = ['M101', 'M102', 'M103', 'M104', 'M105', 'M106', 'M107', 'M108', 'M109', 'M110', 'M111'];

const chartConfig = {
  count: {
    label: "Usage Frequency",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

function formatDuration(minutes: number | undefined): string {
  if (!minutes) return "-";
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

/**
 * Administrative Analytics Hub.
 */
export default function AdminDashboard(props: { params: Promise<any>; searchParams: Promise<any> }) {
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'custom'>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const firestore = useFirestore();

  const logsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'logs'), orderBy('loginTime', 'desc'), limit(1000));
  }, [firestore]);

  const { data: logs, isLoading: isLogsLoading } = useCollection(logsQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const { data: userProfiles } = useCollection(usersQuery);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const startOfMonth = Date.now() - (30 * 24 * 60 * 60 * 1000);

    return logs.filter(log => {
      const logTime = new Date(log.loginTime).getTime();
      const profEmail = log.professorEmail || '';
      const roomNum = log.roomNumber || '';
      const term = searchTerm.toLowerCase();

      const matchesSearch = 
        profEmail.toLowerCase().includes(term) ||
        roomNum.toLowerCase().includes(term);
      
      let matchesDate = true;
      if (dateFilter === 'today') matchesDate = logTime >= startOfToday;
      if (dateFilter === 'weekly') matchesDate = logTime >= startOfWeek;
      if (dateFilter === 'monthly') matchesDate = logTime >= startOfMonth;
      if (dateFilter === 'custom') {
        if (startDate) {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && logTime >= s.getTime();
        }
        if (endDate) {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && logTime <= e.getTime();
        }
      }

      return matchesSearch && matchesDate;
    });
  }, [logs, searchTerm, dateFilter, startDate, endDate]);

  const chartData = useMemo(() => {
    return roomList.map(room => ({
      room,
      count: filteredLogs.filter(l => l.roomNumber === room).length
    }));
  }, [filteredLogs]);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const roomCounts = roomList.reduce((acc, room) => {
      acc[room] = filteredLogs.filter(l => l.roomNumber === room).length;
      return acc;
    }, {} as Record<string, number>);

    const sortedRooms = Object.entries(roomCounts).sort((a, b) => b[1] - a[1]);
    
    const hourCounts = filteredLogs.reduce((acc, log) => {
      const hour = new Date(log.loginTime).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);

    return {
      totalUsesToday: (logs || []).filter(l => new Date(l.loginTime).getTime() >= startOfDay).length,
      totalUniqueProfessors: new Set((logs || []).map(l => l.professorEmail)).size,
      totalBlockedUsers: (userProfiles || []).filter(u => u.status === 'blocked').length,
      mostUsedRoom: sortedRooms[0],
      leastUsedRoom: sortedRooms[sortedRooms.length - 1],
      peakHour: sortedHours[0] ? format(new Date().setHours(Number(sortedHours[0][0]), 0, 0, 0), "ha") : 'N/A'
    };
  }, [logs, userProfiles, filteredLogs]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tight">Institutional Analytics</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-[10px]">Laboratory Usage Monitor</p>
        </div>
        <UsageReport logs={filteredLogs} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-xl rounded-3xl bg-gradient-to-br from-primary to-primary/90 text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] opacity-80 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Today's Traffic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{stats.totalUsesToday}</div>
            <p className="text-xs mt-2 font-bold opacity-70 italic">Active sessions recorded today</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-xl rounded-3xl bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" /> Active Faculty
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-primary">{stats.totalUniqueProfessors}</div>
            <p className="text-xs mt-2 font-bold text-muted-foreground">Unique institutional users</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-xl rounded-3xl bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Ban className="h-4 w-4 text-destructive" /> Security Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-destructive">{stats.totalBlockedUsers}</div>
            <p className="text-xs mt-2 font-bold text-muted-foreground">Restricted system access</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-lg rounded-2xl bg-white border-l-4 border-l-green-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">High Demand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-slate-900">{stats.mostUsedRoom?.[0] || '—'}</span>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg rounded-2xl bg-white border-l-4 border-l-amber-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Low Demand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-slate-900">{stats.leastUsedRoom?.[0] || '—'}</span>
              <TrendingDown className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg rounded-2xl bg-white border-l-4 border-l-accent">
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Peak Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-slate-900">{stats.peakHour}</span>
              <Zap className="h-5 w-5 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-card">
        <CardHeader className="border-b px-8 py-6">
          <CardTitle className="text-xl font-black">Room Usage Distribution</CardTitle>
          <CardDescription>Frequency analysis across M101–M111</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <div className="h-[300px] w-full">
            <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="room" tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: 900 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={30}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "hsl(var(--primary))" : "hsl(var(--accent))"} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-card">
        <CardHeader className="px-8 py-6 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-black">Institutional Log Ledger</CardTitle>
              <CardDescription>Authoritative laboratory usage records</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search logs..." 
                  className="pl-9 h-10 w-64 rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
                <SelectTrigger className="w-40 rounded-xl font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="weekly">This Week</SelectItem>
                  <SelectItem value="monthly">This Month</SelectItem>
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
                <TableHead className="font-black">Duration</TableHead>
                <TableHead className="font-black px-8 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLogsLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-bold italic">No records found</TableCell></TableRow>
              ) : (
                filteredLogs.map(log => (
                  <TableRow key={log.id} className="group">
                    <TableCell className="px-8 font-bold">{log.professorEmail.split('@')[0]}</TableCell>
                    <TableCell><Badge variant="outline" className="font-black bg-white">{log.roomNumber}</Badge></TableCell>
                    <TableCell className="text-xs font-medium">{new Date(log.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                    <TableCell className="text-xs font-medium">
                      {log.logoutTime ? new Date(log.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-primary">{formatDuration(log.duration)}</TableCell>
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
