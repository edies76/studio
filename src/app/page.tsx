'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import DocuCraftClient from './docucraft-client';
import Loading from './loading';

export default function Home() {
  const router = useRouter();
  const [initialTopic, setInitialTopic] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // This code block will only run on the client-side.
    const storedTopic = sessionStorage.getItem('initialTopic');
    const hasContent = sessionStorage.getItem('uploadedDocumentContent');

    if (!storedTopic && !hasContent) {
      router.replace('/pre-summary');
    } else {
      setInitialTopic(storedTopic || ' '); // Use a space to prevent re-triggering redirect
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading || initialTopic === null) {
    return <Loading />;
  }

  return <DocuCraftClient topic={initialTopic} />;
}
