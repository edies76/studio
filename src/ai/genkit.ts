import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GOOGLE_API_KEY })],
  // Default: Gemini 3.5 Flash (Google AI Studio current Flash)
  model: process.env.GEMINI_MODEL || 'googleai/gemini-3.5-flash',
});
