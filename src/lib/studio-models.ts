/** Client-safe model list (no Genkit / Node imports). */

export const STUDIO_MODELS = [
  {
    id: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    description: 'Primary — fast document writing & edits',
  },
  {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    description: 'Heavier quality when Flash is busy',
  },
  {
    id: 'deepseek-chat',
    label: 'DeepSeek Chat (legacy alias)',
    description: 'Alias of V4 Flash non-thinking (deprecated soon)',
  },
] as const;

export type StudioModelId = (typeof STUDIO_MODELS)[number]['id'];

/** Default model for Studio — DeepSeek V4 Flash via DeepSeek API */
export const DEFAULT_STUDIO_MODEL: StudioModelId = 'deepseek-v4-flash';
