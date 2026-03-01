"use client"

import { useState, useEffect, useMemo, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Search, Calendar, Users, Monitor, Ban, FileText, Loader2, Activity } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const roomList = ['M101', 'M102', 'M103', 'M104', 'M105', 'M106', 'M107', 'M108', 'M109', 'M110', 'M111'];

const chartConfig = {
  count: {
    label: "Usage Count",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

/**
 * Main Administrative Analytics Dashboard.
 * Unwraps Next.js 15 params/searchParams using use().
 */
export default function AdminDashboard(props: { params: Promise<any>; searchParams: Promise<any> }) {
  // Next.js 15: unwrap params explicitly to avoid enumeration errors
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekly' | 'monthly'>('all');
  const [mounted, setMounted] = useState(false);
  const firestore = useFirestore();

  // Stabilized queries
  const logsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'room_logs'), orderBy('timestamp', 'desc'), limit(1000));
  }, [firestore]);

  const { data: logs, isLoading: isLogsLoading } = useCollection(logsQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'user_profiles');
  }, [firestore]);

  const { data: profiles } = useCollection(usersQuery);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
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
      if (dateFilter === 'today') matchesDate = logTime >= startOfDay;
      if (dateFilter === 'weekly') matchesDate = logTime >= startOfWeek;
      if (dateFilter === 'monthly') matchesDate = logTime >= startOfMonth;

      return matchesSearch && matchesDate;
    });
  }, [logs, searchTerm, dateFilter]);

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
      totalBlockedUsers: (profiles || []).filter(u => u.isBlocked).length,
    };
  }, [logs, profiles]);

  if (!mounted) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black font-headline text-primary tracking-tight">Laboratory Analytics</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-xs">Monitoring institutional computer laboratory utilization</p>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="outline" className="gap-2 border-2 rounded-xl font-bold bg-card shadow-sm transition-all duration-200">
             <FileText className="w-4 h-4" />
             Export Period Data
           </Button>
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
          <CardDescription>Visual frequency of usage across M101–M111 for current filters</CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <div className="h-[350px] w-full">
            <ChartContainer config={chartConfig}>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold">Laboratory Activity Logs</CardTitle>
              <CardDescription>Real-time summary and search of room interactions</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search professor or room..." 
                  className="pl-10 h-11 border-2 rounded-xl transition-all duration-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
                <SelectTrigger className="w-full sm:w-44 h-11 border-2 rounded-xl font-bold transition-all duration-200">
                  <Calendar className="w-4 h-4 mr-2 opacity-50" />
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Logs</SelectItem>
                  <SelectItem value="today">Today Only</SelectItem>
                  <SelectItem value="weekly">Past 7 Days</SelectItem>
                  <SelectItem value="monthly">Past 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold py-5 px-6">Faculty Member</TableHead>
                  <TableHead className="font-bold py-5">Computer Laboratory</TableHead>
                  <TableHead className="font-bold py-5">Session Timestamp</TableHead>
                  <TableHead className="font-bold py-5 px-6">Verification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-24 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Monitor className="w-12 h-12 opacity-10" />
                        <p className="font-bold text-lg">No laboratory activity logs found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-accent/5 transition-colors duration-200 group">
                      <TableCell className="font-bold text-slate-800 px-6 py-4">{log.professorName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono px-3 py-1 bg-white shadow-sm rounded-lg border-primary/20 text-primary">
                          {log.roomNumber}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground font-bold text-sm">
                          <Calendar className="w-4 h-4 text-primary/40" />
                          {new Date(log.timestamp).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 px-3 py-1 rounded-full font-bold">
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