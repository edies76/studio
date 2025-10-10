"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";
import { autoResearch } from "@/ai/flows/auto-researcher";

interface ResearchResult {
  title: string;
  url: string;
  summary: string;
}

interface AutoResearcherViewProps {}

export function AutoResearcherView({}: AutoResearcherViewProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [overallSummary, setOverallSummary] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setResults([]);
    setOverallSummary("");
    try {
      const response = await autoResearch({ query });
      setResults(response.results);
      setOverallSummary(response.overallSummary);
    } catch (error) {
      console.error("Research failed:", error);
      // You could add a toast notification here for the user
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-gray-900 p-4 md:p-8 flex flex-col gap-4">
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <Input
          type="text"
          placeholder="Enter a research topic or question..."
          className="bg-gray-800 border-gray-700 text-white"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-2 hidden md:inline">Research</span>
        </Button>
      </form>

      <div className="flex-1 overflow-y-auto space-y-4">
        {isLoading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Researching... This may take a moment.</p>
          </div>
        )}

        {overallSummary && (
           <Card className="bg-gray-800/50 border-blue-500">
            <CardHeader>
              <CardTitle className="text-blue-400">Overall Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">{overallSummary}</p>
            </CardContent>
          </Card>
        )}

        {results.map((result, index) => (
          <Card key={index} className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-gray-100">{result.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 mb-4">{result.summary}</p>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline text-sm"
              >
                View Source
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}