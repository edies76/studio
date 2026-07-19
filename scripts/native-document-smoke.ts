import assert from 'node:assert/strict';
import {
  applyDocumentOperation,
  createStudioDocument,
  modelToHtml,
  type StudioBlock,
} from '../src/lib/studio-document';
import { layoutNativeDocument } from '../src/lib/native-layout';

const initial = createStudioDocument('a4');
const first = initial.blocks[0];
const heading: StudioBlock = {
  id: 'native-heading',
  type: 'heading',
  level: 1,
  runs: [{ text: 'Informe de laboratorio', marks: { bold: true, color: '#35251d' } }],
};

const inserted = applyDocumentOperation(initial, { type: 'insertBlock', afterId: first.id, block: heading });
assert.equal(inserted.page.size, 'a4');
assert.equal(inserted.blocks.length, 2);
assert.equal(inserted.blocks[1].id, 'native-heading');

const replaced = applyDocumentOperation(inserted, {
  type: 'replaceBlock',
  blockId: 'native-heading',
  block: { ...heading, runs: [{ text: 'Informe final' }] },
});
assert.match(modelToHtml(replaced), /data-studio-block-id="native-heading"/);
assert.match(modelToHtml(replaced), /Informe final/);

const removed = applyDocumentOperation(replaced, { type: 'removeBlock', blockId: 'native-heading' });
assert.equal(removed.blocks.length, 1);
const layout = layoutNativeDocument(replaced, { width: 816, height: 1056, margin: 72, fontSize: 16, lineHeight: 24 });
assert.equal(layout.placements.length, 2);
assert.equal(layout.placements[1].block.id, 'native-heading');
console.log('native-document smoke: OK');
