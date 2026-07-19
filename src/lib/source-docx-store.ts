import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';

function safe(value: string) {
  return value.replace(/[^a-zA-Z0-9@._-]+/g, '_').slice(0, 120);
}

function root() {
  return process.env.DOCS_SOURCE_DIR || path.join(process.cwd(), '.data', 'sources');
}

function sourcePath(userId: string, id: string) {
  return path.join(root(), safe(userId), `${safe(id)}.docx`);
}

export async function writeSourceDocx(userId: string, id: string, file: Uint8Array) {
  const target = sourcePath(userId, id);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, file);
}

export async function readSourceDocx(userId: string, id: string) {
  try {
    return await fs.readFile(sourcePath(userId, id));
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function deleteSourceDocx(userId: string, id: string) {
  await fs.rm(sourcePath(userId, id), { force: true }).catch(() => undefined);
}
