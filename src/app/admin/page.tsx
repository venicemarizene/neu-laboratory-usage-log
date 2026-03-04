"use client"

import { useState, useEffect, useMemo, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Search, Calendar as CalendarIcon, Users, Monitor, Ban, FileText, Loader2, Activity, X } from 'lucide-react';
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

const roomList = ['M101', 'M102', 'M103', 'M104', 'M105', 'M106', 'M107', 'M108', 'M109', 'M110', 'M111'];

const chartConfig = {
  count: {
    label: "Usage Count",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

/**
 * Administrative Dashboard for monitoring laboratory usage.
 */
export default function AdminDashboard(props: { params: Promise<any>; searchParams: Promise<any> }) {
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'custom'>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const firestore = useFirestore();

  const logsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'room_logs'), orderBy('timestamp', 'desc'), limit(2000));
  }, [firestore]);

  const { data: logs, isLoading: isLogsLoading } = useCollection(logsQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const { data: userProfiles } = useCollection(usersQuery);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const startOfWeek = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const startOfMonth = Date.now() - (30 * 24 * 60 * 60 * 1000);

    return logs.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      const profName = log.professorName || '';
      const roomNum = log.roomNumber || '';
      const term = searchTerm.toLowerCase();

      const matchesSearch = 
        profName.toLowerCase().includes(term) ||
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
    return {
      totalUsesToday: (logs || []).filter(l => new Date(l.timestamp).getTime() >= startOfDay).length,
      totalUniqueProfessors: new Set((logs || []).map(l => l.professorId)).size,
      totalBlockedUsers: (userProfiles || []).filter(u => u.status === 'blocked').length,
    };
  }, [logs, userProfiles]);

  if (!mounted) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black font-headline text-primary tracking-tight">Laboratory Analytics</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-xs">NEU Computer Laboratory Management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl bg-gradient-to-br from-primary to-primary/90 text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] opacity-80">Active Logs Today</CardTitle>
            <Activity className="h-5 w-5 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{stats.totalUsesToday}</div>
            <p className="text-xs mt-2 font-bold opacity-70">New sessions since 00:00</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Unique Faculty</CardTitle>
            <Users className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-primary">{stats.totalUniqueProfessors}</div>
            <p className="text-xs mt-2 font-bold text-muted-foreground">Active teaching staff</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Blocked Accounts</CardTitle>
            <Ban className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-destructive">{stats.totalBlockedUsers}</div>
            <p className="text-xs mt-2 font-bold text-muted-foreground">Restricted system access</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-card transition-all duration-300">
        <CardHeader className="border-b pb-6">
          <CardTitle className="text-xl font-bold">Computer Laboratory Distribution</CardTitle>
          <CardDescription>Visual frequency of usage across M101–M111</CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <div className="h-[350px] w-full min-w-0">
            <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="room" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "hsl(var(--primary))" : "hsl(var(--accent))"} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-card transition-all duration-300">
        <CardHeader className="bg-card border-b pb-6">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold">Activity Logs</CardTitle>
                <CardDescription>Search and filter institutional usage</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search..." 
                    className="pl-10 h-11 border-2 rounded-xl"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
                  <SelectTrigger className="w-full sm:w-44 h-11 border-2 rounded-xl font-bold">
                    <CalendarIcon className="w-4 h-4 mr-2 opacity-50" />
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Logs</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {dateFilter === 'custom' && (
              <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-xl border border-dashed">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-48 h-10 border-2 rounded-lg font-bold justify-start text-left", !startDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-48 h-10 border-2 rounded-lg font-bold justify-start text-left", !endDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="mt-5 rounded-full hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLogsLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Updating...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="font-bold py-5 px-6">Faculty</TableHead>
                  <TableHead className="font-bold py-5">Laboratory</TableHead>
                  <TableHead className="font-bold py-5">Timestamp</TableHead>
                  <TableHead className="font-bold py-5 px-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-24 text-muted-foreground">
                      No logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-bold px-6 py-4">{log.professorName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {log.roomNumber}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          {log.status}
                        </Badge>
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
