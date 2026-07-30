# EKLIPSES — LESSON 3
## "The Long Game"
**PACE mnemonic | Style: The Dark Needle | Status: Spec locked — ready to implement**

---

## DECISIONS LOCKED

**Mnemonic:** PACE
**Lesson title:** The Long Game
**Character:** Sofia (second meeting — coffee-shop)
**Setting:** coffee_shop_second_meeting (new scenario key added for this lesson)
**Previous lesson context:** OTIMC (L1) and FRAME (L2) covered the approach and holding ground.
  L3 covers what happens AFTER the approach lands — the second-meeting dynamic where premature
  declarations and under-restraint kill interest.

---

## WHY THIS TOPIC

Most advice covers what to do in the first 30 seconds. PACE teaches the next phase: what to do
once she's already interested. The paradox: the moment things go well is when most men destroy them.
They declare too fast, answer too directly, compliment too much, and escalate too early.
PACE is about restraint in the phase where restraint is hardest.

---

## MNEMONIC

### PACE

> "The moment things go well is the moment most men ruin it. PACE teaches you to wait."

| Letter | Word      | One-sentence expansion |
|--------|-----------|------------------------|
| P      | Pause     | When she asks you directly how you feel, don't answer directly — make her wait for it. |
| A      | Ask-back  | After every answer about yourself, redirect with a question back to her. |
| C      | Contain   | Hold back the compliments — stacking romantic declarations early kills tension. |
| E      | Earn      | Let her demonstrate interest before you match it; declarations only land when she's earned them. |

---

## KEY-PHRASE LIBRARY

*3 curated lines per skill. Universal lines work anywhere in the conversation (no opener constraint).
Tags: opener: true means approach-only (skip in mid-conversation).*

### P — Pause (when she asks how you feel or about exclusivity)

- { text: "I haven't decided yet. Ask me again in an hour." }                      // universal
- { text: "That's a faster question than I expected." }                             // universal
- { text: "Let's find out." }                                                       // universal

### A — Ask-back (after he answers something about himself)

- { text: "What about you — same question." }                                       // universal
- { text: "Your turn." }                                                            // universal
- { text: "I'll ask you the same thing." }                                          // universal

### C — Contain (when tempted to stack compliments)

- { text: "You already know you're interesting. I don't need to say it." }         // universal
- { text: "I've noticed a few things. I'm keeping them to myself for now." }       // universal
- { text: "Let's call it noted." }                                                  // universal

### E — Earn (instead of early escalation)

- { text: "We're not there yet." }                                                  // universal
- { text: "Good things earn themselves." }                                          // universal
- { text: "I know what I want. I'm not in a rush about it." }                      // universal

---

## PEDAGOGICAL EXPLANATION OVERLAY TEXT

*One two-sentence block per skill. Sentence 1 frames what SHE is doing psychologically.
Sentence 2 names the skill plainly. These are shown in the Coached Practice interrupt overlay.*

**P — Pause:**
She's asking you to declare yourself before you've made her work for it — a direct pull designed
to reveal how much control you have. This is a Pause moment.

**A — Ask-back:**
She just gave you information about herself and is now watching to see whether you're interested
in her or just waiting for your next turn to speak. This is an Ask-back moment.

**C — Contain:**
She's showing you she's receptive, which is exactly when most men pile on the compliments and
drain the tension they've been building. This is a Contain moment.

**E — Earn:**
She hasn't shown enough investment yet for you to be declaring interest — escalating now tells
her she already won, which ends the game. This is an Earn moment.

---

## MOMENT-DETECTION LOGIC (implemented in api/coach-moment.js)

### Skill definitions passed to LLM

**P — Pause:**
When she asked a DIRECT question about his feelings, interest, or exclusivity ("do you like me?",
"are you seeing anyone?", "what are we doing here?"), did he answer too eagerly or directly?
FAIL = immediately confirms feelings, says "yes I like you", "no I'm not seeing anyone" —
gives her the answer before she's earned the tension.
NOT P = she asked about his job, hobbies, travel, or any personal-history topic. Those are
Mystery's territory from Lesson 1 — P does not apply.

**A — Ask-back:**
When she asked him about himself (job, interests, experiences), did he answer but fail to
redirect a question back to her?
FAIL = gives a complete answer about himself with no question or redirect back, turn ends on him.
NOT A = she made a statement (not a question), or he did redirect with a question.

**C — Contain:**
Did he stack multiple romantic/attraction-specific compliments in one message?
FAIL = uses two or more of: "you're beautiful", "you're gorgeous", "I really like you",
"I'm falling for you", "you're stunning/amazing/perfect" — stacked in one turn.
NOT C = single casual compliment, general banter, playful tease, or humor. Those stay Tease
territory from Lesson 1.

**E — Earn:**
In the FIRST 3-4 exchanges, did he make a premature declaration of strong interest, a date
proposal, or romantic escalation?
FAIL = "I really like you", "I want to take you out", "I feel something with you" — in the
first 3-4 exchanges before she's shown real investment.
NOT E = after exchange 4 (she's had time to invest), or when he's responding to her clear signal.

### Deterministic hard gates (code-enforced — not LLM-dependent)

- **P cannot fire** unless her characterResponse contains an explicit feelings/exclusivity question
  (regex matching: "do you like me", "are you seeing", "what are we", "how do you feel", etc.)
- **A cannot fire** unless her characterResponse contains a question with "you" in it
  (she asked about him) — if no ? or question directed at him → A blocked
- **C cannot fire** unless userMessage contains ≥2 distinct romantic/attraction terms
- **E cannot fire** if exchangeCount > 4 OR userMessage contains no escalation language

---

## SCENARIO OUTLINE — SOFIA / COFFEE SHOP SECOND MEETING

*Sofia and Alex have met before (beach, Lesson 1 context). This is their second meeting.
Sofia is more open this time but also more direct — she's gauging whether he's worth more investment.
She periodically asks direct interest/exclusivity questions to create Pause moments.
She follows his answers with genuine questions to create Ask-back moments.
She shows warmth that invites compliments — to create Contain moments.
She signals investment too fast if he doesn't apply Earn.*

### BEAT OUTLINE

**SEGMENT 00 — INTRO (Ryan)**
Ryan introduces the next phase: what happens after the approach lands. The moment she's interested
is the moment most men blow it. They declare too fast, compliment too much, answer too directly.
PACE is the skill set that keeps the tension alive once things are going well.

**SEGMENT 01 — P: THE PAUSE IN ACTION (Exchange)**
Sofia asks directly: "Do you actually like me or is this just something to do?"
Alex answers too eagerly — "Yeah I really like you, I think about you all the time."
She cools slightly. The declaration removed the uncertainty that was creating pull.

**SEGMENT 02 — P EXPLAINED (Ryan)**
Ryan explains what just happened. She asked — he answered. Feels natural. But she wasn't actually
asking for information. She was testing whether he has the restraint to make her wait for it.
The answer she wanted was not "yes" — it was something that made her wonder.

**SEGMENT 03 — A: THE ASK-BACK IN ACTION (Exchange)**
Sofia asks what he does for work. He gives a complete, detailed answer — and stops.
She responds briefly. The conversation slows. He had the ball and held it.

**SEGMENT 04 — A EXPLAINED (Ryan)**
Ryan explains: she handed you the volley and you kept it. Every time she asks about you is an
opportunity to learn more about her. Answer briefly. Redirect. "Your turn" or "What about you?"
— these lines are not filler; they're the engine of the conversation.

**SEGMENT 05 — C: THE CONTAIN IN ACTION (Exchange)**
Sofia laughs at something he says — real warmth, briefly visible. He piles on:
"I mean it, you're really beautiful, I've been thinking about that since the beach."
She softens slightly — but something shifts. The moment of tension is gone.

**SEGMENT 06 — C EXPLAINED (Ryan)**
Ryan explains the compliment trap. The moment she gave him warmth, he gave it all back
immediately — and drained the tension he'd been building. The rule is not to never compliment.
The rule is to not stack them when she's already feeling it. The withheld compliment is more
powerful than the given one.

**SEGMENT 07 — E: THE EARN IN ACTION (Exchange)**
Third exchange: Alex says "I feel like I haven't felt this way in a while — I'd really like to
take you out properly." Sofia smiles but it's slightly different now — something settled.
She didn't earn the declaration. It arrived too soon.

**SEGMENT 08 — E EXPLAINED (Ryan)**
Ryan explains: declarations are not gifts. They're bets. You're telling her exactly how you feel
before she's shown you that she's worth the risk. Wait. Let her show you. The moment she reveals
real investment — then you tell her. Not before.

**SEGMENT 09 — PUTTING IT TOGETHER (Exchange)**
Alex re-enters the same conversation with PACE applied. He pauses on the direct question,
redirects after his own answers, holds a compliment back at the moment it would have been most
expected, and waits until she shows real investment before saying anything close to a declaration.
The whole tone of the conversation is different.

**SEGMENT 10 — RECAP AND SEND-OFF (Ryan)**
PACE mnemonic restated. Closing line:
> "Most men rush because they're afraid the moment will pass. The men who understand PACE know
> something different: the moment is only available to the man who is willing to wait for it."

---

## RECORDING NOTES (for future use, not current phase)

- Same format as Lessons 1 and 2: one MP3 per segment
- File naming: `lesson3_seg00.mp3`, `lesson3_seg01.mp3`, … `lesson3_seg10.mp3`
- Target runtime: 9-12 minutes total
- Store in R2 under `/lessons/lesson3/audio/`
