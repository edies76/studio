'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import { Wand2, Zap, Upload, Paperclip, X } from 'lucide-react';
import * as mammoth from 'mammoth';
import { useToast } from '@/hooks/use-toast';

export default function PreSummaryPage() {
  const [topic, setTopic] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSubmit = () => {
    if (topic.trim() || files.length > 0) {
      const { dismiss } = toast({ description: 'Analyzing your files... ' });
      const fileContents = files.map(file => {
        return new Promise<string>(async (resolve, reject) => {
          // Handle images by sending them to the backend API
          if (file.type.startsWith('image/')) {
            try {
              const formData = new FormData();
              formData.append('file', file);

              const response = await fetch('/api/analyze-image', {
                method: 'POST',
                body: formData,
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Image analysis failed');
              }

              const result = await response.json();
              resolve(result.description);
            } catch (error) {
              console.error('Error analyzing image:', error);
              reject(error);
            }
            return; // We're done for image files
          }

          // Existing logic for other file types
          const reader = new FileReader();
          reader.onload = async (e) => {
            const arrayBuffer = e.target?.result;
            if (file.name.endsWith('.docx')) {
              try {
                const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer as ArrayBuffer });
                resolve(result.value);
              } catch (error) {
                console.error('Error converting .docx to HTML:', error);
                reject(error);
              }
            } else if (file.name.endsWith('.pdf')) {
              try {
                const pdfjs = await import('pdfjs-dist');
                pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
                const pdf = await pdfjs.getDocument(arrayBuffer as ArrayBuffer).promise;
                let text = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                  const page = await pdf.getPage(i);
                  const content = await page.getTextContent();
                  text += content.items.map((item: any) => item.str).join(' ');
                }
                resolve(text);
              } catch (error) {
                console.error('Error extracting text from PDF:', error);
                reject(error);
              }
            } else if (typeof arrayBuffer === 'string') {
              resolve(arrayBuffer);
            } else {
              const blob = new Blob([arrayBuffer as ArrayBuffer]);
              const reader2 = new FileReader();
              reader2.onload = (e2) => {
                resolve(e2.target?.result as string);
              };
              reader2.readAsText(blob);
            }
          };
          reader.onerror = reject;

          if (file.name.endsWith('.docx') || file.name.endsWith('.pdf')) {
            reader.readAsArrayBuffer(file);
          } else {
            reader.readAsText(file);
          }
        });
      });

      Promise.all(fileContents).then(contents => {
        const combinedContent = contents.join('\n\n');
        sessionStorage.setItem('uploadedDocumentContent', combinedContent);
        dismiss();
        router.push(`/?topic=${encodeURIComponent(topic.trim())}`);
      }).catch(error => {
        dismiss();
        toast({ variant: 'destructive', title: 'Error', description: 'Could not process your files.' });
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(event.target.files || []);
    setFiles(prevFiles => [...prevFiles, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="w-full max-w-3xl text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Wand2 className="w-10 h-10 text-blue-500" />
          <h1 className="text-5xl font-['Playwrite_IT_Moderna'] font-bold text-white">
            B.A.M.B.A.I
          </h1>
        </div>
        <p className="text-xl text-gray-400 mb-8">
          From a blank page to a brilliant draft in minutes.
        </p>

        <div className="w-full max-w-xl mx-auto bg-gray-800/50 rounded-lg shadow-2xl p-8 space-y-6 border border-gray-700">
          <h2 className="text-2xl font-bold text-center text-blue-400">
            What will your document be about?
          </h2>
          <p className="text-center text-gray-300">
            Describe your topic, and let the AI build a solid foundation for you.
          </p>
          <div className="relative">
            <Textarea
              placeholder="e.g., An analysis of the economic impact of renewable energy sources in developing nations."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={4}
              className="bg-gray-900 border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-lg pr-12"
            />
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-gray-400 hover:text-white" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-5 h-5" />
            </Button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".txt,.md,.html,.docx,.pdf,image/*"
            multiple
          />
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center bg-gray-700 rounded-full px-3 py-1 text-sm">
                  <Paperclip className="w-4 h-4 mr-2" />
                  {file.name}
                  <Button variant="ghost" size="icon" className="ml-2 h-6 w-6 text-gray-400 hover:text-white" onClick={() => removeFile(index)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button onClick={handleSubmit} className="w-full text-lg py-6 bg-blue-600 hover:bg-blue-700">
            Generate my Document
            <Zap className="w-5 h-5 ml-2" />
          </Button>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8 text-left">
            <div className="bg-gray-800/40 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-green-400">Beat the blank page</h3>
                <p className="text-gray-400 mt-2">😫 "I don't know where to start my thesis."</p>
                <p className="text-gray-300 mt-1">😌 "In 10 minutes I have a clear structure and a first draft."</p>
            </div>
            <div className="bg-gray-800/40 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-green-400">Format with ease</h3>
                <p className="text-gray-400 mt-2">😫 "I waste hours formatting and citing."</p>
                <p className="text-gray-300 mt-1">😌 "My document is already in the perfect format."</p>
            </div>
            <div className="bg-gray-800/40 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-green-400">Present like a pro</h3>
                <p className="text-gray-400 mt-2">😫 "My presentations are boring and take forever."</p>
                <p className="text-gray-300 mt-1">😌 "I have professional slides automatically."</p>
            </div>
        </div>

      </div>
    </div>
  );
}
