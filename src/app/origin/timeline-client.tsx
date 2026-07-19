'use client';

import { useState } from 'react';

const milestones = [
  ['01', 'The brief was the missing surface', 'Most writing tools start with a blank page. Most AI chats start with a prompt. Docs Studio started with what people already had: a guide, rubric, template, or reference file.'],
  ['02', 'The document became the source of truth', 'The draft should not live in a chat transcript or a preview panel. It needs a real paper-like surface with headings, tables, equations, images, and exportable structure.'],
  ['03', 'AI edits became decisions', 'A useful writing assistant should suggest changes without silently taking authorship. Proposals can be inspected, accepted, or rejected.'],
  ['04', 'Rules became the product wedge', 'The product became clearer: not a replacement for Word or Google Docs, but a focused generator for documents that must follow a brief, rubric, template, or repeatable process.'],
  ['05', 'The same surface opened to agents', 'MCP makes the workspace available beyond the browser. An agent can create, populate, check, revise, and export without bypassing human review.'],
];

export default function OriginTimeline() {
  const [active, setActive] = useState(2);
  const selected = milestones[active];
  return <section className="origin-timeline"><div className="focused-page__section-head"><p className="focused-page__label">PRODUCT TIMELINE / SELECT A CHAPTER</p><h2>From blank page to rule-following workspace.</h2></div><div className="origin-timeline__track" role="tablist">{milestones.map(([number, title], index) => <button type="button" role="tab" aria-selected={active === index} className={active === index ? 'is-active' : ''} key={number} onClick={() => setActive(index)}><span>{number}</span><b>{title}</b></button>)}</div><div className="origin-timeline__detail" key={selected[0]}><p className="focused-page__label">CHAPTER {selected[0]}</p><h3>{selected[1]}</h3><p>{selected[2]}</p></div></section>;
}
