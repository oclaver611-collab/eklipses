import React from 'react';
import {Composition} from 'remotion';
import {EklipsesOverlay} from './Overlay';
import {CaptionOverlay} from './CaptionOverlay';
import {SlideshowAd} from './SlideshowAd';
import {LessonSlice} from './LessonSlice';
import {
  SLICE1_AUDIO, SLICE1_CAPTIONS, SLICE1_TOTAL_SEC,
  SLICE2_AUDIO, SLICE2_CAPTIONS, SLICE2_TOTAL_SEC,
  SLICE3_AUDIO, SLICE3_CAPTIONS, SLICE3_TOTAL_SEC,
} from './LessonSliceData';

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Episode clips — 90s portrait TikTok format */}
      <Composition
        id="EklipsesOverlay"
        component={EklipsesOverlay}
        durationInFrames={90 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
      />

      {/* Full-session captioned export — 777s landscape 1080p */}
      <Composition
        id="FullVideoCaption"
        component={CaptionOverlay}
        durationInFrames={777 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />

      {/* Slideshow ad — 18s portrait 9:16 TikTok */}
      <Composition
        id="SlideshowAd"
        component={SlideshowAd}
        durationInFrames={18 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
      />

      {/* ── Lesson 1 marketing slices (portrait 9:16) ──────────────────────── */}

      <Composition
        id="LessonSlice1"
        component={LessonSlice}
        durationInFrames={Math.round(SLICE1_TOTAL_SEC * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          audioFile: SLICE1_AUDIO,
          captions: SLICE1_CAPTIONS,
          audioDurationSec: SLICE1_TOTAL_SEC - 4,
        }}
      />

      <Composition
        id="LessonSlice2"
        component={LessonSlice}
        durationInFrames={Math.round(SLICE2_TOTAL_SEC * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          audioFile: SLICE2_AUDIO,
          captions: SLICE2_CAPTIONS,
          audioDurationSec: SLICE2_TOTAL_SEC - 4,
        }}
      />

      <Composition
        id="LessonSlice3"
        component={LessonSlice}
        durationInFrames={Math.round(SLICE3_TOTAL_SEC * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          audioFile: SLICE3_AUDIO,
          captions: SLICE3_CAPTIONS,
          audioDurationSec: SLICE3_TOTAL_SEC - 4,
        }}
      />
    </>
  );
};
