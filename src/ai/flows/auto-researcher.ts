'use server';

import { ai, genkit } from '@/ai/genkit';
import { z } from 'genkit';
import { googleSearch } from 'genkitx-googlesearch';

// Schema for a single research result
const ResearchResultSchema = z.object({
  title: z.string().describe("The title of the research paper or article."),
  url: z.string().url().describe("The URL of the source."),
  summary: z.string().describe("A concise summary of the key findings or main points of the source."),
});

// Input schema for the researcher flow
const AutoResearcherInputSchema = z.object({
  query: z.string().describe('The research topic or question to investigate.'),
});
export type AutoResearcherInput = z.infer<typeof AutoResearcherInputSchema>;

// Output schema for the researcher flow
const AutoResearcherOutputSchema = z.object({
  results: z.array(ResearchResultSchema).describe("A list of research results, each with a title, URL, and summary."),
  overallSummary: z.string().describe("A high-level summary combining the findings from all sources."),
});
export type AutoResearcherOutput = z.infer<typeof AutoResearcherOutputSchema>;


// The main function to be called from the client
export async function autoResearch(input: AutoResearcherInput): Promise<AutoResearcherOutput> {
  return autoResearcherFlow(input);
}

// A simple flow to summarize text from a URL
const summarizeUrlContent = ai.defineFlow(
  {
    name: 'summarizeUrlContent',
    inputSchema: z.object({ url: z.string() }),
    outputSchema: z.string(),
  },
  async ({ url }) => {
    // This is a placeholder for actually fetching and summarizing content.
    // In a real implementation, you would use `view_text_website` and a summarizer prompt.
    console.log(`Summarizing content from: ${url}`);
    const { output: websiteContent } = await genkit.tools.viewTextWebsite(url);

    const { output: summary } = await ai.prompt`Summarize the following content: ${websiteContent}`;
    return summary;
  }
);


// The main researcher flow
const autoResearcherFlow = ai.defineFlow(
  {
    name: 'autoResearcherFlow',
    inputSchema: AutoResearcherInputSchema,
    outputSchema: AutoResearcherOutputSchema,
  },
  async ({ query }) => {

    const searchResults = await genkit.tools.googleSearch(query + " academic paper filetype:pdf");

    const topResults = searchResults.slice(0, 3); // Limit to top 3 results for efficiency

    const researchData = await Promise.all(
      topResults.map(async (result) => {
        const summary = await summarizeUrlContent({ url: result.url });
        return {
          title: result.title,
          url: result.url,
          summary: summary,
        };
      })
    );

    const combinedSummaries = researchData.map(r => `Source: ${r.title}\nSummary: ${r.summary}`).join('\n\n');

    const { output: overallSummary } = await ai.prompt`
      You have been provided with summaries from multiple research sources.
      Synthesize them into a single, coherent, high-level summary of the topic.

      Summaries:
      ${combinedSummaries}
    `;

    return {
      results: researchData,
      overallSummary: overallSummary,
    };
  }
);