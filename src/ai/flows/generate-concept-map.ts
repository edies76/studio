'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the schema for a single node in the concept map
const NodeSchema = z.object({
  id: z.string().describe('A unique identifier for the node.'),
  position: z.object({
    x: z.number().describe('The x-coordinate of the node.'),
    y: z.number().describe('The y-coordinate of the node.'),
  }).describe('The position of the node on the canvas.'),
  data: z.object({
    label: z.string().describe('The text label to be displayed on the node.'),
  }).describe('The data associated with the node.'),
});

// Define the schema for a single edge connecting two nodes
const EdgeSchema = z.object({
  id: z.string().describe('A unique identifier for the edge.'),
  source: z.string().describe('The ID of the source node.'),
  target: z.string().describe('The ID of the target node.'),
});

// Define the input schema for the concept map generation flow
const GenerateConceptMapInputSchema = z.object({
  documentContent: z.string().describe('The document content to be converted into a concept map.'),
});
export type GenerateConceptMapInput = z.infer<typeof GenerateConceptMapInputSchema>;

// Define the output schema for the concept map generation flow
const GenerateConceptMapOutputSchema = z.object({
  nodes: z.array(NodeSchema).describe('An array of nodes for the concept map.'),
  edges: z.array(EdgeSchema).describe('An array of edges connecting the nodes.'),
});
export type GenerateConceptMapOutput = z.infer<typeof GenerateConceptMapOutputSchema>;

// The main function to be called from the client
export async function generateConceptMap(input: GenerateConceptMapInput): Promise<GenerateConceptMapOutput> {
  return generateConceptMapFlow(input);
}

// Define the AI prompt for generating the concept map
const conceptMapPrompt = ai.definePrompt({
  name: 'conceptMapPrompt',
  input: { schema: GenerateConceptMapInputSchema },
  output: { schema: GenerateConceptMapOutputSchema },
  prompt: `You are a Concept Map Generator. Your task is to analyze the given document content and convert it into a structured concept map.

  The output MUST be a valid JSON object that adheres to the specified schema, containing 'nodes' and 'edges'.

  - Identify the main concepts and key ideas from the text. These will be your 'nodes'.
  - Determine the relationships and connections between these concepts. These will be your 'edges'.
  - Each node must have a unique 'id', a 'position' (assign random x/y coordinates for now), and 'data' containing a 'label'.
  - Each edge must have a unique 'id', a 'source' (the id of the starting node), and a 'target' (the id of the ending node).
  - Ensure the entire output is a single, valid JSON object.

  Document Content:
  {{{documentContent}}}

  Generate the concept map now.`,
});

// Define the Genkit flow for generating the concept map
const generateConceptMapFlow = ai.defineFlow(
  {
    name: 'generateConceptMapFlow',
    inputSchema: GenerateConceptMapInputSchema,
    outputSchema: GenerateConceptMapOutputSchema,
  },
  async (input) => {
    const { output } = await conceptMapPrompt(input);
    return output!;
  }
);