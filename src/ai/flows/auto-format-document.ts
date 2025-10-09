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
    .describe('The HTML content of the document to be formatted.'),
  styleGuide: z
    .enum(['APA', 'IEEE'])
    .describe('The style guide to be used for formatting the document.'),
});
export type AutoFormatDocumentInput = z.infer<typeof AutoFormatDocumentInputSchema>;

const AutoFormatDocumentOutputSchema = z.object({
  formattedDocument: z
    .string()
    .describe('The formatted document as a single HTML string, preserving the original HTML structure.'),
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

  Based on the HTML document content and the specified style guide, reformat the document accordingly.

  IMPORTANT: The input is in HTML format. You MUST return a single, valid HTML string. Do not return plain text or markdown. Preserve the existing HTML tags and structure as much as possible, only modifying the content and structure as required by the style guide.

  Document Content:
  {{{documentContent}}}

  Style Guide:
  {{styleGuide}}

  Ensure the formatted document adheres to the specifics of the style guide, including but not limited to citation formats, heading styles, and overall document structure.

  Return the complete formatted document as a single HTML string.
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
