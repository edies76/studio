/** Client-safe model list (no Genkit / Node imports). */

export const STUDIO_MODELS = [
  {
    id: 'grok-4-20-non-reasoning',
    label: 'Grok 4 non-reasoning',
    description: 'Azure AI Foundry — document writing and targeted edits',
  },
] as const;

export type StudioModelId = (typeof STUDIO_MODELS)[number]['id'];

/** Default model for Studio — same Foundry deployment used by Lunar. */
export const DEFAULT_STUDIO_MODEL: StudioModelId = 'grok-4-20-non-reasoning';
