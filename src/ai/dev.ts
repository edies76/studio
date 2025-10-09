import { config } from 'dotenv';
config();

import '@/ai/flows/generate-document-content.ts';
import '@/ai/flows/auto-format-document.ts';
import '@/ai/flows/enhance-document.ts';