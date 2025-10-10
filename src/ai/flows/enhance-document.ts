'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// The actions should correspond to what's defined in the toolbar
const EnhancementActionSchema = z.enum([
  "improve",
  "summarize",
  "expand",
  "tone-academic",
  "tone-formal",
  "tone-casual",
]);
export type EnhancementAction = z.infer<typeof EnhancementActionSchema>;

// The new input schema uses the action enum instead of generic feedback
const EnhanceDocumentInputSchema = z.object({
  documentContent: z
    .string()
    .describe('The content of the document to be enhanced.'),
  action: EnhancementActionSchema.describe(
    'The specific enhancement action to perform.'
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

// The prompt is now much more intelligent and directive
const enhanceDocumentPrompt = ai.definePrompt({
  name: 'enhanceDocumentPrompt',
  input: { schema: EnhanceDocumentInputSchema },
  output: { schema: EnhanceDocumentOutputSchema },
  prompt: `You are an expert writing assistant. You will receive a piece of text and a specific action to perform on it. Your response must be only the modified text, formatted as a valid HTML string.

  **Action to Perform:** {{{action}}}
  **Original Text:**
  {{{documentContent}}}

  **Instructions based on Action:**

  *   **If the action is 'improve'**:
      *   Correct any grammatical errors, spelling mistakes, and typos.
      *   Improve sentence structure for better clarity and flow.
      *   Refine word choices to be more precise and impactful, without changing the core meaning.

  *   **If the action is 'summarize'**:
      *   Condense the text to its most essential points.
      *   Remove redundant information and focus on the main ideas.
      *   The summary should be significantly shorter than the original text but retain its key message.

  *   **If the action is 'expand'**:
      *   Elaborate on the existing points with more detail, examples, or explanations.
      *   Add relevant information to make the text more comprehensive.
      *   The expanded text should be longer and more detailed than the original.

  *   **If the action is 'tone-academic'**:
      *   Rewrite the text using a formal, scholarly tone.
      *   Use precise terminology and avoid colloquialisms or overly casual language.
      *   Structure the arguments logically and objectively.

  *   **If the action is 'tone-formal'**:
      *   Rewrite the text in a professional and respectful tone suitable for business or formal communication.
      *   Avoid slang, contractions, and overly personal language.

  *   **If the action is 'tone-casual'**:
      *   Rewrite the text in a more relaxed, conversational, and approachable tone.
      *   You can use contractions and more common vocabulary.

  Now, apply the '{{{action}}}' action to the provided text and return only the resulting HTML content.
  `,
});

const enhanceDocumentFlow = ai.defineFlow(
  {
    name: 'enhanceDocumentFlow',
    inputSchema: EnhanceDocumentInputSchema,
    outputSchema: EnhanceDocumentOutputSchema,
  },
  async input => {
    const { output } = await enhanceDocumentPrompt(input);
    return output!;
  }
);