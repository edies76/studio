'use server';
/**
 * @fileOverview Flow for enhancing specific sections or aspects of a document using AI.
 *
 * - enhanceDocument - A function that enhances the document based on user feedback.
 * - EnhanceDocumentInput - The input type for the enhanceDocument function.
 * - EnhanceDocumentOutput - The return type for the enhanceDocument function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnhanceDocumentInputSchema = z.object({
  documentContent: z
    .string()
    .describe('The content of the document to be enhanced.'),
  feedback: z
    .string()
    .describe(
      'Specific feedback or instructions on what aspects of the document need improvement.'
    ),
});
export type EnhanceDocumentInput = z.infer<typeof EnhanceDocumentInputSchema>;

const EnhanceDocumentOutputSchema = z.object({
  enhancedDocumentContent: z
    .string()
    .describe('The enhanced content of the document.'),
});
export type EnhanceDocumentOutput = z.infer<typeof EnhanceDocumentOutputSchema>;

export async function enhanceDocument(input: EnhanceDocumentInput): Promise<EnhanceDocumentOutput> {
  return enhanceDocumentFlow(input);
}

const enhanceDocumentPrompt = ai.definePrompt({
  name: 'enhanceDocumentPrompt',
  input: {schema: EnhanceDocumentInputSchema},
  output: {schema: EnhanceDocumentOutputSchema},
  prompt: `You are an AI document enhancement tool.  You will receive the current document content and specific feedback on what to improve.  Apply the feedback to the document and return the enhanced content. 

Original Document:
{{{documentContent}}}

Feedback:
{{{feedback}}}`,
});

const enhanceDocumentFlow = ai.defineFlow(
  {
    name: 'enhanceDocumentFlow',
    inputSchema: EnhanceDocumentInputSchema,
    outputSchema: EnhanceDocumentOutputSchema,
  },
  async input => {
    const {output} = await enhanceDocumentPrompt(input);
    return output!;
  }
);
