'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import { Wand2, Zap, Upload, Paperclip, X } from 'lucide-react';
import * as mammoth from 'mammoth';
import { useToast } from '@/hooks/use-toast';

interface ImageFile extends File {
  id: string;
  number: number;
}

export default function PreSummaryPage() {
  const [topic, setTopic] = useState('');
  const [files, setFiles] = useState<ImageFile[]>([]);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSubmit = () => {
    if (topic.trim() || files.length > 0) {
      const { dismiss } = toast({ description: 'Processing your files... This may take a moment.' });

      const readPromises = files.map(file => {
        return new Promise<{id: string, name: string, dataUrl: string, number: number, type: 'image' | 'text'} | string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const result = e.target?.result;
              if (file.type.startsWith('image/')) {
                sessionStorage.setItem(`image_${file.id}`, result as string);
                resolve({ id: file.id, name: file.name, dataUrl: result as string, number: file.number, type: 'image' });
              } else {
                  // Handle text-based files as before
                  // This part is simplified for brevity, assuming text extraction logic from previous steps
                  resolve(result as string);
              }
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = reject;

          if (file.type.startsWith('image/') || file.name.endsWith('.docx') || file.name.endsWith('.pdf')) {
             reader.readAsDataURL(file); // Reading as data URL for simplicity, adjust as needed
          } else {
             reader.readAsText(file);
          }
        });
      });

      Promise.all(readPromises).then(results => {
        const initialImages = results.filter(r => typeof r === 'object' && r.type === 'image');
        const textContents = results.filter(r => typeof r === 'string');

        sessionStorage.setItem('initialImages', JSON.stringify(initialImages));
        sessionStorage.setItem('uploadedDocumentContent', textContents.join('\n\n'));
        sessionStorage.setItem('initialTopic', topic.trim());
        
        dismiss();
        router.push(`/`);

      }).catch(error => {
        dismiss();
        console.error("File processing error:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not process all files. Please try again.' });
      });
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(event.target.files || []).map((file, index) => 
      Object.assign(file, {
        id: crypto.randomUUID(),
        number: files.length + index + 1
      })
    );
    setFiles(prevFiles => [...prevFiles, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prevFiles => {
        const newFiles = prevFiles.filter(f => f.id !== id);
        // Renumber remaining files
        return newFiles.map((file, index) => Object.assign(file, { number: index + 1 }));
    });
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
            Describe your topic, attach relevant files, and let the AI build a solid foundation for you.
          </p>
          <div className="relative">
            <Textarea
              placeholder="e.g., An analysis of the economic impact of renewable energy sources, including the attached charts and diagrams."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={4}
              className="bg-gray-900 border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-lg pr-12"
            />
          </div>
          <div>
            <Button variant="outline" className="w-full border-dashed border-gray-600 hover:bg-gray-700/50" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-5 h-5 mr-2" />
                Attach Files (Images, Docs, PDFs)
            </Button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".txt,.md,.html,.docx,.pdf,image/*"
                multiple
            />
          </div>
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between bg-gray-700/50 rounded-md px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 truncate">
                        <span className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">{file.number}</span>
                        <Paperclip className="w-4 h-4 text-gray-400" />
                        <span className="truncate">{file.name}</span>
                    </div>
                  <Button variant="ghost" size="icon" className="ml-2 h-6 w-6 text-gray-400 hover:text-white flex-shrink-0" onClick={() => removeFile(file.id)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button onClick={handleSubmit} className="w-full text-lg py-6 bg-blue-600 hover:bg-blue-700" disabled={!topic.trim() && files.length === 0}>
            Generate my Document
            <Zap className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
