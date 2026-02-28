
"use client"

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Search, Calendar, Users, Monitor, Ban, FileText, Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const roomList = ['M101', 'M102', 'M103', 'M104', 'M105', 'M106', 'M107', 'M108', 'M109', 'M110', 'M111'];

const chartConfig = {
  count: {
    label: "Usage Count",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export default function AdminDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekly' | 'monthly'>('all');
  const [mounted, setMounted] = useState(false);
  const { firestore } = useFirestore() ? { firestore: useFirestore() } : { firestore: null };

  // Fetch real-time logs
  const logsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'room_logs'), orderBy('timestamp', 'desc'), limit(500));
  }, [firestore]);

  const { data: logs, isLoading: isLogsLoading } = useCollection(logsQuery);

  // Fetch all user profiles for metrics
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
    
    // Using simple subtraction for prototype robustness
    const startOfWeek = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const startOfMonth = Date.now() - (30 * 24 * 60 * 60 * 1000);

    return logs.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      const matchesSearch = 
        log.professorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.roomNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      
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
      count: (logs || []).filter(l => l.roomNumber === room).length
    }));
  }, [logs]);

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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-headline text-primary tracking-tight">Laboratory Analytics</h1>
          <p className="text-muted-foreground font-medium">Monitoring institutional computer laboratory utilization</p>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="outline" className="gap-2 border-2">
             <FileText className="w-4 h-4" />
             Export Data
           </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-lg hover:scale-[1.02] transition-transform duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Active Logs Today</CardTitle>
            <Monitor className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">{stats.totalUsesToday}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Sessions recorded since midnight</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-lg hover:scale-[1.02] transition-transform duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Unique Faculty</CardTitle>
            <Users className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-accent">{stats.totalUniqueProfessors}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Distinct professors active in labs</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-lg hover:scale-[1.02] transition-transform duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Restricted Access</CardTitle>
            <Ban className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-destructive">{stats.totalBlockedUsers}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Professor accounts currently blocked</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Chart Section */}
      <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Computer Laboratory Distribution</CardTitle>
          <CardDescription>Frequency of use across computer laboratories M101 to M111</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-[350px] w-full">
            <ChartContainer config={chartConfig}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="room" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 600 }}
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

      {/* Logs Table */}
      <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-card border-b pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold">Laboratory Usage Logs</CardTitle>
              <CardDescription>Detailed stream of all computer lab interactions</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search professor or room..." 
                  className="pl-10 h-10 border-2"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
                <SelectTrigger className="w-full sm:w-40 h-10 border-2">
                  <SelectValue placeholder="Period" />
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
          {isLogsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Synchronizing laboratory data...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold py-4">Professor Name</TableHead>
                  <TableHead className="font-bold py-4">Room Number</TableHead>
                  <TableHead className="font-bold py-4">Session Date & Time</TableHead>
                  <TableHead className="font-bold py-4">Verification Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20 text-muted-foreground font-medium">
                      No matching laboratory activity logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-accent/5 transition-colors group">
                      <TableCell className="font-bold text-slate-700">{log.professorName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono bg-white">
                          {log.roomNumber}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground font-medium">
                          <Calendar className="w-4 h-4" />
                          {new Date(log.timestamp).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
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
