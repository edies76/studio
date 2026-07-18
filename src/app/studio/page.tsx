'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import DocsStudioClient from '../docucraft-client';
import Loading from '../loading';

/**
 * /studio — the academic document workspace (paper canvas + agent).
 * Landing lives at /. Library at /home.
 */
function StudioInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [topic, setTopic] = useState('');
  const [docId, setDocId] = useState<string | null>(null);

  useEffect(() => {
    const topicParam = searchParams.get('topic');
    const doc = searchParams.get('doc');
    const uploadedContent = sessionStorage.getItem('uploadedDocumentContent');

    if (doc && doc !== 'new') {
      setDocId(doc);
      setTopic('');
      setReady(true);
      return;
    }

    if (topicParam === null && !uploadedContent && !doc) {
      if (searchParams.get('start') === 'brief') {
        router.replace('/');
        return;
      }
      // Empty editor — create/load handled client-side via autosave
      setDocId(null);
      setTopic('');
      setReady(true);
      return;
    }

    const finalContent = uploadedContent
      ? `${topicParam || ''}\n\n${uploadedContent}`.trim()
      : topicParam || '';

    setTopic(finalContent);
    setDocId(null);
    setReady(true);
    if (uploadedContent) sessionStorage.removeItem('uploadedDocumentContent');
  }, [router, searchParams]);

  if (!ready) return <Loading />;
  return <DocsStudioClient topic={topic} documentId={docId} />;
}

export default function StudioPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StudioInner />
    </Suspense>
  );
}
