
"use client"

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Monitor, Activity, Clock, Timer, Calendar as CalendarIcon, TrendingUp, X } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { format, differenceInMinutes, startOfDay, subDays, subMonths, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer } from "recharts";
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
    return query(collection(firestore, 'roomLogs'), orderBy('timeIn', 'desc'), limit(1000));
  }, [firestore]);

  const { data: logs, isLoading: isLogsLoading } = useCollection(logsQuery);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    const now = new Date();
    
    return logs.filter(log => {
      const matchesSearch = log.professorEmail.toLowerCase().includes(searchTerm.toLowerCase());
      
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
        if (startDate && endDate) {
          matchesPeriod = isWithinInterval(logDate, { start: startOfDay(startDate), end: now });
          if (endDate) {
            const e = new Date(endDate);
            e.setHours(23, 59, 59, 999);
            matchesPeriod = isWithinInterval(logDate, { start: startOfDay(startDate), end: e });
          }
        } else if (startDate) {
          matchesPeriod = logDate >= startOfDay(startDate);
        }
      }

      return matchesSearch && matchesPeriod;
    });
  }, [logs, searchTerm, periodFilter, startDate, endDate]);

  const stats = useMemo(() => {
    if (!logs) return { active: 0, today: 0, uniqueProfs: 0 };
    const now = new Date();
    const todayLogs = logs.filter(l => l.timeIn?.toDate && l.timeIn.toDate() >= startOfDay(now));
    const activeLogs = logs.filter(l => l.status === 'active');
    const uniqueProfs = new Set(logs.map(l => l.professorEmail)).size;

    return {
      active: activeLogs.length,
      today: todayLogs.length,
      uniqueProfs: uniqueProfs
    };
  }, [logs]);

  const chartData = useMemo(() => {
    return roomList.map(room => ({
      room,
      usage: filteredLogs.filter(l => l.room === room).length
    }));
  }, [filteredLogs]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tight">Laboratory Analytics</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Computer Laboratory Management</p>
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
            <p className="text-xs mt-2 text-muted-foreground">Total sessions recorded today</p>
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

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-card transition-all duration-300">
        <CardHeader className="border-b pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">Laboratory Usage Distribution</CardTitle>
              <CardDescription>Frequency of usage across laboratories M101–M111</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          <div className="h-[350px] w-full">
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
                <Bar dataKey="usage" radius={[6, 6, 0, 0]} barSize={40}>
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
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-black">Activity Logs</CardTitle>
                <CardDescription>Comprehensive institutional usage history</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search professor..." 
                    className="pl-9 h-10 w-full sm:w-64 rounded-xl"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={periodFilter} onValueChange={(v: any) => setPeriodFilter(v)}>
                  <SelectTrigger className="w-full sm:w-44 h-10 rounded-xl font-bold">
                    <CalendarIcon className="w-4 h-4 mr-2 opacity-50" />
                    <SelectValue placeholder="All Logs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Logs</SelectItem>
                    <SelectItem value="today">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {periodFilter === 'custom' && (
              <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-xl border border-dashed animate-in slide-in-from-top-2">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-48 h-10 border-2 rounded-lg font-bold justify-start text-left", !startDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Pick start date"}
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
                        {endDate ? format(endDate, "PPP") : "Pick end date"}
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
          <div className="overflow-x-auto">
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
                  <TableRow><TableCell colSpan={6} className="text-center py-20">Loading activity...</TableCell></TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground">No records found for this period</TableCell></TableRow>
                ) : (
                  filteredLogs.map(log => {
                    const timeIn = log.timeIn?.toDate ? log.timeIn.toDate() : null;
                    const timeOut = log.timeOut?.toDate ? log.timeOut.toDate() : null;
                    const durationMins = timeIn && timeOut ? differenceInMinutes(timeOut, timeIn) : undefined;

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="px-8 font-bold">
                          <div className="flex flex-col">
                            <span>{log.professorEmail.split('@')[0]}</span>
                            <span className="text-[10px] text-muted-foreground font-medium">{log.professorEmail}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="font-mono">{log.room}</Badge></TableCell>
                        <TableCell className="text-xs font-medium">{timeIn ? format(timeIn, "MMM d, h:mm a") : '-'}</TableCell>
                        <TableCell className="text-xs font-medium">{timeOut ? format(timeOut, "MMM d, h:mm a") : '-'}</TableCell>
                        <TableCell>
                          {durationMins !== undefined ? (
                            <div className="flex items-center gap-1.5 text-primary">
                              <Timer className="w-3 h-3" />
                              <span className="text-xs font-bold">{formatDuration(durationMins)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-8 text-right">
                          <Badge className={cn(
                            "text-[10px] font-black uppercase",
                            log.status === 'active' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"
                          )}>
                            {log.status}
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
