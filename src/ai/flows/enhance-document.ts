'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the schema for the action, which can be predefined or a custom prompt
const EnhancementActionSchema = z.union([
  z.object({
    type: z.literal('predefined'),
    value: z.enum([
      "improve",
      "summarize",
      "expand",
      "tone-academic",
      "tone-formal",
      "tone-casual",
    ]),
  }),
  z.object({
    type: z.literal('custom'),
    prompt: z.string(),
  }),
]);
export type EnhancementAction = z.infer<typeof EnhancementActionSchema>;

// The input schema now uses this more flexible action schema
const EnhanceDocumentInputSchema = z.object({
  documentContent: z
    .string()
    .describe('The content of the document to be enhanced.'),
  action: EnhancementActionSchema.describe(
    'The specific enhancement action to perform, either predefined or a custom user prompt.'
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
  // We construct the final prompt string here based on the action type
  let finalPrompt = '';
  if (input.action.type === 'predefined') {
    finalPrompt = `Perform the following predefined action on the text: '${input.action.value}'.`;
  } else {
    finalPrompt = `Fulfill the following user-written instruction: '${input.action.prompt}'.`;
  }

  // We pass the constructed prompt and the original document content to the prompt renderer
  return enhanceDocumentFlow({
    documentContent: input.documentContent,
    finalPrompt: finalPrompt,
  });
}

// The prompt now takes a dynamically constructed instruction
const enhanceDocumentPrompt = ai.definePrompt({
  name: 'enhanceDocumentPrompt',
  input: { schema: z.object({ documentContent: z.string(), finalPrompt: z.string() }) },
  output: { schema: EnhanceDocumentOutputSchema },
  prompt: `You are an expert writing assistant. You will receive a piece of text and a specific instruction to perform on it. Your response must be only the modified text, formatted as a valid HTML string.

  **Instruction:**
  {{{finalPrompt}}}

  **Original Text:**
  {{{documentContent}}}

  Now, apply the instruction to the provided text and return only the resulting HTML content.
  `,
});

const enhanceDocumentFlow = ai.defineFlow(
  {
    name: 'enhanceDocumentFlow',
    inputSchema: z.object({ documentContent: z.string(), finalPrompt: z.string() }),
    outputSchema: EnhanceDocumentOutputSchema,
  },
  async input => {
    const { output } = await enhanceDocumentPrompt(input);
    return output!;
  }
);