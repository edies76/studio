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
  topic: z.string().describe('The topic for which to generate document content. This may include image placeholders like [IMAGE_PLACEHOLDER: <id>].'),
});
export type GenerateDocumentContentInput = z.infer<typeof GenerateDocumentContentInputSchema>;

const GenerateDocumentContentOutputSchema = z.object({
  content: z.string().describe('The generated document content, including mathematical formulas and intelligently placed image placeholders, formatted as a single HTML string.'),
});
export type GenerateDocumentContentOutput = z.infer<typeof GenerateDocumentContentOutputSchema>;

export async function generateDocumentContent(input: GenerateDocumentContentInput): Promise<GenerateDocumentContentOutput> {
  return generateDocumentContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDocumentContentPrompt',
  input: {schema: GenerateDocumentContentInputSchema},
  output: {schema: GenerateDocumentContentOutputSchema},
  prompt: `You are a document content generator. Your goal is to generate comprehensive, well-structured, and detailed content on the provided topic.

  The input may contain image placeholders (e.g., [IMAGE_PLACEHOLDER: <id>]). Your task is to intelligently integrate these placeholders into the document where they are most relevant.

  The output MUST be a single, valid HTML string.

  - Structure the content logically with headings (<h2>, <h3>), paragraphs (<p>), and lists (<ul>, <ol>, <li>).
  - Provide detailed explanations, examples, and definitions.
  - When you encounter an image placeholder in the input, analyze the surrounding context and place the placeholder in the most appropriate location in the generated HTML.

  - **Crucially, for ALL mathematical notation, from single variables to complex equations, you MUST use standard LaTeX syntax.**
    - Wrap inline formulas in \\\\( ... \\\\). For example: \\\\( E = mc^2 \\\\).
    - Wrap block formulas (displayed on their own line) in \\\\[ ... \\\\]. For example: \\\\[ \sum_{i=1}^{n} i = \frac{n(n+1)}{2} \\\\].
    - Use standard LaTeX commands, like \\vec{r} for vectors. Do not use unicode characters like '→' inside math delimiters.
    - Do NOT use <code> tags for mathematical content. For instance, instead of <code>Ψ(→r, t)</code>, you must write \\\\(Ψ(\\vec{r}, t)\\\\).

  - For non-mathematical code snippets or variable names, use the <code>...</code> tag. For example: <code>my_variable</code>.

  - The entire response must be a single block of HTML content, ready to be displayed on a web page.

  Topic and Content: {{{topic}}}

  Begin generating the detailed document content now.`,
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
