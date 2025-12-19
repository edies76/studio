'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Zap, Paperclip, MessageSquare, Wrench, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

interface UploadedImage {
  id: string;
  name: string;
  dataUrl: string;
  number: number;
}

interface RightSidebarProps {
  initialPrompt: string;
  onChatMessage: (message: string, images: UploadedImage[]) => Promise<string | null>;
  uploadedImages: UploadedImage[];
  onImageUpload: (files: File[]) => void;
  onReanalyze: () => void;
}

export default function RightSidebar({ 
  initialPrompt,
  onChatMessage,
  uploadedImages,
  onImageUpload,
  onReanalyze
}: RightSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([{ sender: 'user', text: initialPrompt }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'tools'>('chat');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" }); // Use auto for instant scroll on new message
  }

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  const handleSendMessage = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: Message = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const aiResponse = await onChatMessage(currentInput, uploadedImages);
      if (aiResponse) {
        const aiMessage: Message = { sender: 'ai', text: aiResponse };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      const errorMessage: Message = { sender: 'ai', text: 'Sorry, I encountered an error. Please try again.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
        onImageUpload(files);
        setActiveTab('tools');
    }
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="h-full flex flex-col bg-gray-800/30 border-l border-gray-700">
        {/* 1. TABS (FIXED) */}
        <div className="flex shrink-0 border-b border-gray-700">
            <button onClick={() => setActiveTab('chat')} className={cn('flex-1 flex items-center justify-center gap-2 p-3 text-sm font-medium', activeTab === 'chat' ? 'bg-gray-800/50 text-white' : 'text-gray-400 hover:bg-gray-700/50')}><MessageSquare className="w-4 h-4" />Chat</button>
            <button onClick={() => setActiveTab('tools')} className={cn('flex-1 flex items-center justify-center gap-2 p-3 text-sm font-medium', activeTab === 'tools' ? 'bg-gray-800/50 text-white' : 'text-gray-400 hover:bg-gray-700/50')}><Wrench className="w-4 h-4" />Tools & Images</button>
        </div>

        {/* 2. CONTENT AREA (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'chat' && (
                <div className="space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-3 rounded-lg max-w-xs lg:max-w-md ${msg.sender === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start"><div className="p-3 rounded-lg bg-gray-700"><p className="text-sm">B.A.M.B.A.I. is thinking...</p></div></div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            )}
            {activeTab === 'tools' && (
                <div className="flex flex-col gap-4">
                    <div className='bg-gray-900/50 rounded-lg p-3'>
                        <h3 className="text-md font-semibold mb-2">Content Analysis</h3>
                        <p className="text-sm text-gray-400 mb-3">If images appear broken, click here to re-process the document.</p>
                        <Button onClick={onReanalyze} className="w-full bg-indigo-600 hover:bg-indigo-700"><RefreshCw className="w-4 h-4 mr-2" />Re-analyze Content</Button>
                    </div>
                    {uploadedImages.length > 0 && (
                        <div className="bg-gray-900/50 rounded-lg p-3">
                            <h3 className="text-md font-semibold mb-2">Attached Images ({uploadedImages.length})</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {uploadedImages.map((image) => (
                                    <div key={image.id} className="relative group aspect-square">
                                        <img src={image.dataUrl} alt={image.name} className="w-full h-full object-cover rounded-md" />
                                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-1"><p className="text-white text-xs text-center">{image.name}</p></div>
                                        <div className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{image.number}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* 3. INPUT AREA (FIXED) - Only for Chat */}
        {activeTab === 'chat' && (
            <div className="shrink-0 p-4 border-t border-gray-700">
                <div className="relative">
                    <Textarea
                        placeholder={isLoading ? "Waiting for AI..." : "Ask for changes..."}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        rows={3}
                        className="bg-gray-900 border-gray-600 focus:ring-blue-500 focus:border-blue-500 pr-20"
                        disabled={isLoading}
                    />
                    <div className="absolute bottom-2 right-2 flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => fileInputRef.current?.click()} disabled={isLoading}><Paperclip className="w-5 h-5" /></Button>
                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={handleSendMessage} disabled={isLoading || input.trim() === ''}><Zap className="w-5 h-5" /></Button>
                    </div>
                </div>
            </div>
        )}
        
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileChange} />
    </div>
  );
}
