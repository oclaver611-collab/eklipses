# Eklipses — Project Status & Vision

*Last updated: July 20, 2026*

---

## 1. What Eklipses Is

Eklipses is an AI conversation practice app. Users practice real, voice-driven conversations with AI video avatars (characters), get scored and coached by an AI coach named Ryan, and learn structured skills through mnemonic-based lessons. Started April/May 2026 as a dating-practice tool; built solo by Serge in evening hours around a full-time day job (technical support, PI System, Montréal).

---

## 2. Current Status (as of tonight)

### Core product — working and verified
- **Lesson 1 — "The Approach" (OTIMC)**: Observe, Tease, Mystery, Imply, Close. Complete, stable, 16-segment audio manifest.
- **Lesson 2 — "Holding Your Ground" (FRAME)**: Feel nothing, Reframe, Add humor, Make her qualify, Exit. Complete, stable, 61 audio files.
- **Voice mode**: fully working — mic input, speech recognition, mode switching between type/voice. (A major bug had voice recognition silently dead in production for an unknown period; found and fixed tonight.)
- **Practice modal**: redesigned to 4 clean options (Latest Lesson / Choose a Lesson / All Lessons / Free Practice) — scales cleanly to 20+ lessons.
- **Warm-up drill**: required on first entry to a lesson, optional after. 5 short reps per lesson, each testing one mnemonic skill, with a library of memorizable "key phrase" lines (not just abstract framework theory) and concrete coaching ("Try: '...'") on misses.
- **Coach scoring (Ryan)**: calibrated to (a) explicitly credit well-executed key-phrase lines, and (b) weight the actual scene outcome (did she agree to something, stay neutral, or reject) — verified consistent across repeated runs, not drifting.
- **Infrastructure**: Stripe billing live server-side ($19.99/mo, 2 free sessions), Cloudflare Worker audio delivery (works around Vercel's 10s timeout for long audio), deploy.bat fixed at the root cause, 45 scenarios across 40 avatars, PostHog analytics.

### Known gaps
- **Only 1 of 40 avatars (Sofia) has skill-test injection.** The other 39 don't evaluate OTIMC/FRAME yet — Lesson 1 and 2 are effectively only "gradeable" with one character.
- **Lesson 3 not started.** Candidate: Push-Pull technique. Own stated MVP bar is "3-5 lessons working cleanly" before any paid marketing.
- **No marketing has started.** Free-tier + Reddit organic growth (r/socialskills, r/dating_advice, r/selfimprovement) planned but not begun.
- **Bigger coaching feature not built yet**: live pause-and-rewind mid-conversation coaching (Ryan pauses at a teachable moment, coaches the literal last line, rewinds to retry it). This is Serge's actual preferred long-term coaching model; the warm-up drill was built first as a faster, lower-risk way to validate that "recall a proven line" beats "generate from scratch," before committing to the bigger build.
- **Polish backlog (not urgent)**: bold captions when characters speak, ambient/environmental sound, cinematic scenario intros, per-avatar certification tiers, multilingual TTS.

---

## 3. Long-Term Vision: Communication Operating System

*(Captured from Serge's own thinking + external research sessions — this is a Phase 2+ direction, not a near-term plan. Current priority remains: finish validating the dating niche, get real paying users, then revisit.)*

**The core insight:** most competitors in this space teach *contexts* ("how to date," "how to interview," "how to negotiate") without teaching the underlying *operating system* those contexts all depend on. Eklipses' avatar + coach + drill engine is context-agnostic — the same architecture that scores a dating conversation can score a job interview or a sales pitch.

**Proposed structure (future, not current):**

```
Operating System (Foundation) — mandatory, Level 1
├── How conversations actually work
├── Never running out of things to say
├── Active listening
├── Asking better/follow-up questions
├── Reading emotions
├── Storytelling
├── Humor
├── Confidence
├── Voice & body language
└── Emotional intelligence

Conversation Styles — Level 2
├── Funny / Warm / Charismatic / Professional / Flirty
└── Storyteller / Leader / Confident / Calm / Empathetic

Specializations (Applications) — Level 3, user chooses
├── Dating
├── Making friends
├── Job interviews
├── Public speaking
├── Sales
├── Networking
├── Leadership
├── Negotiation
├── Customer service
└── Conflict resolution
```

**Why this matters as positioning:** "We help men get more dates" → "We teach every important conversation you'll have in life." Expands the addressable market dramatically (teenagers, college students, shy adults, salespeople, executives, teachers, job seekers — everyone talks, everyone struggles at some point).

**The differentiator over static-lesson competitors (e.g. RiseGuide):** experiential learning over information delivery. Instead of a lesson saying "ask open-ended questions," the avatar actually goes silent when the user fails to ask one — the user *feels* the conversation die, then Ryan explains why. That's a much stickier learning model than reading a tip.

**Gamification idea:** score individual communication sub-skills, not just one number —

```
Curiosity           91
Confidence           74
Humor                42
Listening            95
Storytelling         58
Follow-up Questions  83
Emotional Awareness  66
Comfort With Silence 79
Conversation Flow    81
```

**Avatar depth idea:** give each character hidden personality traits (introvert, sarcastic, slow to trust, high openness, etc.) that the AI knows and the user doesn't — the goal becomes *discovering* the person through conversation rather than "winning" against a script. Closer to real life than scripted pickup-artist material.

**Central philosophy to build the whole curriculum around:** *every conversation is made of micro-skills; master the micro-skills, and you can succeed in almost any conversation.* This is what would let Eklipses scale to new niches (interview prep, sales, negotiation) later without re-architecting anything — same engine, new specialization content on top.

**Analogy used to describe it:** flight simulators don't teach aviation through lectures — they let you fly. Eklipses could do the same for conversation: a safe environment to practice, make mistakes, get targeted feedback, and improve through repetition, rather than static lessons alone.

---

## 4. Supporting Research: "How to Never Run Out of Things to Say"

*(Deep research pulled to source techniques that could become Lesson 3+ content or feed the key-phrase drill library — usable now, inside the current dating-focused roadmap, without waiting for the bigger platform pivot.)*

### Core reframe
"Never running out of things to say" isn't about stockpiling topics — it's about listening well enough that the other person keeps handing you material. The most powerful conversational tool isn't talking, it's listening.

### Key techniques

**1. Conversational threading** *(highest-value technique to build a feature/lesson around)*
Every sentence contains multiple "threads" you can pull on. A flat answer ("I'm here for work") gives the other person nothing to grab; a threaded answer ("I'm here hoping to learn X to help my team do Y") hands them two things to follow up on.
*App idea:* a drill where the AI gives a sentence with 2-3 embedded threads, user has to spot them and pick the most interesting one to pull on, with immediate feedback on whether it was a live thread or a dead end.

**2. The echo/repeat-back technique**
Repeating what someone said, reframed as a question, passes the ball back to them. Low-effort, high-payoff — a safe default move for someone who freezes.

**3. Open-ended over closed questions**
"What's been the highlight of your evening?" beats "Have you been here before?" — opens more threads.
*App idea:* show a closed question, have the user rewrite it open-ended, score it.

**4. The "reminds me of" restart move**
Looking at the environment or the last thing said and pivoting with "that reminds me of…" — works well right after someone finishes a story (careful not to one-up them).

**5. The 3-second rule**
Say what comes to mind within ~3 seconds — after that, the internal filter kicks in and rejects perfectly good material. The problem usually isn't lack of content, it's overthinking.
*App idea:* a timed response drill — a few seconds to respond before the "filter window" closes, training instinct over content.

**6. FORD framework (small-talk safe zones)**
Family, Occupation, Recreation, Dreams — reliable low-risk fallback territory for beginners. Threading is the more advanced skill on top of it.

**7. Reciprocal self-disclosure** *(deeper, evidence-backed layer — Arthur Aron's closeness research, the mechanism behind the "36 Questions" format)*
Sustained, escalating, reciprocal, personal self-disclosure is the actual driver of closeness — not a filler trick, a structure: start light, escalate depth together, take turns.
*App idea:* a guided "escalation ladder" mode — both parties start at light/factual questions, deeper prompts unlock as the exchange progresses.

**8. Silence tolerance**
Not every pause needs filling. The anxiety about silence is often worse than the silence itself — comfort with a beat of quiet is a trainable skill, arguably more valuable than "more things to say," since it removes the pressure that causes blanking out in the first place.

### Most gamifiable techniques (mechanical enough to score, unlike "be more curious")
Threading, echo, and open-ended-question rewriting — these translate most directly into short drills using the existing avatar/coach architecture.

---

## 5. Sequencing Decision (confirmed)

Stay narrow. Finish validating the dating niche before touching the bigger platform vision:
1. Mine the "never run out of things to say" research for **content** now (Lesson 3 material, key-phrase library additions) — not new architecture.
2. Keep marketing focused on dating specifically once lesson count hits the MVP bar — sharper, more urgent, more shareable than a generic "communication skills" pitch, and less crowded than the space RiseGuide (funded, 50-200 person team) already occupies.
3. Revisit the Communication OS repositioning only after real paying users validate the current niche.

---

## 6. Open Question Going Into Next Session

Given the day-job constraint (1-2 evening hours, most days), the next real conversation is: **how to automate as much of the remaining roadmap as possible**, so Lesson 3, avatar expansion, and the pause-and-rewind feature keep moving even without long unbroken sessions.
