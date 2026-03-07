
"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sparkles, Loader2, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { adminUsageReportSummary, type AdminUsageReportSummaryOutput } from '@/ai/flows/admin-usage-report-summary';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UsageReportProps {
  logs: any[];
}

export default function UsageReport({ logs }: UsageReportProps) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AdminUsageReportSummaryOutput | null>(null);

  const generateReport = async () => {
    if (logs.length === 0) return;
    setLoading(true);
    try {
      const weeklyLogs = logs.map(l => 
        `${l.professorEmail} used ${l.roomNumber} on ${new Date(l.loginTime).toISOString().split('T')[0]} at ${new Date(l.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      );

      const result = await adminUsageReportSummary({
        startDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        weeklyLogs: weeklyLogs.slice(0, 50)
      });
      setReport(result);
    } catch (error) {
      console.error("Failed to generate report", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          onClick={generateReport} 
          disabled={logs.length === 0}
          className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all border-none shadow-md"
        >
          <Sparkles className="w-4 h-4" />
          AI Usage Insight
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            AI Laboratory Intelligence
          </DialogTitle>
          <DialogDescription>
            Generative analysis of laboratory activity, trends, and staff engagement.
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-muted-foreground animate-pulse">Analyzing laboratory logs and identifying patterns...</p>
          </div>
        ) : report ? (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              <section className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 text-primary">
                  <TrendingUp className="w-4 h-4" /> Usage Summary
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {report.overallSummary}
                </p>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2 text-primary">
                    <Clock className="w-4 h-4" /> Identified Trends
                  </h4>
                  <ul className="text-sm space-y-1">
                    {report.keyTrends.map((trend, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-accent">•</span>
                        {trend}
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2 text-primary">
                    <AlertCircle className="w-4 h-4" /> Potential Anomalies
                  </h4>
                  <ul className="text-sm space-y-1">
                    {report.potentialAnomalies.length > 0 ? report.potentialAnomalies.map((anomaly, i) => (
                      <li key={i} className="flex gap-2 text-destructive">
                        <span>•</span>
                        {anomaly}
                      </li>
                    )) : (
                      <li className="text-xs text-muted-foreground italic">No anomalies detected in current logs.</li>
                    )}
                  </ul>
                </section>
              </div>

              <section className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                <h4 className="font-semibold text-primary mb-2">High Activity Periods</h4>
                <div className="flex flex-wrap gap-2">
                  {report.highUsagePeriods.map((period, i) => (
                    <span key={i} className="bg-card px-2 py-1 rounded text-xs border font-medium">
                      {period}
                    </span>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        ) : (
          <div className="py-10 text-center text-muted-foreground">
            No report data available.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
