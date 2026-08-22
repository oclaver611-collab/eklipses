import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// Text safe zone: TikTok/YouTube UI occupies top ~10% and bottom ~22%
// of a 1920px frame. Keep text between y=210 and y=1490.

const HOOK = 'I Tried to Date This AI Girl — Episode 1';
const SUB = 'Real AI dating practice session';
const TAGLINE = 'Eklipses  —  AI that reads the room';

const BOX_BG = 'rgba(0, 0, 0, 0.68)';
const FONT = '"Arial Black", Arial, sans-serif';

export const EklipsesOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  // Fade in over first 20 frames (0.67s), hold, fade out over last 20 frames
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {extrapolateRight: 'clamp'});
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    {extrapolateLeft: 'clamp'}
  );
  const opacity = Math.min(fadeIn, fadeOut);

  // Subtle slide-down for top box on entry
  const slideY = interpolate(frame, [0, 20], [-18, 0], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill>
      {/* Background: the already-cut source video */}
      <OffthreadVideo src={staticFile('source.mp4')} />

      {/* ── TOP OVERLAY BOX ─────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 218 + slideY,
          left: 0,
          right: 0,
          opacity,
          background: BOX_BG,
          padding: '18px 28px 20px',
        }}
      >
        {/* Hook line */}
        <div
          style={{
            textAlign: 'center',
            color: '#ffffff',
            fontSize: 54,
            fontWeight: 900,
            fontFamily: FONT,
            lineHeight: 1.18,
            letterSpacing: '-0.5px',
          }}
        >
          {HOOK}
        </div>

        {/* Sub line */}
        <div
          style={{
            textAlign: 'center',
            color: '#ffcc00',
            fontSize: 38,
            fontWeight: 700,
            fontFamily: FONT,
            lineHeight: 1.2,
            marginTop: 10,
          }}
        >
          {SUB}
        </div>
      </div>

      {/* ── BOTTOM TAGLINE BOX ──────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 432,          // 432px from bottom → top edge ≈ 1450px in 1920 frame
          left: 0,
          right: 0,
          opacity,
          background: BOX_BG,
          padding: '13px 28px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.88)',
          fontSize: 30,
          fontWeight: 700,
          fontFamily: FONT,
          letterSpacing: '0.3px',
        }}
      >
        {TAGLINE}
      </div>
    </AbsoluteFill>
  );
};
