'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import DocuCraftClient from './docucraft-client';
import Loading from './loading'; // Import the loading component

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [initialContent, setInitialContent] = useState<string | null>(null);

  useEffect(() => {
    // This code block will only run on the client-side.
    const topic = searchParams.get('topic');
    const uploadedContent = sessionStorage.getItem('uploadedDocumentContent');

    // If there's no topic and no uploaded content, we shouldn't be on this page.
    if (!topic && !uploadedContent) {
      router.replace('/pre-summary');
      return; // Stop execution of the effect
    }

    // Construct the final content for the editor
    const finalContent = uploadedContent 
      ? `${topic || ''}\n\n${uploadedContent}` 
      : topic || '';
      
    setInitialContent(finalContent);

    // Clean up the session storage immediately after using the data.
    if (uploadedContent) {
      sessionStorage.removeItem('uploadedDocumentContent');
    }

  }, [router, searchParams]); // Dependency array ensures this runs when route params change.

  // Render a loading state or nothing until the initialContent is determined.
  if (initialContent === null) {
    return <Loading />; // Display the loading component
  }

  // Once content is ready, render the main client.
  return <DocuCraftClient topic={initialContent} />;
}
