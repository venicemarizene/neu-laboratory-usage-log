"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Search, Calendar, Users, Microscope, Ban, Download } from 'lucide-react';
import { MOCK_LOGS, getStats } from '@/lib/mock-data';
import UsageReport from '@/components/UsageReport';
import { UsageStats } from '@/lib/types';

export default function AdminDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<UsageStats | null>(null);

  useEffect(() => {
    // Defer dynamic calculations until after hydration
    setStats(getStats());
  }, []);

  const filteredLogs = MOCK_LOGS.filter(log => 
    log.professorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline text-primary">Usage Analytics</h1>
          <p className="text-muted-foreground">Real-time overview of laboratory utilization</p>
        </div>
        <div className="flex gap-3">
           <UsageReport logs={MOCK_LOGS} />
           <Button variant="outline" className="gap-2">
             <Download className="w-4 h-4" />
             Export CSV
           </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Room Uses Today</CardTitle>
            <Microscope className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsesToday ?? 0}</div>
            <p className="text-xs text-muted-foreground">+12% from yesterday</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Professors</CardTitle>
            <Users className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUniqueProfessors ?? 0}</div>
            <p className="text-xs text-muted-foreground">Active this semester</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Users</CardTitle>
            <Ban className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalBlockedUsers ?? 0}</div>
            <p className="text-xs text-muted-foreground">Access currently revoked</p>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recent Room Logs</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by professor or room..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Professor Name</TableHead>
                <TableHead>Room Number</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-accent/5 transition-colors">
                  <TableCell className="font-medium">{log.professorName}</TableCell>
                  <TableCell>{log.roomNumber}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      {log.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
