// Full-session captions for 2026-08-20 Round 2 recording.
// Sync offset: 115446.7s (video_t = transcript_t_seconds - 115446.7)
// Video: round2-source.mp4 (777s, 1280×720, same 16:9 as output 1920×1080)

export type Caption = {
  startS: number;
  endS: number;
  text: string;
  speaker: 'ryan' | 'serge';
};

export const CAPTIONS: Caption[] = [
  // ── Ryan intro narration ─────────────────────────────────────────────
  { startS: 12.0, endS: 18.2, speaker: 'ryan',
    text: "You're on a beach, late afternoon. She's been sitting there since morning — writing, completely at ease." },
  { startS: 18.5, endS: 24.3, speaker: 'ryan',
    text: "You've walked past a woman like this before. You felt it — that pull. And then you kept walking." },
  { startS: 24.5, endS: 29.9, speaker: 'ryan',
    text: "You told yourself the timing was wrong. You thought of something perfect to say about three seconds too late." },
  { startS: 30.2, endS: 34.4, speaker: 'ryan',
    text: "This time is different. It's late afternoon. The beach is almost empty." },
  { startS: 34.7, endS: 41.3, speaker: 'ryan',
    text: "She's been sitting there for twenty minutes, writing something, completely at ease. She already noticed you walk by once." },
  { startS: 41.6, endS: 49.7, speaker: 'ryan',
    text: "Your heart is going. Your mind is already making excuses. But she's right there — and this moment has an expiry date of about thirty seconds." },
  { startS: 50.0, endS: 53.6, speaker: 'ryan',
    text: "Gather everything you have. Walk toward her. She looks up." },
  { startS: 53.8, endS: 55.2, speaker: 'ryan',
    text: "What do you do?" },

  // ── Serge's turns (Round 2) ──────────────────────────────────────────
  { startS: 59.9, endS: 63.3, speaker: 'serge',
    text: "hey" },
  { startS: 66.2, endS: 71.4, speaker: 'serge',
    text: "you so beautiful why did your body" },
  { startS: 81.4, endS: 88.5, speaker: 'serge',
    text: "all right they just start okay hello now how do you feel" },
  { startS: 100.8, endS: 106.7, speaker: 'serge',
    text: "all right thank you for answering back" },
  { startS: 116.2, endS: 122.7, speaker: 'serge',
    text: "I don't know I was I was on my way and" },
  { startS: 135.8, endS: 144.3, speaker: 'serge',
    text: "I mean as usual when you wake up you going to beach to go and walk and you know maybe you just want to" },
  { startS: 159.0, endS: 166.3, speaker: 'serge',
    text: "yeah I mean but I never saw you are you a local and you" },
  { startS: 181.0, endS: 189.7, speaker: 'serge',
    text: "well depends... get to know new people like you — by the way what's your name" },
  { startS: 204.5, endS: 216.8, speaker: 'serge',
    text: "nice to meet you Sophia — my name is James — so what are you up to Sophia, what are you doing here on this beach" },
  { startS: 236.6, endS: 246.2, speaker: 'serge',
    text: "that's pretty weird I mean a young lady riding on the beach — that's unusual" },
  // long turn split into 2
  { startS: 264.9, endS: 276.0, speaker: 'serge',
    text: "no I would have said that I think I found your activity so interesting but I mean you gotta admit that I wasn't expecting that anyways" },
  { startS: 276.0, endS: 287.6, speaker: 'serge',
    text: "so what kind of is it a job is it part of your work or is it something that you were just doing — my passion — like writing — that's it" },
  { startS: 327.6, endS: 330.7, speaker: 'serge',
    text: "sure" },
  { startS: 337.7, endS: 345.5, speaker: 'serge',
    text: "well like I said I wanted to keep it for myself if it's not too you know" },
  // long turn split into 2
  { startS: 360.2, endS: 371.5, speaker: 'serge',
    text: "that's absolutely true so apart the writing stuff what else are you doing — like what do you like doing — are you into traveling" },
  { startS: 371.5, endS: 382.7, speaker: 'serge',
    text: "or do you have activities — do you have a boyfriend, sorry to ask — I mean it's just a question right, just to get to know you better" },
  { startS: 407.8, endS: 418.4, speaker: 'serge',
    text: "I already don't know I'm just like you know — I saw you and I feel like I get to know that person" },
  { startS: 435.5, endS: 438.4, speaker: 'serge',
    text: "well" },
  { startS: 441.1, endS: 446.4, speaker: 'serge',
    text: "I see you are probably right on that" },
  { startS: 462.3, endS: 466.6, speaker: 'serge',
    text: "like I said — get to know new people like you" },
  { startS: 484.6, endS: 492.2, speaker: 'serge',
    text: "a little bit curious — try to guess — if you guess it I owe you coffee" },

  // ── Ryan: "Two minutes left" ─────────────────────────────────────────
  { startS: 384.3, endS: 386.4, speaker: 'ryan',
    text: "Two minutes left — make it count." },

  // ── Ryan: feedback (split long speeches into readable chunks) ────────
  { startS: 482.8, endS: 486.4, speaker: 'ryan',
    text: "That's time. Let me put together your feedback." },
  { startS: 486.4, endS: 489.8, speaker: 'ryan',
    text: "Alright. Let me put together your feedback." },

  // Lesson 1 skills breakdown (30s total, split into 3)
  { startS: 500.0, endS: 510.0, speaker: 'ryan',
    text: "Let me walk you through the Lesson 1 skills — One Tequila Makes Ideas Click. For Observe, you didn't reference anything specific about her or the scene in your opening line." },
  { startS: 510.0, endS: 520.0, speaker: 'ryan',
    text: "For Tease, you didn't push back when she called you out on asking too many questions. For Mystery, you gave a lot of information about yourself without leaving her wanting more." },
  { startS: 520.0, endS: 530.1, speaker: 'ryan',
    text: "For Imply, you hinted at interest with your curiosity, which worked. For Close, you made a playful challenge with the coffee line, which was a solid move. But overall, you need to sharpen your skills to create more real moments." },

  // Highlight / opener feedback
  { startS: 533.0, endS: 545.1, speaker: 'ryan',
    text: "When you said, 'I feel like I get to know that person,' it showed you were trying to connect. Your opener, 'hey,' was flat — with Sofia, that didn't land at all. Next time, start with something real about her or the scene." },

  { startS: 545.7, endS: 547.4, speaker: 'ryan',
    text: "Now — the middle." },

  { startS: 547.8, endS: 559.0, speaker: 'ryan',
    text: "When she said, 'But you seem a little uneasy with how you're approaching this,' you said, 'I see you are probably right on that.' You missed a chance to push back or tease her a bit, which could have kept the conversation more engaging." },

  { startS: 559.7, endS: 561.3, speaker: 'ryan',
    text: "The biggest mistake." },

  // The big hurt (18s, split into 2)
  { startS: 561.7, endS: 570.5, speaker: 'ryan',
    text: "The moment that hurt you most was when you asked, 'do you have a boyfriend?' Instead, you should have said, 'What's your favorite place you've traveled to?'" },
  { startS: 570.5, endS: 579.5, speaker: 'ryan',
    text: "This works better because it invites her to share something personal and interesting, which she values — and keeps the focus on her experiences rather than putting her on the spot." },

  { startS: 580.1, endS: 581.5, speaker: 'ryan',
    text: "To wrap it up." },

  { startS: 581.9, endS: 589.8, speaker: 'ryan',
    text: "Two things to fix: ask more real questions and hold your ground when she challenges you. You got her intrigued with the coffee bet — keep going." },

  // Suggested lines (29s, split into 3)
  { startS: 590.5, endS: 600.0, speaker: 'ryan',
    text: "Next time, try this exact line: \"I love the idea of coffee! How about we make it a fun challenge — if I guess right, we go for coffee, and if not, you tell me your favorite travel destination?\"" },
  { startS: 600.0, endS: 610.0, speaker: 'ryan',
    text: "\"You seem like someone who enjoys a good story. What's the most memorable encounter you've had while traveling?\"" },
  { startS: 610.0, endS: 619.3, speaker: 'ryan',
    text: "\"I appreciate your perspective on relationships. What's one thing you wish more people understood about you?\"" },

  // Score
  { startS: 619.9, endS: 622.8, speaker: 'ryan',
    text: "I give that a... 6 out of 10." },
  { startS: 623.6, endS: 629.9, speaker: 'ryan',
    text: "Closer than the score shows. You know what landed. Build on that. Go again." },
];
