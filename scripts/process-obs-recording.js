#!/usr/bin/env node
/**
 * process-obs-recording.js — v4
 * Approach: portrait crop (crop=390:693:445:18) so Ryan's orb/label AND Sofia's
 * face are fully visible.  Playback controls masked via drawbox at y=1470.
 * Scaled 1080×1920 via lanczos.  Hook card (2s) prepended per slice.
 *
 * Run: node scripts/process-obs-recording.js
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const OBS = 'C:/Users/serge/Videos/EKtest.mp4';
const OUT = path.resolve(__dirname, '../lesson1_slices');
const TMP = 'C:/Users/serge/AppData/Local/Temp/ek-obs-slice';
fs.mkdirSync(TMP, { recursive: true });

const SYNC = 3.030;   // lesson audio starts here in OBS recording

const DUR = {
  s00:  43.049688,
  s01:  57.808875,
  s02:  32.522375,
  s02b: 30.249688,
  s03:  16.985938,
  s04:  49.632563,
  s05:  14.418938,
};

const SLICES = [
  { num: 1, label: 'Welcome + The Lesson',
    obsStart: SYNC,
    dur: DUR.s00 + DUR.s01,
    hook: "This is not a video.\\NThis is a gym." },
  { num: 2, label: 'Before Approach + Exchange',
    obsStart: SYNC + DUR.s00 + DUR.s01,
    dur: 90.0,  // Whisper-measured: "Sophia, nice to meet you." at exchange t=20.88 → slice t=87.3s
    hook: "He didn't rehearse\\Na single word." },
  { num: 3, label: 'Step 1 + Tease Exchange',
    obsStart: 193.96,  // measured: S04 "Stop. Did you see…" starts here in OBS
    dur: 72.0,          // Whisper-measured: "I like that actually." at exchange t=17.58 → slice t=69.78s
    hook: "He never said\\N'you're beautiful.'" },
  // Slices 4-8: obsStart values from Groq Whisper transcript of OBS audio from t=247.698s
  { num: 4, label: 'Step 2 — Playful Challenge + Job Exchange',
    obsStart: 263.778,
    dur: 75.20,
    hook: "Light the fuse.\\NThen let it burn." },
  { num: 5, label: 'Step 3 — Own Your Mystery + Noticing Exchange',
    obsStart: 340.078,
    dur: 83.79,
    hook: "She asked where he works.\\NHe said nothing." },
  { num: 6, label: 'Step 4 — The Verbal Spike + The Close',
    obsStart: 425.288,
    dur: 115.73,
    hook: "He never said\\N'I like you.'" },
  { num: 7, label: 'Step 5 — The Natural Close',
    obsStart: 541.018,
    dur: 46.76,
    hook: "No hints.\\NNo apology.\\NJust lead." },
  { num: 8, label: 'The Five Steps — Summary',
    obsStart: 589.258,
    dur: 86.38,
    hook: "Five steps.\\NOne rule.\\NLead." },
];

// ── Caption chunker
function chunkSegment(text, start, end, maxWords = 7) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return [{ start, end, text: text.trim() }];
  const sentSplit = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  if (sentSplit.length > 1) {
    const total = words.length;
    let cum = start;
    const out = [];
    for (const s of sentSplit) {
      const sw = s.trim().split(/\s+/).length;
      const d  = (end - start) * (sw / total);
      out.push(...chunkSegment(s, cum, cum + d, maxWords));
      cum += d;
    }
    return out;
  }
  const half = Math.ceil(words.length / 2);
  const mid  = start + (end - start) * (half / words.length);
  return [
    { start, end: mid, text: words.slice(0, half).join(' ') },
    { start: mid, end,  text: words.slice(half).join(' ') },
  ];
}

// ── Caption data (from Groq Whisper transcriptions of production audio)

const S00_OFF = 0, S01_OFF = DUR.s00 + 0.56; // +0.56: Whisper shows S01 voice starts 0.56s later than DUR.s00 predicts
const S00_SEGS = [
  { start:  0.00, end:  6.08, text: "Before we start, let me set the scene. You are walking along a beach, late afternoon." },
  { start:  6.54, end: 11.14, text: "You notice a woman sitting alone. She's been there a while, writing something in a notepad." },
  { start: 11.50, end: 16.54, text: "She looks completely at ease in her own world. You're interested, but you have no excuse to talk to her." },
  { start: 16.54, end: 23.18, text: "No mutual friends. No obvious opener. Just you, her, and about 30 seconds before the moment passes." },
  { start: 23.18, end: 28.46, text: "I'm Ryan. I've spent years studying what works and what doesn't when it comes to approaching women." },
  { start: 28.46, end: 34.34, text: "Not theory, real situations, real results." },
  { start: 34.34, end: 40.74, text: "The man you're about to watch is Alex. He doesn't know her. She doesn't know he exists." },
  { start: 40.74, end: 42.86, text: "Watch what he does. I'll stop and explain every move. Let's go." },
];
const S01_SEGS = [
  { start:  0.00, end:  2.36, text: "You've probably seen a hundred videos like this." },
  { start:  2.76, end:  7.82, text: "Guy explains how to talk to women, makes it sound simple, you watch, you feel inspired," },
  { start:  8.14, end:  9.32, text: "and then nothing changes." },
  { start:  9.86, end: 12.90, text: "Because watching someone else do it never made anyone better at anything." },
  { start: 13.44, end: 14.16, text: "This is different." },
  { start: 14.54, end: 18.50, text: "After this lesson, you're not going to close a YouTube tab and go back to your life." },
  { start: 18.78, end: 23.78, text: "You're going to practice, right here, right now, with some of the most beautiful women you've ever seen." },
  { start: 24.12, end: 27.50, text: "Different personalities, different ethnicities, different energies." },
  { start: 27.50, end: 30.96, text: "Some warm, some cold, some playful, some guarded." },
  { start: 31.48, end: 35.26, text: "Real conversations, real reactions, and zero consequences." },
  { start: 35.92, end: 37.34, text: "No anxiety about approaching." },
  { start: 37.78, end: 38.74, text: "No fear of rejection." },
  { start: 39.22, end: 41.24, text: "No going home wondering what you should have said." },
  { start: 41.58, end: 45.98, text: "You get to try it, fail, learn and try again, as many times as you want." },
  { start: 46.32, end: 47.98, text: "Nobody else is offering this." },
  { start: 48.46, end: 49.40, text: "This is not a video." },
  { start: 49.78, end: 50.58, text: "This is a gym." },
  { start: 51.22, end: 52.82, text: "Now, watch closely." },
  { start: 53.22, end: 54.78, text: "I'll show you exactly what to do." },
  { start: 55.10, end: 56.42, text: "And then you'll go do it yourself." },
  { start: 56.42, end: 57.78, text: "Let's begin!" },
];
function buildSlice1Captions() {
  const c = [];
  for (const s of S00_SEGS) c.push(...chunkSegment(s.text, S00_OFF + s.start, S00_OFF + s.end));
  for (const s of S01_SEGS) c.push(...chunkSegment(s.text, S01_OFF + s.start, S01_OFF + s.end));
  return c;
}

const S02_OFF = 2.0, S02B_OFF = 34.522, S03_OFF = 66.431; // OBS-measured: S02 voice starts 2s into slice2; S02B "Watch Alex" at output t=36.522 → off=34.522; S03_OFF measured Whisper
const S02_SEGS = [
  { start:  0.00, end:  2.86, text: "Before I walk over, look at what I'm not doing." },
  { start:  3.28, end:  4.74, text: "I'm not rehearsing a line." },
  { start:  5.20, end:  6.90, text: "I'm not waiting for the perfect moment." },
  { start:  7.40, end:  9.50, text: "I'm not asking myself if she'll like me." },
  { start:  9.88, end: 10.96, text: "I'm just looking at her." },
  { start: 11.32, end: 12.14, text: "Actually looking." },
  { start: 12.62, end: 14.26, text: "Finding something real to say." },
  { start: 14.62, end: 15.24, text: "That's it." },
  { start: 15.60, end: 16.86, text: "That's the whole preparation." },
  { start: 17.42, end: 20.76, text: "Most guys stand there frozen, planning the perfect opener." },
  { start: 21.18, end: 23.76, text: "And by the time they're ready, the moment is gone." },
  { start: 24.18, end: 25.32, text: "They killed it themselves." },
  { start: 25.92, end: 27.44, text: "You don't need the perfect line." },
  { start: 27.44, end: 30.22, text: "You need one real thing you actually noticed." },
  { start: 30.60, end: 31.50, text: "I've got mine." },
  { start: 31.88, end: 32.26, text: "Watch." },
];
const S02B_SEGS = [
  { start:  0.00, end:  1.22, text: "Watch Alex for a second." },
  { start:  1.74, end:  3.08, text: "He doesn't walk straight over." },
  { start:  3.56, end:  4.40, text: "He takes a moment." },
  { start:  5.04, end:  5.78, text: "He looks at her." },
  { start:  6.22, end:  7.02, text: "What is she doing?" },
  { start:  7.46, end:  8.06, text: "She's writing." },
  { start:  8.58, end:  8.96, text: "Focused." },
  { start:  9.54, end: 10.48, text: "Not looking around." },
  { start: 10.78, end: 11.78, text: "Not waiting for anyone." },
  { start: 12.18, end: 13.24, text: "She's in her own world." },
  { start: 13.90, end: 15.18, text: "He notices the notepad." },
  { start: 15.64, end: 17.64, text: "He notices she's completely at ease alone." },
  { start: 18.08, end: 19.16, text: "Two things just happened." },
  { start: 19.62, end: 20.48, text: "He found his opener." },
  { start: 20.96, end: 21.76, text: "Something specific." },
  { start: 22.16, end: 22.82, text: "Something real." },
  { start: 22.82, end: 24.30, text: "And he read her energy." },
  { start: 24.70, end: 25.72, text: "She's not hostile." },
  { start: 26.10, end: 26.84, text: "Just absorbed." },
  { start: 27.32, end: 28.98, text: "That's all the preparation he needs." },
  { start: 28.98, end: 30.04, text: "Now watch." },
];
// Exchange: voice-tagged for colour routing
const S03_CLEAN = [
  { t:  0.000, end:  2.210, text: "Hey, sorry one second.",                      voice: 'alex'  },
  { t:  2.260, end:  5.370, text: "That hairstyle — where do you get it done?",  voice: 'alex'  },
  { t:  5.420, end:  8.990, text: "No seriously, it's actually really good.",     voice: 'alex'  },
  { t:  9.040, end: 11.710, text: "Oh, thank you.",                               voice: 'sofia' },
  { t: 11.760, end: 15.090, text: "Just my usual place, nothing special.",        voice: 'sofia' },
  { t: 15.140, end: 18.450, text: "Nothing special. It looks incredible though.", voice: 'alex'  },
  { t: 18.500, end: 20.830, text: "I'm Alex by the way.",                         voice: 'alex'  },
  { t: 20.880, end: 22.800, text: "Sophia, nice to meet you.",                    voice: 'sofia' },
];
function buildSlice2Captions() {
  const c = [];
  for (const s of S02_SEGS)  c.push(...chunkSegment(s.text, S02_OFF  + s.start, S02_OFF  + s.end));
  for (const s of S02B_SEGS) c.push(...chunkSegment(s.text, S02B_OFF + s.start, S02B_OFF + s.end));
  for (const f of S03_CLEAN) { for (const ch of chunkSegment(f.text, S03_OFF + f.t, S03_OFF + f.end, 6)) c.push({ ...ch, voice: f.voice }); }
  return c;
}

const S04_OFF = 0, S05_OFF = 50.80; // measured: OBS t=244.76 ("So what are you writing?") - slice3_obsStart 193.96
const S04_SEGS = [
  { start:  0.00, end:  5.94, text: "Stop. Did you see what just happened?" },
  { start:  5.94, end: 12.56, text: "He didn't say you're beautiful. He didn't say you have nice eyes." },
  { start: 12.56, end: 18.82, text: "He found one specific thing — her hairstyle — and said something real about it." },
  { start: 18.82, end: 26.14, text: "That's Step 1, the observation opener. Don't compliment her looks. Find one specific thing you actually noticed." },
  { start: 26.14, end: 32.62, text: "Could be her hairstyle, her outfit, a bracelet, her accent, her style — anything real." },
  { start: 32.62, end: 39.32, text: "Lines you can use right now: \"Excuse me, that jacket is amazing. Where did you get it?\" Or: \"Let me guess where you're from.\"" },
  { start: 39.32, end: 48.22, text: "Simple. Specific. Real. She feels noticed — not hit on. That's the difference." },
  { start: 48.64, end: 49.44, text: "Step 1. Done. Let's keep going." },
];
const S05_CLEAN = [
  { t:  0.000, end:  2.090, text: "So what are you writing?",                                    voice: 'alex'  },
  { t:  2.140, end:  5.230, text: "Just thoughts. Nothing interesting.",                         voice: 'sofia' },
  { t:  5.280, end: 10.370, text: "People who say nothing interesting are always writing something very interesting.", voice: 'alex' },
  { t: 10.420, end: 12.910, text: "Or maybe it really is nothing.",                              voice: 'alex'  },
  { t: 12.960, end: 16.230, text: "You're very good at keeping secrets.",                        voice: 'alex'  },
  { t: 16.280, end: 17.530, text: "Maybe.",                                                       voice: 'sofia' },
  { t: 17.580, end: 18.980, text: "I like that actually.",                                        voice: 'alex'  },
];
function buildSlice3Captions() {
  const c = [];
  for (const s of S04_SEGS) c.push(...chunkSegment(s.text, S04_OFF + s.start, S04_OFF + s.end));
  for (const f of S05_CLEAN) { for (const ch of chunkSegment(f.text, S05_OFF + f.t, S05_OFF + f.end, 6)) c.push({ ...ch, voice: f.voice }); }
  return c;
}

// ── Caption data for slices 4-8 (from Groq Whisper of OBS audio starting at t=247.698s)
// All times are relative to each slice's obsStart; segment ids in comments match Whisper segments.

// Slice 4: Step 2 — Playful Challenge (s06) + Job exchange (s07)
// S06 = [transcript 16.08–71.80] → slice relative [0–55.72]
// S07 = [transcript 73.22–91.28] → slice relative [57.14–75.20]
const S06_OFF = 0;
const S07_OFF = 57.14;
const S06_SEGS = [
  { start:  0.00, end:  2.44, text: "Did you feel the difference?" },
  { start:  3.04, end:  7.58, text: "The conversation just changed. It's not two strangers being polite anymore." },
  { start:  7.58, end: 11.50, text: "There's something happening. That's what playful challenge does." },
  { start: 11.50, end: 17.16, text: "Alex didn't agree with everything she said. He pushed back, lightly, without being mean." },
  { start: 17.16, end: 20.26, text: "That's step 2. Don't go along with everything." },
  { start: 20.26, end: 23.74, text: "When she says something, don't just nod. React." },
  { start: 23.74, end: 27.54, text: "Challenge it a little. Stay curious. Examples:" },
  { start: 27.54, end: 33.82, text: "She says: \"I don't really talk to strangers.\" You say: \"That's funny — you seem like exactly the kind of person who would.\"" },
  { start: 33.82, end: 38.72, text: "She says: \"I'm not that interesting.\" You say: \"People who say that are always the most interesting.\"" },
  { start: 38.72, end: 46.06, text: "But here's the important part. Once she's laughing, once she's engaged, you stop. You don't keep pushing." },
  { start: 46.64, end: 50.78, text: "Teasing too much makes you predictable. You become the guy trying too hard to be funny." },
  { start: 51.36, end: 53.46, text: "Light the fuse, then let it burn." },
  { start: 54.46, end: 55.72, text: "Step 2. Done." },
];
// S07 exchange — Sofia asks; Alex deflects; Sofia pushes; Alex redirects; Alex proposes coffee
const S07_CLEAN = [
  { t: 57.14, end: 58.04, text: "So what do you do?",                                       voice: 'sofia' },
  { t: 59.20, end: 62.64, text: "Something I never explain on a beach. It kills the mood.", voice: 'alex'  },
  { t: 64.32, end: 65.24, text: "That's convenient.",                                        voice: 'sofia' },
  { t: 66.16, end: 67.78, text: "It really is. What about you?",                            voice: 'alex'  },
  { t: 68.90, end: 70.20, text: "I asked first.",                                            voice: 'sofia' },
  { t: 70.60, end: 73.34, text: "Okay, I'll tell you over coffee. Deal?",                   voice: 'alex'  },
  { t: 74.60, end: 75.20, text: "Maybe.",                                                    voice: 'sofia' },
];
function buildSlice4Captions() {
  const c = [];
  for (const s of S06_SEGS) c.push(...chunkSegment(s.text, S06_OFF + s.start, S06_OFF + s.end));
  for (const f of S07_CLEAN) c.push({ start: f.t, end: f.end, text: f.text, voice: f.voice });
  return c;
}

// Slice 5: Step 3 — Own Your Mystery (s08) + Noticing exchange (s09)
// S08 = [transcript 92.38–153.73] → slice relative [0–61.35]
// S09 = [transcript 155.47–176.17] → slice relative [63.09–83.79]
const S08_OFF = 0;
const S09_OFF = 63.09;
const S08_SEGS = [
  { start:  0.00, end:  9.80, text: "She asked about his job. Simple question. Most guys answer immediately — full job title, company name, how long they've been there, everything." },
  { start: 10.42, end: 21.08, text: "And the moment they do that, something dies. Not because the job is bad. Because of what that answer says about them. It says: I need you to approve of me. Alex didn't do that." },
  { start: 21.08, end: 28.14, text: "He deflected, lightly, with a smile, and flipped it back on her. That's step three, own your mystery." },
  { start: 28.62, end: 37.72, text: "Don't give everything away the moment she asks. Answer in a way that shows you're comfortable, and leaves her wanting to know more. Try this. She asks where you work." },
  { start: 38.00, end: 43.12, text: "You say: \"Somewhere that lets me be here on a Tuesday afternoon. That's all you need to know for now.\"" },
  { start: 43.12, end: 47.62, text: "She asks if you have a girlfriend. You say: \"That's a very specific question for someone I just met.\"" },
  { start: 47.62, end: 50.41, text: "She asks how old you are. You say: \"Guess.\"" },
  { start: 50.67, end: 56.09, text: "You're not lying. You're not being rude. You're just not auditioning." },
  { start: 56.61, end: 59.12, text: "Step 3. Done." },
];
// S09 exchange — Alex notices Sofia; Sofia responds; Alex validates; Sofia compliments; Alex spikes
const S09_CLEAN = [
  { t: 59.12, end: 61.35, text: "You know what I noticed about you from over there?",                                     voice: 'alex'  },
  { t: 63.09, end: 63.62, text: "What?",                                                                                  voice: 'sofia' },
  { t: 63.62, end: 70.00, text: "You looked completely fine being alone. Not waiting for anyone. Not checking your phone. Just present.", voice: 'alex' },
  { t: 70.62, end: 72.12, text: "Is that a bad thing?",                                                                   voice: 'sofia' },
  { t: 72.62, end: 76.37, text: "No, it's rare. Most people can't do that.",                                              voice: 'alex'  },
  { t: 77.37, end: 79.12, text: "You're very observant.",                                                                 voice: 'sofia' },
  { t: 79.62, end: 81.62, text: "Only when something's worth observing.",                                                 voice: 'alex'  },
  { t: 83.12, end: 83.79, text: "Okay.",                                                                                  voice: 'sofia' },
];
function buildSlice5Captions() {
  const c = [];
  for (const s of S08_SEGS) c.push(...chunkSegment(s.text, S08_OFF + s.start, S08_OFF + s.end));
  for (const f of S09_CLEAN) c.push({ start: f.t, end: f.end, text: f.text, voice: f.voice });
  return c;
}

// Slice 6: Step 4 — Verbal Spike (s10) + Before The Close (s10b) + Close exchange (s11)
// S10  = [transcript 177.59–235.21] → slice relative [0–57.62]
// S10B = [transcript 236.45–261.37] → slice relative [58.86–83.78]
// S11  = [transcript 261.37–293.32] → slice relative [83.78–115.73]
const S10_OFF  = 0;
const S10B_OFF = 58.86;
const S11_OFF  = 83.78;
const S10_SEGS = [
  { start:  0.00, end: 11.76, text: "Notice what Alex just did. He didn't say I like you. He didn't say you're beautiful. He said something that meant both of those things without saying either. That's the verbal spike." },
  { start: 11.76, end: 23.28, text: "Women don't respond to what you say. They respond to what you mean, and they feel the difference immediately. When you say you're beautiful, she hears it, files it away, moves on. She's heard it a hundred times today." },
  { start: 23.28, end: 35.16, text: "But when you say something that implies it, something specific, something that shows you actually paid attention, she feels it. That's different. Try this. Instead of \"I think you're amazing,\" say \"I don't usually stop what I'm doing for anyone, just so you know.\"" },
  { start: 40.96, end: 50.28, text: "Instead of \"I like talking to you,\" say \"This is the most interesting conversation I've had all week, and I wasn't expecting that.\" You're not announcing your feelings. You're letting her feel them." },
  { start: 50.70, end: 57.62, text: "That gap between what you say and what you mean — that's where attraction lives. Step 4. Done." },
];
const S10B_SEGS = [
  { start: 58.86, end: 64.74, text: "Watch what happens now. Alex has been in this conversation for 20 minutes. He's built something." },
  { start: 65.22, end: 75.44, text: "She's engaged. She's interested. Most guys at this point start hinting. They drop signals and hope she figures it out. They ask in a way that sounds like an apology." },
  { start: 75.44, end: 79.98, text: "Alex doesn't do that. Watch how he asks. Watch his tone." },
  { start: 79.98, end: 83.78, text: "Watch what he doesn't say. This is step five." },
];
// S11 exchange — Alex leads; Sofia tests; Alex holds frame; Alex closes directly; Sofia accepts
const S11_CLEAN = [
  { t:  83.78, end:  90.70, text: "I have to be honest. I didn't plan to spend 20 minutes talking to someone on a beach today.", voice: 'alex'  },
  { t:  90.70, end:  92.41, text: "Is that a complaint?",                                                                        voice: 'sofia' },
  { t:  92.41, end:  94.41, text: "No. Opposite actually.",                                                                      voice: 'alex'  },
  { t:  94.41, end: 100.41, text: "Look, I'd like to continue this somewhere that isn't a beach. Coffee, a drink, whatever works.", voice: 'alex' },
  { t: 100.41, end: 102.55, text: "Yeah. I like that.",                                                                          voice: 'sofia' },
  { t: 103.27, end: 104.61, text: "Good. Give me your number.",                                                                  voice: 'alex'  },
  { t: 106.09, end: 110.41, text: "Oh. You're a strange one. A little too direct, aren't you?",                                  voice: 'sofia' },
  { t: 111.17, end: 113.63, text: "You seem like someone who appreciates that.",                                                  voice: 'alex'  },
  { t: 114.69, end: 115.73, text: "Maybe I do.",                                                                                  voice: 'sofia' },
];
function buildSlice6Captions() {
  const c = [];
  for (const s of S10_SEGS)  c.push(...chunkSegment(s.text, S10_OFF  + s.start, S10_OFF  + s.end));
  for (const s of S10B_SEGS) c.push(...chunkSegment(s.text, s.start, s.end));
  for (const f of S11_CLEAN)  c.push({ start: f.t, end: f.end, text: f.text, voice: f.voice });
  return c;
}

// Slice 7: Step 5 — The Natural Close recap (s12, all Ryan gold)
// S12 = [transcript 293.32–340.08] → slice relative [0–46.76]
const S12_SEGS = [
  { start:  0.00, end:  7.02, text: "Stop. Did you see what just happened? Alex didn't hint. He didn't say maybe we could hang out sometime." },
  { start:  7.02, end: 13.80, text: "He didn't apologize for asking. He said exactly what he wanted. Directly. Lightly. No pressure." },
  { start: 13.80, end: 26.42, text: "And she said yes. That's step 5. The direct, comfortable close. Here are 3 ways you can say it. Pick the one that feels natural. 1. I'd love to grab a coffee. Are you up for it?" },
  { start: 26.42, end: 31.50, text: "2. Look, I have to go, but I'd like to see you again. You free this week?" },
  { start: 31.86, end: 35.44, text: "3. Give me your number. Let's do this again somewhere better." },
  { start: 35.82, end: 41.16, text: "All three work. All three are direct. All three leave her room to say yes without pressure." },
  { start: 41.58, end: 44.94, text: "The close is not a moment you survive. It's a moment you lead." },
  { start: 45.42, end: 46.76, text: "Step 5. Done." },
];
function buildSlice7Captions() {
  const c = [];
  for (const s of S12_SEGS) c.push(...chunkSegment(s.text, s.start, s.end));
  return c;
}

// Slice 8: Full 5-step summary + mnemonic + call to action (s13, all Ryan gold)
// S13 = [transcript 341.56–427.94] → slice relative [0–86.38]
const S13_SEGS = [
  { start:  0.00, end:  6.40, text: "That's the full approach. Let me give you the five steps one more time. Step 1. The Observation Opener." },
  { start:  6.40, end: 17.70, text: "Don't compliment her looks. Find one specific thing you actually noticed, and say something real about it. Step 2. Playful challenge. Don't agree with everything. Push back lightly." },
  { start: 18.20, end: 29.28, text: "Create some friction. Then stop once she's engaged. Step 3. Own your mystery. Don't give everything away the moment she asks. Stay comfortable. Leave her wanting to know more." },
  { start: 29.76, end: 43.38, text: "Step 4. The verbal spike. Don't announce your interest. Make her feel it through what you imply, not what you state. Step 5. The natural close. Direct. Light. No pressure. No apology. Lead the moment." },
  { start: 43.38, end: 57.62, text: "Now here's how you remember all 5. Tequila makes ideas click. Observe something specific. Tease playfully. Mystery — don't give everything away. Ideas — imply your interest." },
  { start: 57.94, end: 64.60, text: "Click — close naturally. Say it once. You'll never forget it." },
  { start: 64.60, end: 77.26, text: "Now here's the thing. The women are waiting for you right now. Different faces, different personalities, different energies. Some will be warm. Some will test you. Some will push back hard." },
  { start: 77.26, end: 84.98, text: "You don't get better by watching. You get better by doing. Go. Try it. Fail. Learn. Try again." },
  { start: 85.40, end: 86.38, text: "That's how this works." },
];
function buildSlice8Captions() {
  const c = [];
  for (const s of S13_SEGS) c.push(...chunkSegment(s.text, s.start, s.end));
  return c;
}

// ── ASS helpers
function assTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = Math.floor(s % 60);
  const cs = Math.round((s % 1) * 100);
  return `${h}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}

// Colour reference (ASS = &H00BBGGRR):
//   Ryan gold    #D9A054 → &H0054A0D9
//   Alex cyan    #00E5FF → &H00FFE500
//   Sofia pink   #FF7EB9 → &H00B97EFF
const ASS_HEADER = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial Black,86,&H0054A0D9,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,1,8,80,80,1167,1
Style: AlexCaption,Arial Black,86,&H00FFE500,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,1,8,80,80,1167,1
Style: SofiaCaption,Arial Black,86,&H00B97EFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,1,8,80,80,1167,1
Style: Badge,Arial Black,40,&H00FFFFFF,&H000000FF,&H00000000,&H44000000,-1,0,0,0,100,100,0,0,3,12,0,9,20,20,40,1
Style: HookText,Arial Black,86,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,2,5,80,80,0,1
Style: OutroTag,Arial,46,&H00C8A0A0,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,5,80,80,0,1
Style: OutroUrl,Arial Black,70,&H0054A0D9,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,1,5,80,80,0,1
Style: OutroSub,Arial,38,&H00888888,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,5,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

function voiceToStyle(v) {
  if (v === 'alex')  return 'AlexCaption';
  if (v === 'sofia') return 'SofiaCaption';
  return 'Caption';
}

// Lesson captions + persistent badge (runs full slice duration)
function buildCaptionASS(captions, badge, dur) {
  const lines = [`Dialogue: 0,${assTime(0)},${assTime(dur)},Badge,,0,0,0,,${badge}`];
  for (const c of captions) {
    lines.push(`Dialogue: 0,${assTime(c.start)},${assTime(c.end)},${voiceToStyle(c.voice)},, 0,0,0,,${c.text}`);
  }
  return ASS_HEADER + '\n' + lines.join('\n');
}

// 2-second hook card: badge + punchy hook line
function buildHookASS(hookLine, badge) {
  return ASS_HEADER + '\n' +
    `Dialogue: 0,${assTime(0)},${assTime(2)},Badge,,0,0,0,,${badge}\n` +
    `Dialogue: 0,${assTime(0.25)},${assTime(1.75)},HookText,,0,0,0,,${hookLine}`;
}

function buildOutroASS() {
  return ASS_HEADER + '\n' +
    'Dialogue: 0,0:00:00.20,0:00:04.00,OutroTag,,0,0,0,,{\\pos(540,830)}Want to try this yourself?\n' +
    'Dialogue: 0,0:00:00.50,0:00:04.00,OutroUrl,,0,0,0,,{\\pos(540,960)}eklipses.com\n' +
    'Dialogue: 0,0:00:01.00,0:00:04.00,OutroSub,,0,0,0,,{\\pos(540,1090)}2 free sessions \u00B7 no card required';
}

function ffmpeg(args, label) {
  console.log(`  [ffmpeg] ${label}`);
  execSync(`ffmpeg -y ${args}`, { stdio: ['pipe', 'pipe', 'inherit'], cwd: TMP });
}

// ── Main
(async () => {
  console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 PROCESS OBS \u2192 8 SLICES v4 \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('  Approach: portrait crop 390\xD7693 at x=445 (Ryan orb + Sofia face fully visible)');
  console.log('  Colors: Ryan=gold  Alex=cyan  Sofia=pink');
  console.log('  Badge: 40pt dark-chip corner');
  console.log('  Hook: 2s silent card prepended per slice\n');

  const captionSets = [
    buildSlice1Captions(), buildSlice2Captions(), buildSlice3Captions(),
    buildSlice4Captions(), buildSlice5Captions(), buildSlice6Captions(),
    buildSlice7Captions(), buildSlice8Captions(),
  ];
  captionSets.forEach((c, i) => {
    const alex  = c.filter(x => x.voice === 'alex').length;
    const sofia = c.filter(x => x.voice === 'sofia').length;
    const ryan  = c.filter(x => !x.voice).length;
    console.log(`  Slice ${i+1}: ${c.length} entries \u2014 Ryan(gold)=${ryan}  Alex(cyan)=${alex}  Sofia(pink)=${sofia}`);
  });

  console.log('\nWriting ASS files...');
  fs.writeFileSync(path.join(TMP, 'outro.ass'), buildOutroASS(), 'utf8');

  for (let i = 0; i < SLICES.length; i++) {
    const slice = SLICES[i];
    const badge = `LESSON 1 \u00B7 PART ${i+1}/8`;
    fs.writeFileSync(path.join(TMP, `slice${i+1}.ass`), buildCaptionASS(captionSets[i], badge, slice.dur), 'utf8');
    fs.writeFileSync(path.join(TMP, `hook${i+1}.ass`),  buildHookASS(slice.hook, badge), 'utf8');
    console.log(`  \u2713 slice${i+1}.ass + hook${i+1}.ass  badge="${badge}"`);
  }

  console.log('\nRendering slices...');
  console.log('  Frame layout: crop 390\xD7693 at x=445,y=18 \u2192 scale 1080\xD71920');
  console.log('  drawbox masks UI chrome at output y=1110-1920  (below Sofia photo)\n');

  for (const slice of SLICES.filter(s => s.num <= 3)) {
    const { num, label, obsStart, dur, hook } = slice;
    const tag        = String(num).padStart(2, '0');
    const captionAss = `slice${num}.ass`;
    const hookAss    = `hook${num}.ass`;
    const outFile    = path.join(OUT, `lesson1-slice${tag}-of08.mp4`).replace(/\\/g, '/');

    console.log(`\nSlice ${num}: ${label}`);
    console.log(`  OBS in: t=${obsStart.toFixed(3)}s  dur=${dur.toFixed(3)}s`);
    console.log(`  Hook: "${hook.replace('\\N', ' / ')}"`);

    // Filter layout:
    //   [0] OBS recording (video+audio)
    //   [1] lavfi dark outro (4s)
    //   [2] lavfi dark hook card (2s)
    //
    // Video pipeline:
    //   crop=299:532:445:18  — portrait window: x=445 gives 3px left of Ryan orb
    //   scale=1080:1920      — fill full portrait via lanczos
    //   setsar=1             — fix SAR so concat doesn't complain
    //   fps=30               — normalise framerate
    //   ass=captionAss       — burn captions+badge
    //
    //   hook card: solid dark 1080×1920 + hook text + badge from hook ASS
    //   outro card: solid dark 1080×1920 + outro text
    //   concat: hook(2s) + lesson(dur) + outro(4s)
    //
    // Audio:
    //   concat: silence(2s) + OBS lesson audio(dur) + silence(4s)

    const d   = dur.toFixed(3);
    const FC  = [
      `[0:v]trim=duration=${d},setpts=PTS-STARTPTS,crop=390:693:445:18,scale=1080:1920:flags=lanczos,setsar=1,fps=30,drawbox=x=0:y=1110:w=1080:h=810:c=0x15171C@1:t=fill,ass='${captionAss}'[lesson]`,
      `[2:v]fps=30,ass='${hookAss}'[hook]`,
      `[1:v]fps=30,ass='outro.ass'[outro]`,
      `[hook][lesson][outro]concat=n=3:v=1:a=0[outv]`,
      `aevalsrc=0:d=2[hook_sil]`,
      `[0:a]atrim=duration=${d},asetpts=PTS-STARTPTS[lsn_a]`,
      `aevalsrc=0:d=4[outro_sil]`,
      `[hook_sil][lsn_a][outro_sil]concat=n=3:v=0:a=1[outa]`,
    ].join(';');

    ffmpeg(
      `-ss ${obsStart.toFixed(3)} -i "${OBS}" ` +
      `-f lavfi -i "color=c=0x15171C:s=1080x1920:r=30:d=4" ` +
      `-f lavfi -i "color=c=0x15171C:s=1080x1920:r=30:d=2" ` +
      `-filter_complex "${FC}" ` +
      `-map "[outv]" -map "[outa]" ` +
      `-c:v libx264 -crf 18 -preset fast ` +
      `-c:a aac -b:a 192k ` +
      `-movflags +faststart ` +
      `"${outFile}"`,
      `Slice ${num}`
    );

    const mb = (fs.statSync(outFile.replace(/\//g, path.sep)).size / 1e6).toFixed(1);
    console.log(`  \u2713 lesson1-slice${tag}-of08.mp4  (${mb} MB)`);
  }

  // ── Frame extraction for visual verification
  console.log('\nExtracting verification frames...');
  const VF = path.join(TMP, 'verify');
  fs.mkdirSync(VF, { recursive: true });

  // Timestamp math (all = 2s hook + lesson offset):
  //   Slice 2 exchange S03: Alex "Hey" t=S03_OFF(66.431)+0→output 68.4s
  //                         Sofia t=S03_OFF+6.504→output 74.9s
  //   Slice 3 exchange S05: Alex t=S05_OFF(50.80)+0→output 52.8s
  //                         Sofia t=S05_OFF+12.37→output 65.2s
  //   Slice 4 exchange S07: Sofia t=57.14s→output 59.1s, Alex t=59.2s→output 61.2s
  //   Slice 5 exchange S09: Alex t=59.12s→output 61.1s, Sofia t=77.37s→output 79.4s
  //   Slice 6 exchange S11: Sofia "complaint?" t=90.7s→output 92.7s
  //                         Sofia "Maybe I do." t=114.7s→output 116.7s
  const checks = [
    // [slice_file, offset_into_output, label]
    ['lesson1-slice01-of08.mp4',  0.5, 's1_hook'],
    ['lesson1-slice01-of08.mp4', 25.0, 's1_ryan_gold'],   // S00 mid-narration
    // S01 narration sync check: S01_OFF=DUR.s00+0.56 → output t=2+43.61=45.61s
    ['lesson1-slice01-of08.mp4', 45.6, 's1_narr_s01_start'],  // should show "You've probably seen"
    // Slice 2 narration sync checks: S02_OFF=2.0 → output t=4s; S02B_OFF=34.522 → output t=36.5s
    ['lesson1-slice02-of08.mp4',  0.5, 's2_hook'],
    ['lesson1-slice02-of08.mp4',  4.1, 's2_narr_s02_start'],  // should show "Before I walk over"
    ['lesson1-slice02-of08.mp4', 36.5, 's2_narr_s02b_start'], // should show "Watch Alex for a second."
    // Slice 2 S03 exchange — start/mid/sofia/end:  hook(2s) + S03_OFF(66.431) + t
    ['lesson1-slice02-of08.mp4', 68.5, 's2_s03_start'],   // "Hey, sorry" t=0.000 → output 68.4s
    ['lesson1-slice02-of08.mp4', 74.0, 's2_s03_mid'],     // "No seriously" t=5.420 → output 73.9s
    ['lesson1-slice02-of08.mp4', 78.0, 's2_s03_sofia'],   // "Oh, thank you" t=9.040 → output 77.5s
    ['lesson1-slice02-of08.mp4', 87.0, 's2_s03_end'],     // "I'm Alex" t=18.500 → output 86.9s
    // Slice 3 S05 exchange — start/mid/late/end:  hook(2s) + S05_OFF(50.80) + t
    ['lesson1-slice03-of08.mp4',  0.5, 's3_hook'],
    ['lesson1-slice03-of08.mp4', 17.0, 's3_ryan_gold'],   // S04 mid-narration
    ['lesson1-slice03-of08.mp4', 52.9, 's3_s05_start'],   // "So what" t=0.000 → output 52.8s
    ['lesson1-slice03-of08.mp4', 58.2, 's3_s05_mid'],     // "People who say" chunked → first chunk
    ['lesson1-slice03-of08.mp4', 65.8, 's3_s05_late'],    // "You're very good" t=12.960 → output 65.8s
    ['lesson1-slice03-of08.mp4', 69.1, 's3_s05_end'],     // "Maybe." t=16.280 → output 69.1s
    // Slices 4-8 skipped (not rendered in this run)
  ];

  for (const [file, t, label] of checks) {
    const src  = path.join(OUT, file).replace(/\\/g, '/');
    const dest = path.join(VF, `${label}.jpg`).replace(/\\/g, '/');
    execSync(`ffmpeg -y -ss ${t} -i "${src}" -vframes 1 "${dest}"`,
      { stdio: 'pipe', cwd: VF });
    const kb = Math.round(fs.statSync(dest.replace(/\//g, path.sep)).size / 1024);
    console.log(`  \u2713 ${label}.jpg  (t=${t}s, ${kb}KB)`);
  }

  console.log(`\nVerification frames in: ${VF}`);
  console.log('\nDone. Rendered slices 1-3:');
  for (const s of SLICES.filter(x => x.num <= 3)) {
    const tag = String(s.num).padStart(2,'0');
    const f   = path.join(OUT, `lesson1-slice${tag}-of08.mp4`);
    console.log(`  ${f}  (${(fs.statSync(f).size/1e6).toFixed(1)} MB)`);
  }
})().catch(e => { console.error('\n\u2717 Fatal:', e.message); process.exit(1); });
