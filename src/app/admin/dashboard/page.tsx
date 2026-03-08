"use client"

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Activity, Clock, Timer, Calendar as CalendarIcon, TrendingUp, X, Ban, BarChart3, Monitor } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { format, differenceInMinutes, startOfDay, subDays, subMonths, isWithinInterval, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';

const roomList = Array.from({ length: 11 }, (_, i) => `M${101 + i}`);

const chartConfig = {
  usage: {
    label: "Usage Count",
    color: "hsl(var(--primary))",
  },
  trend: {
    label: "Monthly Usage",
    color: "hsl(var(--accent))",
  }
} satisfies ChartConfig;

/**
 * Formats duration in minutes to a readable "Hh Mm" format.
 */
function formatDuration(minutes: number | undefined): string {
  if (minutes === undefined || minutes < 0) return "-";
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export default function AdminDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'custom'>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  const firestore = useFirestore();

  const logsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roomLogs'), orderBy('timeIn', 'desc'), limit(2000));
  }, [firestore]);

  const { data: logs, isLoading: isLogsLoading } = useCollection(logsQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const { data: users } = useCollection(usersQuery);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    const now = new Date();
    
    return logs.filter(log => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        log.professorEmail.toLowerCase().includes(term) || 
        log.room.toLowerCase().includes(term);
      
      const logDate = log.timeIn?.toDate ? log.timeIn.toDate() : null;
      if (!logDate) return matchesSearch;

      let matchesPeriod = true;
      if (periodFilter === 'today') {
        matchesPeriod = logDate >= startOfDay(now);
      } else if (periodFilter === 'weekly') {
        matchesPeriod = logDate >= subDays(now, 7);
      } else if (periodFilter === 'monthly') {
        matchesPeriod = logDate >= subMonths(now, 1);
      } else if (periodFilter === 'custom') {
        if (startDate) {
          const s = startOfDay(startDate);
          const e = endDate ? new Date(endDate) : new Date(now);
          if (endDate) e.setHours(23, 59, 59, 999);
          matchesPeriod = isWithinInterval(logDate, { start: s, end: e });
        }
      }

      return matchesSearch && matchesPeriod;
    });
  }, [logs, searchTerm, periodFilter, startDate, endDate]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    
    const activeLogs = (logs || []).filter(l => l.status === 'active');
    const activeCount = activeLogs.length;
    const activeRoomsCount = new Set(activeLogs.map(l => l.room)).size;
    
    const professorsToday = new Set((logs || []).filter(l => l.timeIn?.toDate && l.timeIn.toDate() >= todayStart).map(l => l.professorEmail)).size;
    const blockedCount = (users || []).filter(u => u.status === 'blocked').length;

    return {
      active: activeCount,
      activeRooms: activeRoomsCount,
      todayProfessors: professorsToday,
      blocked: blockedCount,
    };
  }, [logs, users]);

  const roomChartData = useMemo(() => {
    return roomList.map(room => ({
      room,
      usage: (logs || []).filter(l => l.room === room).length
    }));
  }, [logs]);

  const monthlyTrendData = useMemo(() => {
    if (!logs) return [];
    const now = new Date();
    // Start interval from January 1, 2026 onwards
    const trendStart = new Date(2026, 0, 1);
    const trendEnd = now < trendStart ? trendStart : now;
    
    const months = eachMonthOfInterval({ start: trendStart, end: trendEnd });

    return months.map(m => {
      const monthStr = format(m, 'MMM yy');
      const count = (logs || []).filter(l => {
        const d = l.timeIn?.toDate ? l.timeIn.toDate() : null;
        return d && d >= startOfMonth(m) && d <= endOfMonth(m);
      }).length;
      return { month: monthStr, count };
    });
  }, [logs]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tight">Laboratory Analytics</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mt-1">Computer Laboratory Management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-xl bg-primary text-primary-foreground rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Active Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black tracking-tighter">{stats.active}</div>
            <p className="text-xs mt-2 font-medium opacity-70">Faculty currently in labs</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-card rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" /> Active Rooms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-primary tracking-tighter">{stats.activeRooms}</div>
            <p className="text-xs mt-2 text-muted-foreground font-medium">Laboratories currently in use</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-xl bg-card rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" /> Today's Professors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-primary tracking-tighter">{stats.todayProfessors}</div>
            <p className="text-xs mt-2 text-muted-foreground font-medium">Unique educators recorded today</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-xl bg-card rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Ban className="h-4 w-4 text-destructive" /> Blocked Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-destructive tracking-tighter">{stats.blocked}</div>
            <p className="text-xs mt-2 text-muted-foreground font-medium">Restricted institutional access</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-card">
          <CardHeader className="border-b pb-6 px-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Monthly Usage Trend</CardTitle>
                <CardDescription>Laboratory session volume starting January 2026</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 px-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrendData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-card">
          <CardHeader className="border-b pb-6 px-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-xl">
                <BarChart3 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Room Distribution</CardTitle>
                <CardDescription>Usage frequency across labs M101–M111</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 px-4">
            <div className="h-[300px] w-full">
              <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
                <BarChart data={roomChartData}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="room" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="usage" radius={[6, 6, 0, 0]} barSize={32}>
                    {roomChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "hsl(var(--primary))" : "hsl(var(--accent))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-card">
        <CardHeader className="px-8 py-8 border-b">
          <div className="flex flex-col space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-black">Activity Logs</CardTitle>
                <CardDescription>Comprehensive historical usage tracking</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search email or room..." 
                    className="pl-9 h-11 border-2 rounded-xl bg-slate-50/50"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={periodFilter} onValueChange={(v: any) => setPeriodFilter(v)}>
                  <SelectTrigger className="w-full sm:w-48 h-11 border-2 rounded-xl font-bold bg-slate-50/50">
                    <CalendarIcon className="w-4 h-4 mr-2 opacity-50 text-primary" />
                    <SelectValue placeholder="All Logs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Logs</SelectItem>
                    <SelectItem value="today">Daily View</SelectItem>
                    <SelectItem value="weekly">Weekly View</SelectItem>
                    <SelectItem value="monthly">Monthly View</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {periodFilter === 'custom' && (
              <div className="flex flex-wrap items-center gap-4 p-5 bg-muted/20 rounded-2xl border-2 border-dashed border-slate-200 animate-in slide-in-from-top-2">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-52 h-11 border-2 rounded-xl font-bold justify-start bg-white", !startDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {startDate ? format(startDate, "PPP") : "Select start"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-52 h-11 border-2 rounded-xl font-bold justify-start bg-white", !endDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {endDate ? format(endDate, "PPP") : "Select end"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="mt-6 rounded-full hover:bg-destructive/10 hover:text-destructive h-11 w-11"
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                  }}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="font-black px-8 h-14">Professor Email</TableHead>
                  <TableHead className="font-black h-14">Room</TableHead>
                  <TableHead className="font-black h-14">Time In</TableHead>
                  <TableHead className="font-black h-14">Time Out</TableHead>
                  <TableHead className="font-black h-14">Duration</TableHead>
                  <TableHead className="font-black px-8 text-right h-14">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLogsLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-20"><Activity className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-32 text-muted-foreground font-medium italic">No laboratory activity found for this search</TableCell></TableRow>
                ) : (
                  filteredLogs.map(log => {
                    const timeIn = log.timeIn?.toDate ? log.timeIn.toDate() : null;
                    const timeOut = log.timeOut?.toDate ? log.timeOut.toDate() : null;
                    const durationMins = timeIn && timeOut ? differenceInMinutes(timeOut, timeIn) : undefined;

                    return (
                      <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{log.professorEmail.split('@')[0]}</span>
                            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{log.professorEmail}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="font-mono bg-white border-primary/20 text-primary px-3 py-1">{log.room}</Badge></TableCell>
                        <TableCell className="text-xs font-bold text-slate-600">{timeIn ? format(timeIn, "MMM d, h:mm a") : '-'}</TableCell>
                        <TableCell className="text-xs font-bold text-slate-600">{timeOut ? format(timeOut, "MMM d, h:mm a") : '-'}</TableCell>
                        <TableCell>
                          {durationMins !== undefined ? (
                            <div className="flex items-center gap-2 text-primary">
                              <Timer className="w-3 h-3" />
                              <span className="text-xs font-black">{formatDuration(durationMins)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-8 text-right">
                          <Badge className={cn(
                            "text-[10px] font-black uppercase px-3 py-1 rounded-lg",
                            log.status === 'active' ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          )}>
                            {log.status === 'active' ? 'In progress' : 'Completed'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
