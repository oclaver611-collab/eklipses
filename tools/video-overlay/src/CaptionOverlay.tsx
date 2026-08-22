import React, {useMemo} from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {CAPTIONS, type Caption} from './CaptionsData';

const FONT = '"Arial Black", Arial, sans-serif';
const RYAN_COLOR = '#FFD700';   // gold
const SERGE_COLOR = '#FFFFFF';  // white
const BOX_BG = 'rgba(0,0,0,0.78)';

// Speaker label prefix shown left of text
const LABEL: Record<Caption['speaker'], string> = {
  ryan: 'RYAN',
  serge: 'SERGE',
};

export const CaptionOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const currentS = frame / fps;

  const active = useMemo(() => {
    return CAPTIONS.find(c => currentS >= c.startS && currentS < c.endS) ?? null;
  }, [currentS]);

  if (!active) {
    return (
      <AbsoluteFill>
        <OffthreadVideo src={staticFile('round2-source.mp4')} style={{width: '100%', height: '100%'}} />
      </AbsoluteFill>
    );
  }

  const textColor = active.speaker === 'ryan' ? RYAN_COLOR : SERGE_COLOR;
  const label = LABEL[active.speaker];

  // Fade in over 4 frames, fade out over last 4 frames of caption window
  const windowFrames = (active.endS - active.startS) * fps;
  const elapsed = currentS - active.startS;
  const elapsedFrames = elapsed * fps;
  const fadeIn = Math.min(1, elapsedFrames / 4);
  const fadeOut = Math.min(1, (windowFrames - elapsedFrames) / 4);
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile('round2-source.mp4')} style={{width: '100%', height: '100%'}} />

      {/* Caption box — bottom of frame, 16:9 safe zone */}
      <div
        style={{
          position: 'absolute',
          bottom: 72,
          left: '4%',
          right: '4%',
          opacity,
          background: BOX_BG,
          borderRadius: 10,
          padding: '14px 22px 16px',
        }}
      >
        {/* Speaker label */}
        <div
          style={{
            fontFamily: FONT,
            fontSize: 22,
            fontWeight: 900,
            color: textColor,
            letterSpacing: '2px',
            marginBottom: 6,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>

        {/* Caption text */}
        <div
          style={{
            fontFamily: FONT,
            fontSize: 42,
            fontWeight: 900,
            color: textColor,
            lineHeight: 1.25,
            letterSpacing: '-0.3px',
          }}
        >
          {active.text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
