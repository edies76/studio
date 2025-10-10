'use server';

/**
 * @fileOverview An AI agent to generate a comprehensive package of content based on a topic.
 * This includes the main document, presentation slides, and a timeline.
 *
 * - generateDocumentContent - A function that generates the full content package.
 * - GenerateDocumentContentInput - The input type for the function.
 * - GenerateDocumentContentOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Input schema remains the same
const GenerateDocumentContentInputSchema = z.object({
  topic: z.string().describe('The topic for which to generate document content.'),
  includeFormulas: z.boolean().optional().describe('Whether to include mathematical formulas in the content.'),
});
export type GenerateDocumentContentInput = z.infer<typeof GenerateDocumentContentInputSchema>;

// Define schemas for the new structured outputs
const PresentationSlideSchema = z.object({
  title: z.string().describe("The title of the presentation slide."),
  bulletPoints: z.array(z.string()).describe("A list of key bullet points for the slide."),
});

const TimelineEventSchema = z.object({
  date: z.string().describe("The date or time period of the event (e.g., '1950s', '2023-Q4')."),
  description: z.string().describe("A brief description of the milestone or event."),
});

// The output schema is now a comprehensive package
const GenerateDocumentContentOutputSchema = z.object({
  documentContent: z.string().describe('The generated document content, formatted as a single HTML string.'),
  presentationSlides: z.array(PresentationSlideSchema).describe('An array of slides for a presentation based on the content.'),
  timelineEvents: z.array(TimelineEventSchema).describe('An array of key timeline events related to the topic.'),
});
export type GenerateDocumentContentOutput = z.infer<typeof GenerateDocumentContentOutputSchema>;

// The main function signature is updated to reflect the new output
export async function generateDocumentContent(input: GenerateDocumentContentInput): Promise<GenerateDocumentContentOutput> {
  return generateDocumentContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDocumentContentPrompt',
  input: { schema: GenerateDocumentContentInputSchema },
  output: { schema: GenerateDocumentContentOutputSchema },
  prompt: `You are an expert Research Copilot. Your goal is to generate a comprehensive content package based on the provided topic. This package must include a detailed document, a set of presentation slides, and a timeline of key events.

  The output MUST be a single, valid JSON object that adheres to the specified output schema.

  **Topic:** {{{topic}}}

  **Instructions:**

  1.  **Generate Document Content ('documentContent')**:
      *   Create a well-structured and detailed document.
      *   Use logical headings (<h2>, <h3>), paragraphs (<p>), and lists (<ul>, <ol>, <li>).
      *   Provide detailed explanations, examples, and definitions.
      *   If the topic involves technical or scientific concepts, include complex mathematical formulas using standard LaTeX syntax. Wrap inline formulas in \\\\( ... \\\\) and block formulas in \\\\[ ... \\\\]. For example: \\\\( E = mc^2 \\\\).
      *   Ensure the entire output for this field is a single, valid HTML string.

  2.  **Generate Presentation Slides ('presentationSlides')**:
      *   Based on the document you just generated, create a series of presentation slides.
      *   Each slide object in the array must have a 'title' and a list of 'bulletPoints'.
      *   The slides should summarize the key points of the document in a clear, concise format suitable for a presentation.

  3.  **Generate Timeline ('timelineEvents')**:
      *   Identify the most critical historical milestones or key sequential steps related to the topic.
      *   Each event object in the array must have a 'date' (which can be a year, a specific date, or a time period) and a 'description' of the event.

  Begin generating the complete content package now. Ensure the final output is a valid JSON object.`,
});

const generateDocumentContentFlow = ai.defineFlow(
  {
    name: 'generateDocumentContentFlow',
    inputSchema: GenerateDocumentContentInputSchema,
    outputSchema: GenerateDocumentContentOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);