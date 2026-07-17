/** Client-safe model list (no Genkit / Node imports). */

export const STUDIO_MODELS = [
  {
    id: 'googleai/gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    description: 'Current Google AI Studio Flash (recommended)',
  },
  {
    id: 'googleai/gemini-flash-lite-latest',
    label: 'Gemini Flash Lite',
    description: 'Faster / cheaper alias',
  },
  {
    id: 'googleai/gemini-flash-latest',
    label: 'Gemini Flash Latest',
    description: 'Stable Flash alias',
  },
  {
    id: 'googleai/gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    description: 'Fallback if others are busy',
  },
] as const;

export type StudioModelId = (typeof STUDIO_MODELS)[number]['id'];

/** Default model for Studio (Google AI Studio current Flash). */
export const DEFAULT_STUDIO_MODEL: StudioModelId = 'googleai/gemini-3.5-flash';
