import { redirect } from 'next/navigation';

/** A document id is required; this route must not invent a blank document. */
export default function StudioDocumentIndexPage() {
  redirect('/home?notice=document-id-required');
}
