import Link from 'next/link';
import AnimatedBrand from '@/components/animated-brand';
import LocaleSwitch from '@/components/locale-switch';
import OriginTimeline from './timeline-client';

export const metadata = {
  title: 'Why Docs Studio | Product origin and principles',
  description: 'The story behind Docs Studio and its evolution from brief-led drafting to a human and agent document workspace.',
};

export default function OriginPage() {
  return <main className="focused-page"><header className="focused-page__nav"><AnimatedBrand className="focused-page__brand" scrollRoot=".focused-page" /><nav><Link href="/usecases">Use cases</Link><Link href="/mcp">MCP</Link><LocaleSwitch /><Link href="/home" className="focused-page__cta">Open workspace ↗</Link></nav></header><div className="focused-page__wrap"><section className="focused-page__hero"><p className="focused-page__label">THE ORIGIN</p><h1>A document should remember why it exists.</h1><p>Docs Studio grew from a simple frustration: the instructions, the AI draft, and the final document kept drifting apart. The product keeps them connected without pretending to be every editor for everyone.</p></section><OriginTimeline /><section className="focused-page__principle"><div><p className="focused-page__label">THE PRINCIPLE</p><h2>Focused beats general when the rules matter.</h2></div><p>Word and Google Docs remain the right tools for broad editing and collaboration. Docs Studio is deliberately narrower: it helps a person or an agent turn known requirements into a structured, reviewable document.</p></section><footer className="focused-page__footer"><span>Start with the document’s reason for existing.</span><Link href="/">Back to Docs Studio ↗</Link></footer></div></main>;
}
