'use server';

/**
 * @fileOverview An AI agent to generate document content based on a topic, including mathematical formulas.
 *
 * - generateDocumentContent - A function that generates document content.
 * - GenerateDocumentContentInput - The input type for the generateDocumentContent function.
 * - GenerateDocumentContentOutput - The return type for the generateDocumentContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateDocumentContentInputSchema = z.object({
  topic: z.string().describe('The topic for which to generate document content.'),
  includeFormulas: z.boolean().optional().describe('Whether to include mathematical formulas in the content.'),
});
export type GenerateDocumentContentInput = z.infer<typeof GenerateDocumentContentInputSchema>;

const GenerateDocumentContentOutputSchema = z.object({
  content: z.string().describe('The generated document content, including mathematical formulas if requested.'),
});
export type GenerateDocumentContentOutput = z.infer<typeof GenerateDocumentContentOutputSchema>;

export async function generateDocumentContent(input: GenerateDocumentContentInput): Promise<GenerateDocumentContentOutput> {
  return generateDocumentContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDocumentContentPrompt',
  input: {schema: GenerateDocumentContentInputSchema},
  output: {schema: GenerateDocumentContentOutputSchema},
  prompt: `You are a document content generator. Your goal is to generate well-written content for a document based on the provided topic. The output should be in HTML format.

  Topic: {{{topic}}}

  Include mathematical formulas if requested.

  Content:`,
});

const generateDocumentContentFlow = ai.defineFlow(
  {
    name: 'generateDocumentContentFlow',
    inputSchema: GenerateDocumentContentInputSchema,
    outputSchema: GenerateDocumentContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
