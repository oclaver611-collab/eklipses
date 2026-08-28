#!/usr/bin/env python3
"""
scripts/remove-watermark-sofia.py
AI video inpainting to remove HeyGen watermark from Sofia's speaking video.
Uses ProPainter on Replicate — handles temporal consistency (not ffmpeg delogo).

Requirements:
  pip install replicate requests
  ffmpeg on PATH (verify: ffmpeg -version)
  REPLICATE_API_TOKEN env var (get from replicate.com/account/api-tokens)

Usage:
  python scripts/remove-watermark-sofia.py

  Override watermark region if defaults are wrong:
  python scripts/remove-watermark-sofia.py --x 0 --y 380 --w 480 --h 80

  Sofia's video is 19MB. Expected runtime: ~60-90s on Replicate.
  DO NOT batch-apply to other avatars until you've verified the output frames.

Output:
  scripts/heygen-output/sofia_speaking_clean.mp4   — inpainted video
  scripts/heygen-output/sofia_verify_frames/       — 5 frames at 10/25/50/75/90%
"""

import os, sys, subprocess, time, argparse, requests
from pathlib import Path

SOFIA_URL = "https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sofia_speaking.mp4"
OUT_DIR   = Path(__file__).parent / "heygen-output"
FRAMES_DIR = OUT_DIR / "sofia_verify_frames"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--x', type=int, default=None, help='Mask X (left edge px)')
    parser.add_argument('--y', type=int, default=None, help='Mask Y (top edge px)')
    parser.add_argument('--w', type=int, default=None, help='Mask width px')
    parser.add_argument('--h', type=int, default=None, help='Mask height px')
    args = parser.parse_args()

    token = os.environ.get('REPLICATE_API_TOKEN')
    if not token:
        print("ERROR: REPLICATE_API_TOKEN not set. Get one at replicate.com/account/api-tokens")
        sys.exit(1)

    try:
        import replicate
    except ImportError:
        print("ERROR: run: pip install replicate requests")
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    # ── 1. Download source video ──────────────────────────────────────────────
    src = OUT_DIR / "sofia_speaking_original.mp4"
    if src.exists():
        print(f"Source already downloaded: {src} ({src.stat().st_size // 1024}KB)")
    else:
        print(f"Downloading Sofia video ({SOFIA_URL}) ...")
        r = requests.get(SOFIA_URL, stream=True)
        r.raise_for_status()
        with open(src, 'wb') as f:
            for chunk in r.iter_content(chunk_size=65536):
                f.write(chunk)
        print(f"Downloaded: {src.stat().st_size // 1024}KB")

    # ── 2. Probe dimensions and duration ─────────────────────────────────────
    import json as _json
    probe = subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
         '-show_entries', 'stream=width,height,r_frame_rate,duration',
         '-of', 'json', str(src)],
        capture_output=True, text=True, check=True
    )
    info    = _json.loads(probe.stdout)['streams'][0]
    vid_w   = int(info['width'])
    vid_h   = int(info['height'])
    fps_frac = info['r_frame_rate']
    duration = float(info['duration'])
    print(f"Video: {vid_w}x{vid_h}  fps={fps_frac}  duration={duration:.2f}s")

    # ── 3. Compute mask regions ───────────────────────────────────────────────
    # Frame inspection at t=18s confirmed two distinct HeyGen watermark zones
    # on a 1920x1080 video (values confirmed visually, not guessed):
    #
    #   Zone A — HeyGen logo (bottom-right): approx x=1130, y=610, w=430, h=180
    #   Zone B — Control bar strip (full width, bottom): approx y=740, h=340
    #
    # --x/y/w/h overrides apply to Zone B (control bar) only.
    # Zone A (logo) uses hardcoded ratios of vid dimensions.

    # Zone A: HeyGen logo (top-right of watermark block)
    logo_x = int(vid_w * 0.588)   # ~1130 of 1920
    logo_y = int(vid_h * 0.565)   # ~610 of 1080
    logo_w = int(vid_w * 0.224)   # ~430
    logo_h = int(vid_h * 0.167)   # ~180

    # Zone B: Control bar + progress bar strip
    bar_h  = args.h or int(vid_h * 0.315)   # ~340px
    mx     = args.x if args.x is not None else 0
    my     = args.y if args.y is not None else (vid_h - bar_h)
    mw     = args.w or vid_w
    mh     = args.h or bar_h

    print(f"Mask Zone A (logo):    x={logo_x} y={logo_y} w={logo_w} h={logo_h}")
    print(f"Mask Zone B (bar):     x={mx} y={my} w={mw} h={mh}")

    # Replicate Files URLs require Bearer auth that the model container lacks.
    # Use the public R2 URL directly. To avoid OOM, use resize_ratio=0.25
    # (480x270) — 4x less VRAM than 0.5x. Fresh Replicate GPU starts with
    # ~40GB free; at 0.25x the 2196-frame video fits comfortably.
    clip_url = SOFIA_URL

    # ── 5. Generate mask PNG ──────────────────────────────────────────────────
    # ProPainter accepts a static PNG mask (white = inpaint, black = keep).
    # Draw BOTH watermark zones: logo (Zone A) and control bar (Zone B).
    mask_path = OUT_DIR / "sofia_mask.png"
    # Chain two drawbox filters via vf_complex — zone A (logo) then zone B (bar)
    drawboxes = (
        f"drawbox=x={logo_x}:y={logo_y}:w={logo_w}:h={logo_h}:color=white:t=fill,"
        f"drawbox=x={mx}:y={my}:w={mw}:h={mh}:color=white:t=fill"
    )
    subprocess.run([
        'ffmpeg', '-y',
        '-f', 'lavfi',
        '-i', f'color=c=black:s={vid_w}x{vid_h}',
        '-vf', drawboxes,
        '-vframes', '1',
        str(mask_path)
    ], check=True, capture_output=True)
    print(f"Mask PNG created: {mask_path} ({mask_path.stat().st_size // 1024}KB)")

    # ── 6. Encode mask as base64 data URI ─────────────────────────────────────
    # Avoids Replicate Files API auth issue (model container can't authenticate
    # against api.replicate.com — data URIs sidestep the download entirely).
    import base64 as _b64
    with open(mask_path, 'rb') as f:
        mask_b64 = _b64.b64encode(f.read()).decode()
    mask_url = f"data:image/png;base64,{mask_b64}"
    print(f"Mask encoded as base64 data URI ({len(mask_b64) // 1024}KB)")

    # ── 7. Submit to ProPainter ───────────────────────────────────────────────
    # Version hash from jd7h/propainter latest (Oct 2023, still current)
    PROPAINTER_VERSION = "e5ea7ae04e97c96a0e14c70d8e4cb899abdf326a377c01f1c10966ccd6c6bae4"
    print("\nSubmitting to Replicate ProPainter (jd7h/propainter) ...")
    print(f"  Source video: trimmed 5s clip ({clip_url[:80]}...)")
    print(f"  Mask:         {len(mask_b64)//1024}KB base64 PNG  (2 zones: logo + control bar)")
    print(f"  resize_ratio: 0.25  → {vid_w//4}x{vid_h//4}  (0.5 OOMs even on 44GB; 0.25 is safe)")
    prediction = replicate.predictions.create(
        version=PROPAINTER_VERSION,
        input={
            "video":        clip_url,
            "mask":         mask_url,
            "mode":         "video_inpainting",
            "resize_ratio": 0.25,  # 480x270 — fits comfortably on Replicate GPU
            "fp16":         True,
            "save_fps":     30,
            "mask_dilation": 8,    # wider dilation to cover logo anti-aliasing and border fringe
        }
    )
    print(f"  Prediction ID: {prediction.id}")
    print("  Polling every 5s (typically completes in 60-120s) ...")

    t0 = time.time()
    while prediction.status not in ("succeeded", "failed", "canceled"):
        time.sleep(5)
        prediction.reload()
        elapsed = int(time.time() - t0)
        print(f"  [{elapsed:3d}s] {prediction.status}")

    if prediction.status != "succeeded":
        print(f"\nFAILED: {prediction.error}")
        print("Try adjusting the mask region or check Replicate logs.")
        sys.exit(1)

    elapsed = int(time.time() - t0)
    print(f"  Completed in {elapsed}s")

    # ── 8. Download result ────────────────────────────────────────────────────
    result_url = prediction.output
    if isinstance(result_url, list):
        result_url = result_url[0]
    result_path = OUT_DIR / "sofia_speaking_clean.mp4"
    print(f"\nDownloading result ...")
    r = requests.get(result_url, stream=True)
    r.raise_for_status()
    with open(result_path, 'wb') as f:
        for chunk in r.iter_content(chunk_size=65536):
            f.write(chunk)
    print(f"Saved: {result_path} ({result_path.stat().st_size // 1024}KB)")

    # ── 9. Extract mid-motion verification frames ─────────────────────────────
    # Timestamps spread across the full 36s video — not just stills from the
    # start/end, where smearing/ghosting is hardest to see.
    verify_timestamps = [3.6, 9.2, 18.3, 27.5, 32.9]
    print("\nExtracting mid-motion verification frames ...")
    for ts in verify_timestamps:
        out = FRAMES_DIR / f"clean_{ts}s.png"
        subprocess.run([
            'ffmpeg', '-y', '-ss', f'{ts:.3f}', '-i', str(result_path),
            '-vframes', '1', '-q:v', '1', str(out)
        ], check=True, capture_output=True)
        print(f"  {out.name}")
    # Extract matching originals for side-by-side comparison
    print("Extracting matching original frames ...")
    for ts in verify_timestamps:
        out = FRAMES_DIR / f"orig_{ts}s.png"
        subprocess.run([
            'ffmpeg', '-y', '-ss', f'{ts:.3f}', '-i', str(src),
            '-vframes', '1', '-q:v', '1', str(out)
        ], check=True, capture_output=True)
        print(f"  {out.name}")

    print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Inpainted video:     {result_path}
Verify frames (png): {FRAMES_DIR}/clean_*.png
Original frames:     {FRAMES_DIR}/orig_*.png

Check pairs  orig_X.png → clean_X.png  for each timestamp:
  1. Is the watermark region clean (no logo, no control bar)?
  2. Is the fill realistic (no smearing, ghosting, or block artifacts)?
  3. Does the fill hold across all 5 frames including fast motion?

If frames look good → play sofia_speaking_clean.mp4 in a media player.
If playback looks good → batch-apply to the other 6 avatars.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")

if __name__ == '__main__':
    main()
