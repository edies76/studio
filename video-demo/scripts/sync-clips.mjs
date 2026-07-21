import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const sourceDir = process.env.DEMO_CLIPS_DIR || 'C:\\Users\\ediva\\Videos\\Demodocss';
const destinationDir = join(projectRoot, 'public', 'clips');
const requiredClips = [
  '01-landing-to-brief.mp4',
  '02-brief-context.mp4',
  '03-brief-parsed.mp4',
  '04-agent-draft.mp4',
  '05-canvas-tour.mp4',
  '06-request-edit.mp4',
  '07-review-proposal.mp4',
  '08-accept-edit.mp4',
  '09-export.mp4',
];

await mkdir(destinationDir, { recursive: true });
const sourceFiles = new Map((await readdir(sourceDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => [entry.name.toLowerCase(), join(sourceDir, entry.name)]));

const copied = [];
const missing = [];
for (const name of requiredClips) {
  const source = sourceFiles.get(name.toLowerCase());
  if (!source) {
    missing.push(name);
    continue;
  }
  await copyFile(source, join(destinationDir, name));
  copied.push(name);
}

const optionalMcp = [...sourceFiles.entries()].find(([name]) => name.startsWith('10-mcp-workflow.'));
if (optionalMcp) {
  const [fileName, source] = optionalMcp;
  const extension = fileName.slice(fileName.lastIndexOf('.'));
  const target = `10-mcp-workflow${extension}`;
  await copyFile(source, join(destinationDir, target));
  copied.push(target);
}

console.log(`Imported ${copied.length} clip(s) from ${sourceDir}.`);
if (missing.length) {
  console.log('Still missing:');
  for (const name of missing) console.log(`  ${name}`);
  console.log('Name each capture exactly as listed above, then run npm run sync:clips again.');
}
