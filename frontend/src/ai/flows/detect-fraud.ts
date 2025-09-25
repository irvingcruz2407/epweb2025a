// This file uses AI to analyze transactions in real-time to detect anomalies and potential fraud.

'use server';

/**
 * @fileOverview Implements an AI-powered fraud detection flow.
 *
 * - detectFraud - Analyzes transaction data to identify potential fraud.
 * - DetectFraudInput - The input type for the detectFraud function.
 * - DetectFraudOutput - The return type for the detectFraud function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectFraudInputSchema = z.object({
  transactionData: z.string().describe('JSON string containing transaction details like amount, timestamp, user ID, transaction type, and location.'),
  userBehaviorData: z.string().optional().describe('JSON string containing historical user behavior data.'),
});
export type DetectFraudInput = z.infer<typeof DetectFraudInputSchema>;

const DetectFraudOutputSchema = z.object({
  isFraudulent: z.boolean().describe('Indicates whether the transaction is likely fraudulent.'),
  fraudExplanation: z.string().describe('Explanation of why the transaction is flagged as potentially fraudulent.'),
  riskScore: z.number().describe('A numerical score indicating the risk level of the transaction (0-1).'),
});
export type DetectFraudOutput = z.infer<typeof DetectFraudOutputSchema>;

export async function detectFraud(input: DetectFraudInput): Promise<DetectFraudOutput> {
  return detectFraudFlow(input);
}

const detectFraudPrompt = ai.definePrompt({
  name: 'detectFraudPrompt',
  input: {schema: DetectFraudInputSchema},
  output: {schema: DetectFraudOutputSchema},
  prompt: `You are an expert fraud detection system. Analyze the provided transaction data and user behavior data to determine if the transaction is fraudulent.

Transaction Data: {{{transactionData}}}
User Behavior Data (if available): {{{userBehaviorData}}}

Based on your analysis, determine the isFraudulent flag, provide a fraudExplanation, and assign a riskScore between 0 and 1.

Consider factors such as:
- Unusual transaction amounts
- Suspicious timestamps
- Location anomalies
- Deviations from typical user behavior

Return your output as a JSON object.
`,
});

const detectFraudFlow = ai.defineFlow(
  {
    name: 'detectFraudFlow',
    inputSchema: DetectFraudInputSchema,
    outputSchema: DetectFraudOutputSchema,
  },
  async input => {
    try {
      const {output} = await detectFraudPrompt(input);
      return output!;
    } catch (error) {
      console.error('Error in detectFraudFlow:', error);
      return {
        isFraudulent: false,
        fraudExplanation: 'An error occurred during fraud analysis.',
        riskScore: 0.0,
      };
    }
  }
);
