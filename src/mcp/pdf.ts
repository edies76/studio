import { jsPDF } from 'jspdf';
import { extractDocumentBlocks } from './core';

export function documentPdf(html: string, title: string, paperSize: 'letter' | 'legal' = 'letter') {
  const doc = new jsPDF({ format: paperSize });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 22;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  for (const line of doc.splitTextToSize(title || 'Docs Studio', maxWidth)) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 8;
  }
  y += 7;

  for (const block of extractDocumentBlocks(html)) {
    const isHeading = /^h[1-3]$/.test(block.tag);
    doc.setFont('helvetica', isHeading ? 'bold' : 'normal');
    doc.setFontSize(block.tag === 'h1' ? 14 : block.tag === 'h2' ? 12 : 10.5);
    const lines = doc.splitTextToSize(block.preview || ' ', maxWidth);
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += isHeading ? 6.5 : 5.2;
    }
    y += isHeading ? 4 : 3;
  }

  return Buffer.from(doc.output('arraybuffer'));
}

