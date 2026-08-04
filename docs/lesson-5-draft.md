# EKLIPSES — LESSON 5 DRAFT
## "The Read" — Interest Signal Reading
**TRACE mnemonic — LOCKED | Style: The Dark Needle | Status: Fully scripted — pending review before audio**

> **Status:** Mnemonic finalized. Full scenario dialogue, key-phrase library, drill reps, and pedagogical overlays scripted. Ready for review; do not begin audio generation until approved.

---

## DECISIONS LOCKED

**Mnemonic:** TRACE (confirmed)
| Letter | Word | One-sentence expansion |
|--------|------|------------------------|
| T | Track gaze | Notice duration and pattern — sustained eye contact beyond conversational need, the look-away-look-back cycle, holding on yours during a pause. |
| R | Register proximity | Has she moved closer than the space or social context requires? Voluntary range reduction is one of the strongest documented signals of interest. |
| A | Attend to alignment | Does her body echo yours — posture, lean, pace — without any deliberate reason? Behavioral mirroring only operates toward people we're drawn to. |
| C | Catch touch initiation | Any contact she made that she didn't have to — arm, knee, shoulder. Brief, deliberate. These are almost never accidental. |
| E | Enter once you see the cluster | Three or more of the above in a twenty-minute window is a confirmed read. One direct, unhurried move: close the distance, ask for the number, suggest continuing somewhere else. |

**Core skill:** Interest signal reading — not cold reading of personality. The skill teaches recognition of behaviorally documented attraction signals (Moore 1985, Grammer et al. 1996, Chartrand & Bargh 1999, Kellerman et al. 1989). Students learn to detect a *cluster* of signals, not a single event.

**Character:** Sofia — teaching demonstration character across all five lessons. Slow-warming energy means her signals build gradually, demonstrating that the skill requires trained attention rather than obvious display.

**Setting:** Bookstore (`bookstore_bg.jpg` — confirmed to exist from prior draft notes). Quieter environment makes proximity shifts more meaningful; observable browsing behavior gives Ryan visual material to narrate.

**Structure:** 10 segments. 6 Ryan coaching segments (00, 01, 03, 05, 07, 09), 4 exchange segments (02, 04, 06, 08). Matches L4.

---

## WHY THIS TOPIC

**Rationale for Lesson 5 as capstone:**

After four lessons, a student can start a conversation (L1), hold ground under pressure (L2), pace himself when things go well (L3), and sustain a conversation indefinitely through threading (L4). The remaining gap: he cannot tell whether the conversation is actually going anywhere. Most men resolve this badly — either advancing too early on social courtesy mistaken for interest, or failing to advance at all on genuine interest because they cannot read it. Lesson 5 closes the arc.

| Lesson | Skill | What it handles |
|--------|-------|-----------------|
| 1 — The Approach | OTIMC | Starting the conversation; the initial close |
| 2 — Holding Your Ground | FRAME | Adversity, tests, social pressure |
| 3 — The Long Game | PACE | Not self-sabotaging when things are going well |
| 4 — The Thread | CHAIN | Sustaining conversation through deep listening |
| **5 — The Read** | **TRACE** | **Reading genuine interest vs. social courtesy; knowing when and how to advance** |

Threading (L4) is the prerequisite — you can only read someone you've been actually listening to. The Read is what a CHAIN conversation makes possible.

**Research basis:**

- **Moore (1985)** — "Nonverbal courtship patterns in women: Context and consequences," *Ethology and Sociobiology*, 6(4), 237–247. Catalogued 52 distinct nonverbal courtship behaviors via naturalistic observation across contexts. Key finding: signal *frequency* (not any single signal) predicted male approach success. Women who emitted multiple signals in a short window were almost never rejected when approached; women who emitted few were frequently rejected.

- **Grammer, Kruck, Juette & Eibl-Eibesfeldt (1996)** — "Non-verbal behavior as courtship signals," *Evolution and Human Behavior*, 17(6), 371–390. Men detected female interest signals at barely above chance in real-time interaction, while trained coders identified them reliably from video. The gap is the skill gap this lesson closes.

- **Chartrand & Bargh (1999)** — "The chameleon effect," *Journal of Personality and Social Psychology*, 76(6), 893–910. Unconscious behavioral mirroring operates toward people we feel positively toward, below the threshold of conscious awareness. Bidirectional: it reflects liking and reinforces it.

- **Kellerman, Lewis & Laird (1989)** — "Looking and loving," *Journal of Research in Personality*, 23(2), 145–161. Sustained mutual gaze predicts felt attraction. Extended eye contact without conversational justification is a documented signal distinct from polite attention.

- **Givens (1978)** — "The nonverbal basis of attraction," *Psychiatry*, 41(4), 346–359. Five-phase courtship sequence (attention → recognition → interaction → sexual arousal → resolution); the attention and recognition phases are almost entirely nonverbal and precede any verbal exchange.

---

## KEY-PHRASE LIBRARY

*3 curated lines per skill. These are spoken lines for Alex in practice/lesson context. Tags: opener: true = approach-only (these lines are contextually specific to an opening beat).*

### T — Track gaze

*Lines that respond to or name the gaze pattern without calling it out clumsily:*

- "Don't look away on my account." *(gaze-hold line — universal)*
- "You're doing something with how you look at people. I noticed it from the start." *(names it lightly — universal)*
- *(hold eye contact one beat past where most people would break it — no words needed)* *(non-verbal move — universal)*

### R — Register proximity

*Lines that play with or acknowledge the closed distance:*

- "We started much further apart." *(playful observation — universal)*
- *(lean back slightly, create the space — see if she fills it)* *(non-verbal test — universal)*
- "You moved over here. I noticed." *(direct, not accusatory — universal)*

### A — Attend to alignment

*The chameleon test — these are mostly non-verbal, but naming lines exist:*

- *(shift posture slightly, wait 30–60 seconds, note if she mirrors it)* *(internal test — universal)*
- "You match the pace of whoever you're talking to. That's a specific quality." *(names the mirroring indirectly — universal)*
- *(no line — register the alignment internally, continue the conversation)* *(universal)*

### C — Catch touch initiation

*Lines for after she's made contact:*

- *(sustained eye contact in response — no words)* *(universal)*
- "You did that on purpose." *(certain, light — universal)*
- *(brief reciprocal touch of equal or slightly lesser weight — do not escalate immediately)* *(non-verbal move — universal)*

### E — Enter once you see the cluster

*The bridge-to-action: three or more signals confirmed → one direct move. Statement, not question:*

- "I want to keep talking to you. What's your number." *(universal)*
- "We should continue this somewhere quieter. Come on." *(universal)*
- "I'm going to get another drink. You should come." *(low-pressure inclusion — universal)*

---

## DRILL REPS (coach-moment.js format)

*Lines used in coached practice mode when the user demonstrates TRACE skills. Note: T, R, A, C are observational skills — in the text-based practice format, coaching fires when the user demonstrates awareness of the dynamic (naming it) or when they make the active move (E). Design note: the practice-mode coaching for TRACE should fire primarily on E (the verbal move) and on T/A lines that demonstrate perceptive attention. R and C signals in a text conversation require Sofia to describe her own physical behavior, which the character prompts handle.*

```js
lesson5: {
  T: [
    // universal — demonstrates gaze awareness without clumsiness
    { text: "Don't look away on my account." },
    { text: "You're doing something with how you look at people. I noticed." },
    { text: "I noticed that." }, // intentionally minimal — after a gaze hold
  ],
  R: [
    // universal — registers and responds to proximity shift
    { text: "We started much further apart." },
    { text: "You moved over here. I noticed." },
    { text: "I'm not moving. But you can keep going." }, // playful hold of ground
  ],
  A: [
    // universal — names the mirroring/alignment dynamic
    { text: "You match the pace of whoever you're talking to." },
    { text: "You adjusted without noticing. That's a tell." },
    { text: "You just did what I did. That's interesting." },
  ],
  C: [
    // universal — responds to touch initiation without flinching or over-reacting
    { text: "You did that on purpose." },
    { text: "That wasn't accidental." },
    { text: "I noticed that too." },
  ],
  E: [
    // universal — the direct ask; statement, not question
    { text: "I want to keep talking to you. What's your number." },
    { text: "We should continue this somewhere else. Come on." },
    { text: "I'm going to get another drink. You should come." },
  ],
},
```

---

## PEDAGOGICAL EXPLANATION OVERLAY TEXT

*Two-sentence block per skill. Sentence 1: what she's doing and why. Sentence 2: names the skill plainly. Used in Coached Practice interrupt overlays.*

**T — Track gaze:**
Her eye contact has shifted — it's lasting longer than conversation requires, holding on you during silences and after she finishes speaking. That's a gaze signal: genuine attention has a different duration than polite attention.

**R — Register proximity:**
She's moved closer than the space requires — not because the room is crowded, but because distance felt like too much. Voluntary proximity reduction is one of the most consistently documented attraction signals in the research.

**A — Attend to alignment:**
Her posture has started to echo yours — the lean, the angle, the pace — without any deliberate coordination. Behavioral mirroring happens involuntarily toward people we feel drawn to; she isn't doing it consciously.

**C — Catch touch initiation:**
She just made contact she didn't have to make — a brief touch on your arm or shoulder that released immediately. Deliberate touch initiation is almost never accidental; it's a physical signal that the conversation has crossed into something she wants more of.

**E — Enter once you see the cluster:**
Three or more of these signals in twenty minutes is a confirmed read, not a guess. This is the moment to act: one direct, unhurried move — ask for the number, suggest somewhere else, include her in what you're doing next. Not a question. Not a preamble. A step.

---

## FULL SCRIPTED SEGMENTS

### SEGMENT 00 — LESSON INTRO (Ryan)

**File:** `ryan_seg00.mp3`

"Lesson 5. If you've done the first four, here's where you are. You can start a conversation — the approach, the opener, the close. You can hold your ground when she tests you — the frame, the reframe, the exit. You can pace yourself when things go well — not rushing what needs time. And you can sustain a conversation for as long as it needs to run, going deeper into what she gives you rather than hunting for new material. That's a complete skill set. And yet — conversations still end without going anywhere. The person you were talking to was interested, and you left. Or you moved before there was anything real there, and she pulled back. The thing you were missing in both cases is the same. You couldn't read the difference between someone who's enjoying talking to you and someone who wants more than the talking. That difference isn't vague. It isn't a gut feeling you either have or don't. It is a specific set of behavioral signals — documented, observed in real settings, catalogued in peer-reviewed research. She has been sending them your entire life. You just weren't taught what they look like. This lesson teaches you what they look like. What you're about to learn is TRACE."

---

### SEGMENT 01 — WHY MEN MISS IT (Ryan)

**File:** `ryan_seg01.mp3`

"Here's the research. Monica Moore spent time watching women in real social settings — bars, cafes, bookstores, libraries — and catalogued fifty-two distinct nonverbal behaviors women emit specifically when they're interested. Not when they're being friendly. When they're interested. Things like eye contact that holds two or three beats past where most people look away. Moving closer than the physical space or the conversation required. Posture that starts to echo the person she's talking to without any apparent reason. A brief touch on the arm that wasn't necessary. Laughter that's slightly more frequent than the jokes deserve. These signals are real. They're documented. And they're not random — they cluster. One of these in twenty minutes means nothing. Three from different categories in twenty minutes means something specific. That's the most important finding in Moore's work: signal frequency and variety, not any single signal, predicted whether an approach would succeed. The second piece of research matters as much. Grammer and his team studied whether men could actually detect these signals in real interactions. The answer was barely above chance. Not because men are inattentive. Because no one ever told them what to pay attention to. The gap between what she's emitting and what he's receiving is exactly the gap this lesson closes."

---

### SEGMENT 02 — WATCH: THE MISSED READ (Exchange)

**Setting:** Alex and Sofia mid-conversation in the bookstore. They've been talking for fifteen minutes. Sofia has been moving gradually closer — she's now beside him, looking at the book in his hands. Throughout the conversation she's held his gaze a beat longer than necessary, her posture has started matching his against the shelf, and she touched his forearm briefly while making a point earlier.

**Files:** `sofia_s02_01.mp3` through `sofia_s02_06.mp3`, `alex_s02_01.mp3` through `alex_s02_05.mp3`

```
sofia_s02_01: "...I like how he builds silence into the sentences."
alex_s02_01: "That's a specific thing to notice about a writer."
sofia_s02_02: "I notice specific things." [holds his gaze past the end of the sentence]
alex_s02_02: "What kind of work are you in?"
sofia_s02_03: "...architecture." [she's moved to look at the book in his hands — she's beside him now] "What made you pick that one up?"
alex_s02_03: "It was next to something I was actually looking for."
sofia_s02_04: "That's how you find the good ones." [touches his forearm lightly while saying it, drops the contact]
alex_s02_04: "Yeah, probably." [doesn't register it] "I should make a decision before the shop closes."
sofia_s02_05: "...right." [stays exactly where she is — close, facing him]
alex_s02_05: "Good to talk to you."
sofia_s02_06: "...you too."
```

*Alex leaves. Sofia watches him go.*

---

### SEGMENT 03 — T AND R EXPLAINED (Ryan)

**File:** `ryan_seg03.mp3`

"Let's go back through that. From the moment they were talking, Sofia was sending him signals. He just wasn't reading them. Track gaze first. When she said 'I notice specific things' — she held eye contact for two or three beats past where most people break it. That's not conversational attention. Conversational eye contact follows speech. It breaks when the sentence ends or when the speaker looks away. What she did held after the sentence ended, into the silence after. That's the first signal. Register proximity next. When she asked about the book, she moved. Not because the aisle was crowded. Because distance felt like too much. She put herself beside him — close enough to look at what he was holding — with no conversational justification for closing that space. He stood exactly where he was and answered the question about the book. He didn't register that she had just voluntarily cut the distance between them by more than half. Two signals in the first few minutes of talking. He didn't see either of them. Watch what changes when he does."

---

### SEGMENT 04 — WATCH: CATCHING T AND R (Exchange)

**Setting:** Same scene, reset to the start of their exchange.

**Files:** `sofia_s04_01.mp3` through `sofia_s04_05.mp3`, `alex_s04_01.mp3` through `alex_s04_04.mp3`

```
sofia_s04_01: "...I like how he builds silence into the sentences."
alex_s04_01: "That's a specific thing to notice about a writer."
sofia_s04_02: "I notice specific things." [holds his gaze]
alex_s04_02: [holds the eye contact back — doesn't break it when she does, lets it settle] "What kind of work are you in?"
sofia_s04_03: "...architecture." [moves beside him to look at the book] "What made you pick that one up?"
alex_s04_03: [doesn't move back — registers that she's closed the distance] "It was next to something I was actually looking for."
sofia_s04_04: "That's how you find the good ones."
alex_s04_04: "What are you in here for?"
sofia_s04_05: "...something I've probably already read." [small smile — still beside him, still close]
```

*Two signals tracked. Alex continues the conversation with awareness — T logged, R logged. He doesn't act yet. He's building the picture.*

---

### SEGMENT 05 — A AND C EXPLAINED (Ryan)

**File:** `ryan_seg05.mp3`

"Watch what happens over the next few minutes. Sofia's posture starts to change. When Alex leans back against the shelf, her angle shifts — not all the way, not dramatically. She just moves into the same lean. When he shifts his weight, a minute or so later, she shifts hers. She isn't doing this on purpose. Chartrand and Bargh documented this in a study called the chameleon effect — people unconsciously mirror the posture, pace, and gesture of people they feel positively toward. It operates below the level of conscious awareness. She cannot feel herself doing it. The practical test is simple: change your posture slightly, then wait. If she mirrors it within a minute, that's a signal. Align — attend to alignment. The fourth signal is the touch. When she made a point about the book — she put her hand on his forearm for a half second, then released it. She didn't have to make contact there. Nothing in the conversation required it. She chose to, briefly, and let go. That is not an accident. Accidental contact is pulled back from. Deliberate contact settles into, however briefly, before releasing. Gaze. Proximity. Alignment. Touch. In one fifteen-minute conversation. That is not noise. That is a cluster."

---

### SEGMENT 06 — WATCH: READING THE FULL CLUSTER (Exchange)

**Setting:** Continuing from where SEG 04 left off. Several more minutes have passed.

**Files:** `sofia_s06_01.mp3` through `sofia_s06_03.mp3`, `alex_s06_01.mp3` through `alex_s06_03.mp3`

```
sofia_s06_01: "...it's the kind of decision where if you have to keep asking, you already know the answer." [touches his forearm lightly while making the point, releases]
alex_s06_01: [doesn't pull back — continues, present] "You always know before you ask."
sofia_s06_02: "Usually." [her posture mirrors his lean against the shelf — same angle, same ease]
alex_s06_02: "What made you want to work in architecture in the first place?"
sofia_s06_03: "...I wanted to make things that didn't apologize for existing." [holds his gaze]
alex_s06_03: [a beat of quiet — T checked, R checked, A checked, C checked] "That's a good reason."
```

*He's confirmed the cluster. He continues the conversation — relaxed, unhurried. He doesn't move yet.*

---

### SEGMENT 07 — E EXPLAINED (Ryan)

**File:** `ryan_seg07.mp3`

"That was Enter on the cluster. And notice what it wasn't. It wasn't a setup. It wasn't a speech about how much he'd enjoyed the conversation or how rare it was to meet someone like her. It wasn't a question — 'can I get your number?' — which introduces doubt and transfers the weight of the decision to her. It was one sentence. A statement. Unhurried. Unambiguous. He wasn't nervous because he wasn't guessing. He had tracked the signals, confirmed the cluster, and now he was acting on what was real. The trap most men fall into after reading the signals correctly is continuing to read. They want a sixth signal, or a seventh, or a cleaner moment that will make the move feel more natural than the last one. That moment doesn't arrive. What arrives is her phone buzzing, or someone else joining the conversation, or just the natural end of the scene. The signals don't accumulate forever. There's a window — and it opens when the cluster is confirmed. Once you have three or more signals across different categories inside twenty minutes, that's the window. You enter it. One move. Direct. Unhurried. You don't explain why. You don't apologize for it. You just act on what you know."

---

### SEGMENT 08 — WATCH: THE WINDOW (Exchange)

**Setting:** Continuing from SEG 06 — same conversation, a few exchanges later. The cluster has been confirmed. Now Sofia creates the natural closing moment: she signals she should probably get moving. This is the window. Alex catches it before it closes.

**Files:** `sofia_s08_01.mp3` through `sofia_s08_04.mp3`, `alex_s08_01.mp3` through `alex_s08_03.mp3`

```
sofia_s08_01: "...I should probably go find what I actually came in for." [she shifts slightly — not leaving yet, but the motion is there]
alex_s08_01: "I want to keep talking to you. What's your number."
sofia_s08_02: [stops] "...that was fast."
alex_s08_02: "It wasn't. I've been deciding for a few minutes."
sofia_s08_03: "...okay." [takes his phone, enters the number]
sofia_s08_04: "Done." [hands it back — holds his gaze for a moment]
alex_s08_03: "Good."
```

*No additional words. The moment is easy because the groundwork was already there — he wasn't guessing. And the line "I've been deciding for a few minutes" says everything: he was reading, not reacting.*

---

### SEGMENT 09 — RECAP AND SEND-OFF (Ryan)

**File:** `ryan_seg09.mp3`

"That's TRACE. One more time. T — Track gaze. Sustained eye contact that holds past the end of a sentence, past the end of a silence, past where most people look away. That's not conversational attention. That's a signal. R — Register proximity. She moved closer than the space or the conversation required. That move has a reason. Log it. A — Attend to alignment. Her posture echoes yours without any coordination — the lean, the pace, the angle. The chameleon effect only operates toward people she's drawn to. C — Catch touch initiation. Any contact she made that she didn't have to make. Brief. Deliberate. Not a correction, not an accident. A signal. E — Enter once you see the cluster. Three or more of these in a twenty-minute window is not noise. It's a confirmed read. One direct, unhurried move. Statement, not question. You act on what you know. She has been doing this the whole time — every woman who was interested in you, in every conversation you walked away from wondering. She was leaning closer, holding your eye contact a beat longer than she needed to, laughing more than the joke deserved, touching your arm when she didn't have to. And most men never saw it. Not because they weren't paying attention. Because no one told them what to pay attention to. Now you know. That's the whole lesson. Go practice. She's already in there."

---

## EXCHANGE SEQUENCE MANIFEST

*For record_lesson5.js — maps segment ID to file sequence.*

```js
const EXCHANGE_SEQUENCES = {
  '02': [
    { file: 'sofia_s02_01.mp3', voice: 'sofia' },
    { file: 'alex_s02_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s02_02.mp3', voice: 'sofia' },
    { file: 'alex_s02_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s02_03.mp3', voice: 'sofia' },
    { file: 'alex_s02_03.mp3',  voice: 'alex'  },
    { file: 'sofia_s02_04.mp3', voice: 'sofia' },
    { file: 'alex_s02_04.mp3',  voice: 'alex'  },
    { file: 'sofia_s02_05.mp3', voice: 'sofia' },
    { file: 'alex_s02_05.mp3',  voice: 'alex'  },
    { file: 'sofia_s02_06.mp3', voice: 'sofia' },
  ],
  '04': [
    { file: 'sofia_s04_01.mp3', voice: 'sofia' },
    { file: 'alex_s04_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s04_02.mp3', voice: 'sofia' },
    { file: 'alex_s04_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s04_03.mp3', voice: 'sofia' },
    { file: 'alex_s04_03.mp3',  voice: 'alex'  },
    { file: 'sofia_s04_04.mp3', voice: 'sofia' },
    { file: 'alex_s04_04.mp3',  voice: 'alex'  },
    { file: 'sofia_s04_05.mp3', voice: 'sofia' },
  ],
  '06': [
    { file: 'sofia_s06_01.mp3', voice: 'sofia' },
    { file: 'alex_s06_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s06_02.mp3', voice: 'sofia' },
    { file: 'alex_s06_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s06_03.mp3', voice: 'sofia' },
    { file: 'alex_s06_03.mp3',  voice: 'alex'  },
  ],
  '08': [
    { file: 'sofia_s08_01.mp3', voice: 'sofia' },
    { file: 'alex_s08_01.mp3',  voice: 'alex'  },
    { file: 'sofia_s08_02.mp3', voice: 'sofia' },
    { file: 'alex_s08_02.mp3',  voice: 'alex'  },
    { file: 'sofia_s08_03.mp3', voice: 'sofia' },
    { file: 'sofia_s08_04.mp3', voice: 'sofia' },
    { file: 'alex_s08_03.mp3',  voice: 'alex'  },
  ],
};
```

*SEG 06: 6 files (3 sofia, 3 alex). SEG 08: 7 files (4 sofia, 3 alex). Total exchange files: 11 + 9 + 6 + 7 = 33. Total with Ryan (10): 43 files.*

---

## SEGMENT TITLE LIST (for lesson-player.js SEGMENTS5)

```js
const SEGMENTS5 = [
  { id:'00', title:'Welcome' },
  { id:'01', title:'Why Men Miss It' },
  { id:'02', title:'Watch — The Missed Read' },
  { id:'03', title:'T — Track · R — Register' },
  { id:'04', title:'Watch — Catching T and R' },
  { id:'05', title:'A — Align · C — Catch' },
  { id:'06', title:'Watch — The Full Cluster' },
  { id:'07', title:'E — Enter' },
  { id:'08', title:'Watch — The Window' },
  { id:'09', title:'Your Five Steps' },
];
```

---

## DESIGN NOTE: TRACE IN PRACTICE MODE — IMPLEMENTED

T, R, A, and C are observational skills — the student reads signals *from* Sofia rather than producing them. This has been resolved in the practice-mode injection:

- **Sofia's character prompt (character.js `lesson5TestBlock`)**: Sofia emits physical signals as stage-direction parentheticals woven into her responses. Format: `(You realize you've been holding his gaze a beat longer than the sentence required.)` at the start of the turn, roughly one per 2–3 exchanges. Timing schedule: exchange ~3 (gaze), ~4 (proximity), ~5–6 (alignment), ~7+ (touch). Instructions in character.js handle signal spacing and responses to acknowledgment.
- **Coach-moment (coach-moment.js)**: `lesson5SkillDefs` added. T/R/A/C fire only when the corresponding stage direction appeared in Sofia's most-recent response. E fires on the direct move. Full `lesson5:` BETTER_LINES library added (5 skills × 3 lines = 15 lines).
- **Post-session coaching (coach.js)**: `lesson5Check` + `lesson5Eval` + `LESSON 5 EVALUATION` criteria added. T/R/A/C are scored on signal acknowledgment; signals Sofia never emitted default to PASS so the user isn't penalized for untested skills.

---

## CONTENT ACCURACY NOTES

- **The 52-behavior count** (Moore 1985): accurate to the paper. The lesson cites it through Ryan's narration in SEG 01. Do not inflate or deflate this number in audio.
- **"Barely above chance"** (Grammer 1996): accurate directional description of the finding. Acceptable to use in narration without citing exact accuracy percentages, which varied across conditions.
- **Chameleon effect** (Chartrand & Bargh 1999): the replication record on magnitude is mixed in recent meta-analyses. The directional finding (mirroring reflects and reinforces liking) has held better than specific effect-size claims. Ryan's narration does not make magnitude claims — it describes the mechanism, which is appropriate.
- **"Three or more signals"**: the cluster-of-three threshold is a pedagogical anchor, not a finding from any single study. Moore's data shows frequency predicts outcome; the "three in twenty minutes" framing is a usable teaching frame, not an empirical threshold. Present it in audio as a practical guide, not a research finding.

---

## RECORDING NOTES (for future use — not current phase)

- Same format as Lessons 1–4: one MP3 per segment
- Ryan: Fish Audio voice `44b996214285427697767cb469793647` (sequential)
- Sofia: Fish Audio voice `836513f294d64aec8403226e69268b1b` (sequential)
- Alex: OpenAI tts-1-hd / onyx (parallel)
- File naming: `lesson5_seg00.mp3` … `lesson5_seg09.mp3` for Ryan; `sofia_s02_01.mp3` etc. for exchanges
- Total audio files: 6 Ryan + ~14 Alex + ~17 Sofia ≈ 43 files + manifest
- Store in R2 under `lessons/lesson5/audio/`
- Cloudflare Worker: add `lesson5/` routing branch to `cloudflare-worker/lesson-audio-worker.js` before serving (same pattern as lesson4/ addition)
- lesson-player.js: add SEGMENTS5, LESSONS.lesson5 config, renderLesson5Card() — unlock key `eklipses_lesson5_complete`, prerequisite `eklipses_lesson4_complete`
