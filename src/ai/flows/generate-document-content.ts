'use server';

/**
 * @fileOverview An AI agent to generate document content based on a topic, including mathematical formulas.
 *
 * - generateDocumentContent - A function that generates document content.
 * - GenerateDocumentContentInput - The input type for the generateDocumentContent function.
 * - GenerateDocumentContentOutput - The return type for the generateDocumentcontent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateDocumentContentInputSchema = z.object({
  topic: z.string().describe('The topic for which to generate document content.'),
  includeFormulas: z.boolean().optional().describe('Whether to include mathematical formulas in the content.'),
});
export type GenerateDocumentContentInput = z.infer<typeof GenerateDocumentContentInputSchema>;

const GenerateDocumentContentOutputSchema = z.object({
  content: z.string().describe('The generated document content, including mathematical formulas if requested, formatted as a single HTML string.'),
});
export type GenerateDocumentContentOutput = z.infer<typeof GenerateDocumentContentOutputSchema>;

export async function generateDocumentContent(input: GenerateDocumentContentInput): Promise<GenerateDocumentContentOutput> {
  return generateDocumentContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDocumentContentPrompt',
  input: {schema: GenerateDocumentContentInputSchema},
  output: {schema: GenerateDocumentContentOutputSchema},
  prompt: `You are a document content generator. Your goal is to generate clean, well-written content based on the provided topic. 
  
  The output MUST be a single, valid HTML string.

  - For text that should be presented as inline code or a literal (like variable names or simple notations), just present them as plain text. Do not wrap it in \`<code>\` tags or backticks.
  - For complex mathematical formulas, you MUST use standard LaTeX syntax. Wrap inline formulas in \\( ... \\) and block formulas in \\[ ... \\]. For example: \\( E = mc^2 \\).
  - Use standard LaTeX commands like \\forall for "for all" and \\exists for "exists". Do not invent commands or use unicode characters directly in formulas.
  - The entire response should be formatted as a single block of HTML content, ready to be displayed on a web page.

  Topic: {{{topic}}}

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
