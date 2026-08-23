import React, {useMemo} from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {LessonCaption} from './LessonSliceData';

const FONT = '"Arial Black", Arial, sans-serif';
const BRAND_FONT = 'Georgia, "Times New Roman", serif';
const CAPTION_COLOR = '#D9A054';   // Eklipses gold
const OUTRO_SEC = 4;               // seconds of outro card after audio ends

interface Props {
  audioFile: string;
  captions: LessonCaption[];
  audioDurationSec: number;
}

export const LessonSlice: React.FC<Props> = ({audioFile, captions, audioDurationSec}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const currentS = frame / fps;

  const isOutro = currentS >= audioDurationSec;

  const active = useMemo(() => {
    if (isOutro) return null;
    return captions.find(c => currentS >= c.startS && currentS < c.endS) ?? null;
  }, [currentS, isOutro, captions]);

  // Caption fade
  let captionOpacity = 0;
  if (active) {
    const windowFrames = (active.endS - active.startS) * fps;
    const elapsedFrames = (currentS - active.startS) * fps;
    const fadeIn = Math.min(1, elapsedFrames / 4);
    const fadeOut = Math.min(1, (windowFrames - elapsedFrames) / 4);
    captionOpacity = Math.min(fadeIn, fadeOut);
  }

  // Outro fade in over 0.5s, then stays
  const outroOpacity = isOutro
    ? interpolate(currentS - audioDurationSec, [0, 0.5], [0, 1], {extrapolateRight: 'clamp'})
    : 0;

  return (
    <AbsoluteFill style={{background: '#15171C', fontFamily: FONT}}>
      {/* Audio track */}
      <Audio src={staticFile(audioFile)} />

      {/* Subtle brand gradient */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: [
          'radial-gradient(ellipse 900px 700px at 50% 20%, rgba(217,160,84,0.07), transparent 60%)',
          'radial-gradient(ellipse 600px 500px at 10% 80%, rgba(94,200,217,0.04), transparent 55%)',
        ].join(','),
      }} />

      {/* Brand mark — top */}
      <div style={{
        position: 'absolute',
        top: 130,
        left: 0, right: 0,
        textAlign: 'center',
        fontFamily: BRAND_FONT,
        fontSize: 52,
        fontWeight: 700,
        color: '#D9A054',
        letterSpacing: 4,
        textTransform: 'uppercase',
      }}>
        Eklipses
      </div>

      {/* Decorative rule below brand */}
      <div style={{
        position: 'absolute',
        top: 218,
        left: '30%', right: '30%',
        height: 1,
        background: 'rgba(217,160,84,0.25)',
      }} />

      {/* Label below rule */}
      <div style={{
        position: 'absolute',
        top: 240,
        left: 0, right: 0,
        textAlign: 'center',
        fontFamily: FONT,
        fontSize: 24,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.35)',
        letterSpacing: 5,
        textTransform: 'uppercase',
      }}>
        Lesson 1 · Dating Coach
      </div>

      {/* Caption box — lower portion of frame */}
      {active && (
        <div style={{
          position: 'absolute',
          bottom: 230,
          left: '6%', right: '6%',
          opacity: captionOpacity,
          background: 'rgba(0,0,0,0.82)',
          borderRadius: 16,
          padding: '24px 32px 28px',
          borderLeft: '5px solid #D9A054',
        }}>
          <div style={{
            fontFamily: FONT,
            fontSize: 62,
            fontWeight: 900,
            color: CAPTION_COLOR,
            lineHeight: 1.22,
            letterSpacing: '-0.5px',
          }}>
            {active.text}
          </div>
        </div>
      )}

      {/* Outro card — fades over the brand background */}
      {outroOpacity > 0 && (
        <AbsoluteFill style={{
          background: '#15171C',
          opacity: outroOpacity,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 36,
          padding: '0 80px',
        }}>
          <div style={{
            fontFamily: FONT,
            fontSize: 58,
            fontWeight: 900,
            color: '#F2EFE9',
            textAlign: 'center',
            lineHeight: 1.25,
          }}>
            Want to try this yourself?
          </div>
          <div style={{
            fontFamily: BRAND_FONT,
            fontSize: 72,
            fontWeight: 700,
            color: '#D9A054',
            letterSpacing: 3,
          }}>
            eklipses.com
          </div>
          <div style={{
            fontFamily: FONT,
            fontSize: 28,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}>
            2 free sessions · no card required
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
