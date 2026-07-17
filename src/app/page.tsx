'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import DocsStudioClient from './docucraft-client';
import Loading from './loading';

function HomeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [initialContent, setInitialContent] = useState<string | null>(null);

  useEffect(() => {
    const topic = searchParams.get('topic');
    const uploadedContent = sessionStorage.getItem('uploadedDocumentContent');

    // Free entry: empty editor is OK — no forced guide / brief
    // Only redirect to pre-summary if explicitly requested via ?start=brief
    if (topic === null && !uploadedContent) {
      if (searchParams.get('start') === 'brief') {
        router.replace('/pre-summary');
        return;
      }
      setInitialContent('');
      return;
    }

    const finalContent = uploadedContent
      ? `${topic || ''}\n\n${uploadedContent}`.trim()
      : topic || '';

    setInitialContent(finalContent);
    if (uploadedContent) sessionStorage.removeItem('uploadedDocumentContent');
  }, [router, searchParams]);

  if (initialContent === null) return <Loading />;
  return <DocsStudioClient topic={initialContent} />;
}

export default function Home() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeInner />
    </Suspense>
  );
}
