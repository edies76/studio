import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  Sequence,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

type Scene = {
  id: string;
  start: number;
  duration: number;
  label: string;
  title: string;
  clip?: string;
};

const scenes: Scene[] = [
  { id: 'context', start: 0, duration: 120, label: '01  CONTEXT', title: 'A brief is not a document', clip: 'clips/01-landing-to-brief.mp4' },
  { id: 'brief', start: 120, duration: 240, label: '02  REQUIREMENT', title: 'The guide comes first', clip: 'clips/02-brief-context.mp4' },
  { id: 'parsed', start: 360, duration: 270, label: '03  STRUCTURE', title: 'The assignment becomes context', clip: 'clips/03-brief-parsed.mp4' },
  { id: 'draft', start: 630, duration: 390, label: '04  DRAFT', title: 'The agent proposes a structure', clip: 'clips/04-agent-draft.mp4' },
  { id: 'canvas', start: 1020, duration: 330, label: '05  DOCUMENT', title: 'The work lives in the document', clip: 'clips/05-canvas-tour.mp4' },
  { id: 'review', start: 1350, duration: 270, label: '06  REVIEW', title: 'Ask for a specific change', clip: 'clips/06-request-edit.mp4' },
  { id: 'proposal', start: 1620, duration: 270, label: '07  PROPOSAL', title: 'Review before applying', clip: 'clips/07-review-proposal.mp4' },
  { id: 'decision', start: 1890, duration: 210, label: '08  DECISION', title: 'You decide what enters', clip: 'clips/08-accept-edit.mp4' },
  { id: 'export', start: 2100, duration: 150, label: '09  DELIVERY', title: 'The file is ready to submit', clip: 'clips/09-export.mp4' },
];

const FPS = 30;
const TOTAL_FRAMES = 2370;

export type DemoProps = {
  voice?: string;
  music?: string;
  logo?: string;
};

const soundCues = [
  { at: 0, src: 'audio/sfx/transition-whoosh.mp3', volume: 0.28 },
  { at: 630, src: 'audio/sfx/agent-start.mp3', volume: 0.2 },
  { at: 1020, src: 'audio/sfx/canvas-focus.mp3', volume: 0.18 },
  { at: 1620, src: 'audio/sfx/proposal-pop.mp3', volume: 0.3 },
  { at: 1890, src: 'audio/sfx/accept-confirm.mp3', volume: 0.32 },
  { at: 2100, src: 'audio/sfx/export-click.mp3', volume: 0.28 },
];

function SceneOverlay({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 18, scene.duration - 18, scene.duration], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(frame, [0, 24], [24, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 72, opacity }}>
      <div style={{ transform: `translateY(${y}px)`, maxWidth: 900 }}>
        <div style={{ color: '#d7b79b', fontFamily: 'Arial, sans-serif', fontSize: 22, letterSpacing: 3, fontWeight: 700 }}>
          {scene.label}
        </div>
        <div style={{ marginTop: 14, color: '#fffaf4', fontFamily: 'Georgia, serif', fontSize: 64, lineHeight: 1.02, fontWeight: 700 }}>
          {scene.title}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function SceneFrame({ scene }: { scene: Scene }) {
  const hasClip = Boolean(scene.clip);
  return (
    <AbsoluteFill style={{ backgroundColor: '#211b17' }}>
      {hasClip ? (
        <Video src={staticFile(scene.clip!)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', color: '#fffaf4', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ fontSize: 24 }}>Coloca el clip en public/{scene.clip}</div>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(33,27,23,.08) 35%, rgba(33,27,23,.86) 100%)' }} />
      <SceneOverlay scene={scene} />
    </AbsoluteFill>
  );
}

function EndCard({ logo }: { logo?: string }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: '#f1ece5', alignItems: 'center', justifyContent: 'center', opacity }}>
      {logo ? <Img src={staticFile(logo)} style={{ width: 180, marginBottom: 28 }} /> : <div style={{ fontSize: 76, fontWeight: 700, color: '#211b17' }}>Docs<span style={{ color: '#9c6041' }}>S</span></div>}
      <div style={{ color: '#75695e', fontFamily: 'Arial, sans-serif', fontSize: 24, letterSpacing: 2 }}>DEL BRIEF AL ARCHIVO</div>
    </AbsoluteFill>
  );
}

function Demo({ voice, music, logo }: DemoProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: '#211b17' }}>
      {scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.start} durationInFrames={scene.duration}>
          <SceneFrame scene={scene} />
        </Sequence>
      ))}
      <Sequence from={TOTAL_FRAMES - 120} durationInFrames={120}>
        <EndCard logo={logo} />
      </Sequence>
      {voice ? <Audio src={staticFile(voice)} volume={1} /> : null}
      {music ? <Audio src={staticFile(music)} volume={0.13} loop /> : null}
      {soundCues.map((cue) => (
        <Sequence key={`${cue.at}-${cue.src}`} from={cue.at} durationInFrames={90}>
          <Audio src={staticFile(cue.src)} volume={cue.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

export const Root = () => (
  <>
    <Composition id="DocsStudioDemo16x9" component={Demo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ voice: 'audio/voiceover.mp3', music: 'audio/music-bed.mp3', logo: 'brand-lockup.svg' }} />
    <Composition id="DocsStudioDemo9x16" component={Demo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ voice: 'audio/voiceover.mp3', music: 'audio/music-bed.mp3', logo: 'brand-lockup.svg' }} />
  </>
);
