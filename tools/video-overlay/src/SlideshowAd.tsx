import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, staticFile} from 'remotion';

const FPS = 30;

const SLIDES = [
  {
    src: 'slide1.jpg',
    line1: 'Most guys miss this signal.',
    line2: null,
    gold: false,
    durationS: 4,
  },
  {
    src: 'slide2.jpg',
    line1: 'She just gave one —',
    line2: 'did you catch it?',
    gold: false,
    durationS: 4,
  },
  {
    src: 'slide3.jpg',
    line1: "He didn't.",
    line2: "Here's what Ryan told him.",
    gold: false,
    durationS: 5,
  },
  {
    src: 'slide4.jpg',
    line1: 'Eklipses.',
    line2: 'Practice the moves that actually work.',
    gold: true,
    durationS: 5,
  },
];

const Caption: React.FC<{line1: string; line2: string | null; gold: boolean}> = ({
  line1,
  line2,
  gold,
}) => (
  <AbsoluteFill
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: '0 48px 110px',
    }}
  >
    <div
      style={{
        background: 'rgba(0,0,0,0.78)',
        borderRadius: 14,
        padding: line2 ? '22px 40px 22px' : '22px 40px',
        textAlign: 'center',
        maxWidth: 940,
      }}
    >
      <div
        style={{
          fontFamily: '"Arial Black", "Arial Bold", Arial, sans-serif',
          fontWeight: 900,
          fontSize: 62,
          lineHeight: 1.25,
          color: gold ? '#FFD700' : '#FFFFFF',
          letterSpacing: '-0.5px',
        }}
      >
        {line1}
      </div>
      {line2 && (
        <div
          style={{
            fontFamily: '"Arial Black", "Arial Bold", Arial, sans-serif',
            fontWeight: 900,
            fontSize: gold ? 46 : 58,
            lineHeight: 1.3,
            color: gold ? '#FFFFFF' : '#FFFFFF',
            marginTop: 6,
            letterSpacing: '-0.5px',
          }}
        >
          {line2}
        </div>
      )}
    </div>
  </AbsoluteFill>
);

export const SlideshowAd: React.FC = () => {
  let offset = 0;

  return (
    <AbsoluteFill style={{background: '#000'}}>
      {/* Single continuous narration track — no mixing */}
      <Audio src={staticFile('ryan-narration.mp3')} />

      {SLIDES.map((slide, i) => {
        const durationFrames = slide.durationS * FPS;
        const from = offset;
        offset += durationFrames;

        return (
          <Sequence key={i} from={from} durationInFrames={durationFrames}>
            <AbsoluteFill>
              {/* Image: cover-crop 1280x720 → 1080x1920 portrait */}
              <Img
                src={staticFile(slide.src)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center center',
                }}
              />
              {/* Gradient vignette so text is always readable */}
              <AbsoluteFill
                style={{
                  background:
                    'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 25%, transparent 60%, rgba(0,0,0,0.55) 100%)',
                }}
              />
              <Caption line1={slide.line1} line2={slide.line2} gold={slide.gold} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
