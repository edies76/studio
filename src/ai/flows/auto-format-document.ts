'use server';

/**
 * @fileOverview Automatically formats a document according to a specified style guide.
 *
 * - autoFormatDocument - A function that formats the document.
 * - AutoFormatDocumentInput - The input type for the autoFormatDocument function.
 * - AutoFormatDocumentOutput - The return type for the autoFormatDocument function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AutoFormatDocumentInputSchema = z.object({
  documentContent: z
    .string()
    .describe('The content of the document to be formatted.'),
  styleGuide: z
    .enum(['APA', 'IEEE'])
    .describe('The style guide to be used for formatting the document.'),
});
export type AutoFormatDocumentInput = z.infer<typeof AutoFormatDocumentInputSchema>;

const AutoFormatDocumentOutputSchema = z.object({
  formattedDocument: z
    .string()
    .describe('The formatted document according to the specified style guide.'),
});
export type AutoFormatDocumentOutput = z.infer<typeof AutoFormatDocumentOutputSchema>;

export async function autoFormatDocument(input: AutoFormatDocumentInput): Promise<AutoFormatDocumentOutput> {
  return autoFormatDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'autoFormatDocumentPrompt',
  input: {schema: AutoFormatDocumentInputSchema},
  output: {schema: AutoFormatDocumentOutputSchema},
  prompt: `You are an expert document formatter, skilled in applying various style guides to ensure documents meet professional and submission standards.

  Based on the document content and the specified style guide, reformat the document accordingly.

  Document Content:
  {{documentContent}}

  Style Guide:
  {{styleGuide}}

  Ensure the formatted document adheres to the specifics of the style guide, including but not limited to citation formats, heading styles, and overall document structure.

  Return the complete formatted document.
`,
});

const autoFormatDocumentFlow = ai.defineFlow(
  {
    name: 'autoFormatDocumentFlow',
    inputSchema: AutoFormatDocumentInputSchema,
    outputSchema: AutoFormatDocumentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
