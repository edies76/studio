'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import DocsStudioClient from '../../../docucraft-client';
import Loading from '../../../loading';

/**
 * /studio/doc/[id] — open a single document (tenant-scoped on the server).
 */
function StudioDocInner() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : null;
  if (!id || id === 'new') return <Loading />;
  return <DocsStudioClient topic="" documentId={id} />;
}

export default function StudioDocPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StudioDocInner />
    </Suspense>
  );
}
