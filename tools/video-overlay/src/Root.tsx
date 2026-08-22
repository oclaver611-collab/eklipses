import React from 'react';
import {Composition} from 'remotion';
import {EklipsesOverlay} from './Overlay';
import {CaptionOverlay} from './CaptionOverlay';
import {SlideshowAd} from './SlideshowAd';

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
    </>
  );
};
