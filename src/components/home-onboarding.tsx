'use client';

import { useEffect, useState } from 'react';

const slides = [
  {
    eyebrow: '01 / START WITH THE RULES',
    title: 'Turn a rubric into a document plan.',
    body: 'For a university report, add the assignment, the rubric, and source files before you draft. The document keeps the required sections in view.',
    example: 'Lab report · method, evidence, conclusion',
  },
  {
    eyebrow: '02 / REPEAT A GOOD DOCUMENT',
    title: 'Keep one approved structure across many documents.',
    body: 'For proposals, site reports, or training materials, begin from the same brief and template—then adapt names, dates, and values without rebuilding the structure.',
    example: 'Client proposal · scope, deliverables, exclusions',
  },
];

const storageKey = 'docs-home-onboarding-dismissed-v1';

export default function HomeOnboarding() {
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    setVisible(window.localStorage.getItem(storageKey) !== 'true');
  }, []);

  const close = () => {
    window.localStorage.setItem(storageKey, 'true');
    setVisible(false);
  };

  if (!visible) return null;
  const current = slides[slide];
  const last = slide === slides.length - 1;

  return (
    <div className="home-onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="home-onboarding__card">
        <button type="button" className="home-onboarding__skip" onClick={close}>Skip</button>
        <div className="home-onboarding__index" aria-hidden="true">
          {slides.map((_, index) => <i key={index} className={index === slide ? 'is-active' : ''} />)}
        </div>
        <p className="home-onboarding__eyebrow">{current.eyebrow}</p>
        <h2 id="onboarding-title">{current.title}</h2>
        <p className="home-onboarding__body">{current.body}</p>
        <div className="home-onboarding__example"><span>EXAMPLE</span><strong>{current.example}</strong></div>
        <div className="home-onboarding__actions">
          <button type="button" className="home-onboarding__quiet" onClick={close}>I&apos;ll explore first</button>
          <button type="button" className="home-onboarding__next" onClick={last ? close : () => setSlide((value) => value + 1)}>{last ? 'Open my library' : 'Next'} <span aria-hidden="true">→</span></button>
        </div>
      </div>
    </div>
  );
}
