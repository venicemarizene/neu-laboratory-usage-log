'use server';
/**
 * @fileOverview An AI tool for administrators to summarize weekly lab usage data.
 *
 * - adminUsageReportSummary - A function that generates a summary of weekly lab usage.
 * - AdminUsageReportSummaryInput - The input type for the adminUsageReportSummary function.
 * - AdminUsageReportSummaryOutput - The return type for the adminUsageReportSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AdminUsageReportSummaryInputSchema = z.object({
  startDate: z.string().describe('The start date of the weekly report in YYYY-MM-DD format.'),
  endDate: z.string().describe('The end date of the weekly report in YYYY-MM-DD format.'),
  weeklyLogs: z
    .array(z.string())
    .describe(
      'An array of weekly lab usage log entries. Each entry should be a string in the format "Professor_Name used Room_Number on YYYY-MM-DD at HH:MM".'
    ),
});

export type AdminUsageReportSummaryInput = z.infer<
  typeof AdminUsageReportSummaryInputSchema
>;

const AdminUsageReportSummaryOutputSchema = z.object({
  overallSummary: z
    .string()
    .describe('A comprehensive narrative summary of the weekly lab usage data.'),
  keyTrends: z
    .array(z.string())
    .describe(
      'Identified patterns and trends in lab usage (e.g., popular rooms, common usage times, frequently used rooms by certain professors).'
    ),
  highUsagePeriods: z
    .array(z.string())
    .describe('Specific times or days during the week when lab usage was particularly high.'),
  potentialAnomalies: z
    .array(z.string())
    .describe(
      'Any unusual or unexpected activities detected (e.g., usage outside of normal hours, very short or very long sessions by specific users/rooms).'
    ),
});

export type AdminUsageReportSummaryOutput = z.infer<
  typeof AdminUsageReportSummaryOutputSchema
>;

const adminUsageReportSummaryPrompt = ai.definePrompt({
  name: 'adminUsageReportSummaryPrompt',
  input: {schema: AdminUsageReportSummaryInputSchema},
  output: {schema: AdminUsageReportSummaryOutputSchema},
  prompt: `You are an expert lab administrator and data analyst. Your task is to analyze weekly lab usage data and provide a concise summary, highlighting key trends, high-usage periods, and potential anomalies.

The data covers the week from {{{startDate}}} to {{{endDate}}}.

Here are the lab usage logs for the week:
{{#each weeklyLogs}}
- {{{this}}}
{{/each}}

Please provide your analysis in the following structured JSON format. Be thorough but concise.`,
});

const adminUsageReportSummaryFlow = ai.defineFlow(
  {
    name: 'adminUsageReportSummaryFlow',
    inputSchema: AdminUsageReportSummaryInputSchema,
    outputSchema: AdminUsageReportSummaryOutputSchema,
  },
  async input => {
    const {output} = await adminUsageReportSummaryPrompt(input);
    return output!;
  }
);

export async function adminUsageReportSummary(
  input: AdminUsageReportSummaryInput
): Promise<AdminUsageReportSummaryOutput> {
  return adminUsageReportSummaryFlow(input);
}
