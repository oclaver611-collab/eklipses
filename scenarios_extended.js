// ============================================================
// Eklipses — Extended Scenarios (Interview + Dark Psychology)
// Add-on file — loads after scenarios.js
// ============================================================
// HOW TO USE:
//   In index.html (and index2.html), add this AFTER scenarios.js:
//   <script src="scenarios_extended.js"></script>
//
// All new scenarios follow the existing schema + 3 new metadata
// fields (category, difficulty, duration_min) for the Session 2
// UI redesign. Older scenarios without these fields still work —
// the UI should treat missing metadata as category="dating",
// difficulty=2, duration_min=10 by default.
// ============================================================


// ==========================================================
// INTERVIEW SCENARIOS
// ==========================================================

// --- 1. Behavioral Interview — STAR Method ---
SCENARIOS.interview_behavioral = {
  title: "Behavioral Interview: Master the STAR Method",
  thumb: "interview_office.jpg",
  category: "interview",
  difficulty: 2,
  duration_min: 10,
  demo: [
    { speaker: "Ryan",   text: "Welcome to interview practice. I'm Ryan, your communication coach. This scenario teaches you how to answer behavioral questions — the 'tell me about a time' ones that trip up most candidates." },
    { speaker: "Ryan",   text: "You'll watch Daniel interview with Mary as a friendly HR manager. Pay attention to how he uses the STAR method: Situation, Task, Action, Result." },
    { speaker: "Mary",   text: "Thanks for coming in, Daniel. Let's start with a classic — tell me about a time you faced a conflict with a coworker." },
    { speaker: "Daniel", text: "Sure. At my last job I was leading a product launch, and our lead designer disagreed with my timeline." },
    { speaker: "Ryan",   text: "Notice how Daniel starts with the Situation — short, clear context. No rambling backstory." },
    { speaker: "Daniel", text: "My task was to ship by end of quarter, but she felt the design needed another two weeks." },
    { speaker: "Ryan",   text: "That's the Task — what he specifically needed to accomplish." },
    { speaker: "Daniel", text: "So I asked her to walk me through what she wanted to improve, with mockups. Then I pulled in our engineering lead to scope what was feasible in five days instead of fourteen." },
    { speaker: "Ryan",   text: "Action — concrete steps he took. Not 'we talked it out.' Specific moves." },
    { speaker: "Daniel", text: "We compromised: ship on time with the top three design fixes, iterate on the rest post-launch. She felt heard, we met the deadline, and the launch performed 20% above forecast." },
    { speaker: "Ryan",   text: "Result — with a number. Always close with impact if you can." },
    { speaker: "Mary",   text: "Great example. What did you learn from it?" },
    { speaker: "Daniel", text: "That 'no' usually isn't what people mean. She didn't want two more weeks — she wanted her craft respected. Asking the right question saved the launch." },
    { speaker: "Ryan",   text: "Beautiful close. He turned a conflict story into a leadership lesson. Now your turn." }
  ],
  practice: [
    { speaker: "Ryan",        text: "Okay — Mary is your interviewer. She's friendly but observant. You'll get three behavioral questions. Remember: STAR. Keep each answer under 90 seconds." },
    { speaker: "Mary",        text: "Thanks for coming in today. Let's jump in. Tell me about a time you had to meet a tight deadline." },
    { speaker: "Ryan",        text: "Start with the Situation — one sentence." },
    { speaker: "User_Prompt", text: "Freestyle: (Describe the situation briefly)" },
    { speaker: "Mary",        text: "Mm-hmm, go on." },
    { speaker: "Ryan",        text: "Now the Task — what specifically did you need to do?" },
    { speaker: "User_Prompt", text: "Freestyle: (State what was required of you)" },
    { speaker: "Mary",        text: "And how did you handle it?" },
    { speaker: "Ryan",        text: "Action — be specific. Not 'we collaborated.' What did YOU do?" },
    { speaker: "User_Prompt", text: "Freestyle: (Describe your specific actions)" },
    { speaker: "Mary",        text: "And the outcome?" },
    { speaker: "Ryan",        text: "Result — with a number or concrete impact if possible." },
    { speaker: "User_Prompt", text: "Freestyle: (Share the result with measurable impact)" },
    { speaker: "Mary",        text: "Solid. Let's try another. Tell me about a time you failed." },
    { speaker: "Ryan",        text: "Key move: pick a REAL failure, not a humblebrag. Then spend 70% of your answer on what you learned." },
    { speaker: "User_Prompt", text: "Freestyle: (Describe a real failure and what you learned)" },
    { speaker: "Mary",        text: "Thanks for being candid. Last one — tell me about a time you disagreed with your manager." },
    { speaker: "Ryan",        text: "Landmine question. Show you can push back WITHOUT being difficult. Focus on how you made the case, not how you 'won.'" },
    { speaker: "User_Prompt", text: "Freestyle: (Describe respectful disagreement)" },
    { speaker: "Mary",        text: "Appreciate that. That's all from me today — do you have questions for me?" },
    { speaker: "User_Prompt", text: "Say: 'Yes — what does success look like in this role at the 90-day mark?'" },
    { speaker: "Mary",        text: "Great question. Most candidates don't ask that." },
    { speaker: "Ryan",        text: "Perfect close. You flipped from 'being evaluated' to 'evaluating the role.' That signals senior thinking." },
    { speaker: "Ryan",        text: "STAR recap: Situation, Task, Action, Result. Three common killers: (1) no specifics, (2) using 'we' instead of 'I', (3) no number at the end. Nail all three and you'll outperform 90% of candidates." }
  ]
};


// --- 2. Salary Negotiation — Anchor High, Stay Calm ---
SCENARIOS.interview_salary = {
  title: "Salary Negotiation: Anchor High, Stay Calm",
  thumb: "interview_negotiation.jpg",
  category: "interview",
  difficulty: 4,
  duration_min: 12,
  demo: [
    { speaker: "Ryan",   text: "This is the highest-leverage conversation of your career. A ten-minute salary negotiation can move your income by 10k to 30k a year. Over a decade, that's a house down payment." },
    { speaker: "Ryan",   text: "Watch Daniel handle Mary, a hiring manager pushing the classic trap: 'What are your salary expectations?'" },
    { speaker: "Mary",   text: "So before we go further — what are your salary expectations for this role?" },
    { speaker: "Daniel", text: "I'd love to understand the full comp picture first — base, bonus, equity, before I anchor to a number. What's the range budgeted for this role?" },
    { speaker: "Ryan",   text: "Rule one: whoever names a number first loses. Daniel just flipped the question back elegantly." },
    { speaker: "Mary",   text: "Well, we're looking somewhere between 120k and 150k." },
    { speaker: "Daniel", text: "Thanks for sharing. Based on my experience and the scope we've discussed, I'd be targeting the top of that range — 150k base, ideally with standard equity." },
    { speaker: "Ryan",   text: "He anchored at the TOP, not the middle. Even if they push back, the conversation now lives at the high end." },
    { speaker: "Mary",   text: "That's a stretch for us. Our final candidate expectations were closer to 135." },
    { speaker: "Daniel", text: "I hear you. Can I ask what's driving that delta? I want to make sure I'm scoping to what you actually need." },
    { speaker: "Ryan",   text: "Notice he didn't defend, didn't apologize, didn't drop his number. He asked a question and made HER explain." },
    { speaker: "Mary",   text: "Honestly, budget. We have flexibility on sign-on though." },
    { speaker: "Daniel", text: "Understood. If base lands at 145, with a 15k sign-on, we're in workable territory for me. Can we get to that?" },
    { speaker: "Ryan",   text: "He moved 5k on base but got 15k of real money back. Net win. That's called splitting the ask — base is sticky, sign-on is flexible." },
    { speaker: "Mary",   text: "Let me check with the team and get back to you tomorrow." },
    { speaker: "Daniel", text: "Appreciate it. I'm excited either way." },
    { speaker: "Ryan",   text: "Flawless. He stayed warm, never threatened to walk, but held firm. Your turn." }
  ],
  practice: [
    { speaker: "Ryan",        text: "You're Daniel. Mary is the hiring manager. Goal: get to the top of the band without seeming difficult. Remember — warm voice, firm numbers." },
    { speaker: "Mary",        text: "We'd love to move forward. What are your salary expectations?" },
    { speaker: "Ryan",        text: "Do not name a number. Flip the question." },
    { speaker: "User_Prompt", text: "Say: 'I'd love to understand the full compensation range budgeted for this role before I anchor to a specific number.'" },
    { speaker: "Mary",        text: "We're looking at 110 to 140k base, depending on experience." },
    { speaker: "Ryan",        text: "Now anchor at the TOP. Not the middle. Confidence sets the ceiling." },
    { speaker: "User_Prompt", text: "Say: 'Given my experience and the scope we've discussed, I'd be targeting 140, ideally with standard equity.'" },
    { speaker: "Mary",        text: "That's above where we thought we'd land. Most candidates at your level come in around 125." },
    { speaker: "Ryan",        text: "Classic pressure move. Do not apologize. Ask a question instead." },
    { speaker: "User_Prompt", text: "Say: 'I hear you. What's driving that number — is it budget, or where most of the team sits?'" },
    { speaker: "Mary",        text: "Honestly, it's budget. We could stretch to 130 base." },
    { speaker: "Ryan",        text: "Don't accept yet. Split the ask — trade base for sign-on, which is one-time and easier to approve." },
    { speaker: "User_Prompt", text: "Say: 'If we land at 135 base with a 15k sign-on, I think we have a deal.'" },
    { speaker: "Mary",        text: "Let me come back to you on that. Anything else on the comp side I should know?" },
    { speaker: "Ryan",        text: "Always have a second ask ready. Vacation, remote flexibility, review cycle. Pick one." },
    { speaker: "User_Prompt", text: "Freestyle: (Ask for one non-cash benefit — extra vacation, remote flexibility, or an accelerated first review)" },
    { speaker: "Mary",        text: "Noted. I'll circle back with the updated package by end of day tomorrow." },
    { speaker: "User_Prompt", text: "Say: 'Sounds great. I'm excited about the role either way — just want to make sure we start on the right foot.'" },
    { speaker: "Mary",        text: "Appreciate that. Talk tomorrow." },
    { speaker: "Ryan",        text: "Masterclass. You never defended, never apologized, never gave a number first. Three laws of negotiation: (1) First number loses. (2) Anchor at the top of the band. (3) Silence after your ask is your friend — let them fill it." },
    { speaker: "Ryan",        text: "Pro tip: Every response you give should either ASK a question or STATE a number. Never explain. Never justify. The moment you start explaining, you've already conceded." }
  ]
};


// --- 3. The Stress Interview — Composure Under Pressure ---
SCENARIOS.interview_stress = {
  title: "The Stress Test: Composure Under Hostile Questioning",
  thumb: "interview_boardroom.jpg",
  category: "interview",
  difficulty: 5,
  duration_min: 12,
  demo: [
    { speaker: "Ryan",   text: "Some interviewers are deliberately hostile. They want to see how you perform under pressure. This is common for consulting, banking, sales, and executive roles." },
    { speaker: "Ryan",   text: "Your job is NOT to match their energy. The test is whether you stay warm and grounded when they're cold." },
    { speaker: "Daniel", text: "Thanks for making time today." },
    { speaker: "Mary",   text: "Let's skip the pleasantries. I've got ten minutes. Why should I hire you over the other three finalists?" },
    { speaker: "Ryan",   text: "Notice the interruption and dismissiveness. That's deliberate. Daniel stays warm." },
    { speaker: "Daniel", text: "Fair question. Without knowing the other candidates, I can speak to what I bring — ten years shipping product in this exact space, and a track record of turning around two teams that were off-track. Would it help if I went deeper on either?" },
    { speaker: "Ryan",   text: "He didn't flinch, didn't rush, didn't get defensive. He gave a confident two-line answer and offered her control." },
    { speaker: "Mary",   text: "Your resume is thin on enterprise sales. How do you plan to close multi-million-dollar deals with that background?" },
    { speaker: "Daniel", text: "You're right that my enterprise experience is recent — three years, not ten. What I bring is product intuition that lets me have technical credibility with buyers, which has closed two seven-figure deals last year. I'd trade some tenure for that fit." },
    { speaker: "Ryan",   text: "He agreed with the criticism — that's disarming — then reframed it as a strength with a number." },
    { speaker: "Mary",   text: "I don't know. I'm not convinced." },
    { speaker: "Daniel", text: "That's honest, and I appreciate it. What would it take for you to be convinced? I'd rather address it directly than leave here with doubt in the room." },
    { speaker: "Ryan",   text: "Power move. He turned the rejection into a diagnostic. Forced her to name her actual objection." },
    { speaker: "Mary",   text: "Actually — that was the test. I needed to see how you handle pushback. You passed." },
    { speaker: "Daniel", text: "Appreciate it. Happy to keep going if useful." },
    { speaker: "Ryan",   text: "Watch how warm he stayed even after being told it was a test. No 'I knew it' smugness. That's the mark of a pro." }
  ],
  practice: [
    { speaker: "Ryan",        text: "You're Daniel. Mary is running a deliberately aggressive interview. Warm voice, grounded energy, NEVER match her coldness. Slow your breathing if you need to." },
    { speaker: "Mary",        text: "Let's not waste time. Why should I hire you?" },
    { speaker: "Ryan",        text: "Don't be rattled by the brusqueness. Confident two-line answer." },
    { speaker: "User_Prompt", text: "Freestyle: (State what you bring in 2 sentences, then offer to go deeper)" },
    { speaker: "Mary",        text: "That's generic. Every candidate says that." },
    { speaker: "Ryan",        text: "She's pushing. Don't over-explain or panic. Agree with the critique, then sharpen." },
    { speaker: "User_Prompt", text: "Freestyle: (Acknowledge her point, then give ONE specific achievement with a number)" },
    { speaker: "Mary",        text: "Fine. But your gaps are obvious. How are you going to get up to speed in 90 days?" },
    { speaker: "Ryan",        text: "She's testing whether you have a plan or just talk. Give a concrete 30-60-90." },
    { speaker: "User_Prompt", text: "Freestyle: (Give a 30-60-90 day plan in three short sentences)" },
    { speaker: "Mary",        text: "You're making this sound easier than it is." },
    { speaker: "Ryan",        text: "Classic pressure move. Don't defend. Acknowledge difficulty, then show you've accounted for it." },
    { speaker: "User_Prompt", text: "Say: 'You're right — it's harder than a plan makes it sound. The plan's value isn't certainty, it's that I have a framework for when things break.'" },
    { speaker: "Mary",        text: "Hm. Let me ask differently. What's the biggest mistake you've ever made professionally?" },
    { speaker: "Ryan",        text: "Don't soften. Real mistake, real stakes, real lesson." },
    { speaker: "User_Prompt", text: "Freestyle: (Share a real mistake and what changed permanently in your approach)" },
    { speaker: "Mary",        text: "I'm not sure you're senior enough for this role." },
    { speaker: "Ryan",        text: "The killer blow. Don't crumble. Don't oversell. Turn it into a diagnostic." },
    { speaker: "User_Prompt", text: "Say: 'That's the call you need to make. What specifically would make you more confident — I'd rather address it now than leave doubt in the room.'" },
    { speaker: "Mary",        text: "Okay — honestly, the team management piece. You've managed six. This role manages twenty." },
    { speaker: "Ryan",        text: "NOW you have the real objection. Address the specific gap with a plan." },
    { speaker: "User_Prompt", text: "Freestyle: (Address the management gap specifically — how have you prepared or how will you ramp?)" },
    { speaker: "Mary",        text: "That actually helps. Thanks for staying with me through that." },
    { speaker: "User_Prompt", text: "Say: 'Of course. I'd rather have the hard conversation here than six months in.'" },
    { speaker: "Ryan",        text: "Perfect exit. The stress interview isn't a test of what you know — it's a test of who you become under pressure. You stayed warm. You didn't match her cold. That's the whole game." },
    { speaker: "Ryan",        text: "Composure framework: (1) Breathe before answering — even half a second matters. (2) Agree with criticism before pivoting. (3) Never apologize for your resume. (4) Turn pressure into diagnostic questions. The interviewer who's hardest on you in the room is often the one who fights hardest for you in the debrief." }
  ]
};


// --- 4. The Weakness Trap — Reframe Without Lying ---
SCENARIOS.interview_weakness = {
  title: "The Weakness Trap: Reframe Without Lying",
  thumb: "interview_friendly.jpg",
  category: "interview",
  difficulty: 3,
  duration_min: 8,
  demo: [
    { speaker: "Ryan",   text: "'Tell me about your biggest weakness' is the question candidates prepare for and still blow. Let's look at why — and how to nail it." },
    { speaker: "Mary",   text: "What would you say is your biggest weakness?" },
    { speaker: "Daniel", text: "Honestly? I can get tunnel vision on a problem. When I'm deep in execution, I sometimes under-communicate with stakeholders who need updates." },
    { speaker: "Ryan",   text: "Notice: this is a REAL weakness. Not 'I work too hard' or 'I'm a perfectionist.' Interviewers detect humblebrags instantly." },
    { speaker: "Daniel", text: "I noticed it after a project last year where two execs felt blindsided at the final review, even though the work was solid. They weren't looped in." },
    { speaker: "Ryan",   text: "He gave evidence — a specific incident. Not vague self-reflection. This is where most candidates stop, and that's a mistake." },
    { speaker: "Daniel", text: "Since then, I block thirty minutes every Friday to send a one-paragraph update to stakeholders, even when nothing feels 'ready.' I also send a Monday preview of what I'm focused on. It's simple, but I've had zero surprise moments in 14 months." },
    { speaker: "Ryan",   text: "THIS is the move. Real weakness + specific evidence + concrete system he built to fix it + measurable result. That last part is what 95% of candidates miss." },
    { speaker: "Mary",   text: "I like that you have a system around it. A lot of people just say 'I'm working on it.'" },
    { speaker: "Daniel", text: "Yeah, 'working on it' is just the version of the problem with nicer language. I wanted an actual fix." },
    { speaker: "Ryan",   text: "Dry humor, self-aware, quick. That answer will get remembered for the right reasons." }
  ],
  practice: [
    { speaker: "Ryan",        text: "Your turn. Mary will ask the weakness question. Formula: real weakness + specific incident + the system you built + measurable result. Do NOT humblebrag." },
    { speaker: "Mary",        text: "So tell me — what would you say is your biggest weakness?" },
    { speaker: "Ryan",        text: "Start with the weakness itself. One sentence. Don't soften it." },
    { speaker: "User_Prompt", text: "Freestyle: (Name a real weakness in one sentence)" },
    { speaker: "Mary",        text: "Interesting. Can you tell me more about what that looks like?" },
    { speaker: "Ryan",        text: "Give a specific incident. Real moment, real consequence." },
    { speaker: "User_Prompt", text: "Freestyle: (Describe one specific moment when this weakness hurt you)" },
    { speaker: "Mary",        text: "And how have you worked on it?" },
    { speaker: "Ryan",        text: "Here's where you win the answer. Not vague 'I work on it' — describe a SPECIFIC SYSTEM you built." },
    { speaker: "User_Prompt", text: "Freestyle: (Describe a concrete system, habit, or process you built)" },
    { speaker: "Mary",        text: "How long have you been doing that?" },
    { speaker: "Ryan",        text: "Add the measurable result. Time, frequency, outcome — anything concrete." },
    { speaker: "User_Prompt", text: "Freestyle: (State how long you've done it and the measurable result)" },
    { speaker: "Mary",        text: "Thanks — that's a thoughtful answer. Most candidates stop halfway." },
    { speaker: "User_Prompt", text: "Say: 'Appreciate that. I figured anything I say next, I should be able to show evidence of, not just claim.'" },
    { speaker: "Ryan",        text: "Perfect landing. You made the weakness a story of growth with proof. The reframe formula: REAL WEAKNESS + SPECIFIC INCIDENT + SYSTEM YOU BUILT + MEASURABLE RESULT. Each piece compounds credibility." },
    { speaker: "Ryan",        text: "Three weaknesses to avoid: perfectionism, workaholism, 'caring too much.' Interviewers have heard them 10,000 times and they signal 'I can't self-reflect.' Go real, go specific, and your weakness answer becomes a strength demo." }
  ]
};


// --- 5. Counter-Offer Showdown ---
SCENARIOS.interview_counter = {
  title: "Counter-Offer Showdown: Hold Your Value",
  thumb: "interview_handshake.jpg",
  category: "interview",
  difficulty: 4,
  duration_min: 10,
  demo: [
    { speaker: "Ryan",   text: "You got the offer. You countered. Now they're pushing back. This is where most candidates fold in under sixty seconds and leave 15k on the table." },
    { speaker: "Ryan",   text: "The mindset shift: they've already decided they want you. They extended the offer. Your counter isn't a threat — it's a negotiation opener." },
    { speaker: "Mary",   text: "Hey Daniel — got your counter. I'll be direct, 145 is outside what I can approve. I can get you 132, which is already at the top of our band." },
    { speaker: "Daniel", text: "I hear you. Before I react to the number — can you help me understand what flexibility exists elsewhere? Sign-on, equity refresh, accelerated review?" },
    { speaker: "Ryan",   text: "Watch: Daniel didn't say yes or no to 132. He expanded the conversation to find leverage somewhere else." },
    { speaker: "Mary",   text: "We could probably do a 10k sign-on. Equity's standard across the band, I can't move it." },
    { speaker: "Daniel", text: "Okay. If we can land at 138 base plus the 10k sign-on, and move my first comp review from 12 months to 6, I think we have a deal." },
    { speaker: "Ryan",   text: "He moved 7k on base — a concession — but gained 10k sign-on AND an earlier review cycle. The accelerated review is the sneaky win. It compounds." },
    { speaker: "Mary",   text: "The 6-month review is a stretch. 9 months I can get approved." },
    { speaker: "Daniel", text: "That works. Let's do 138, 10k sign-on, 9-month review. Send the revised offer when you can." },
    { speaker: "Ryan",   text: "He took the second concession because the total package still moved up materially. Negotiation isn't about winning every point — it's about the total outcome being better than where you started." },
    { speaker: "Mary",   text: "You got it. Revised paperwork by EOD." },
    { speaker: "Daniel", text: "Thanks, appreciate you working through that with me." },
    { speaker: "Ryan",   text: "Warm exit. She just fought for his raise internally — she needs to leave the call feeling good about the deal, not annoyed. Your tone after the agreement is as important as the numbers during it." }
  ],
  practice: [
    { speaker: "Ryan",        text: "You're Daniel. You countered at 145. Mary is coming back with pushback. Your job: don't fold, don't fight, expand the pie." },
    { speaker: "Mary",        text: "Hey — so about your counter. 145 is above what I can get approved. I can go to 130." },
    { speaker: "Ryan",        text: "Don't react to the number yet. Open up the other levers first." },
    { speaker: "User_Prompt", text: "Say: 'I hear you. Before I respond to that number, what flexibility exists on sign-on bonus, equity, or review cycle?'" },
    { speaker: "Mary",        text: "Sign-on I could do 8k. Equity is fixed. Review is standard at 12 months." },
    { speaker: "Ryan",        text: "Now package a counter-counter. Move a little on base, trade for sign-on and an earlier review." },
    { speaker: "User_Prompt", text: "Say: 'Okay — if we can do 138 base, 10k sign-on, and move the review to 6 months, I think we have a deal.'" },
    { speaker: "Mary",        text: "138 is tough. I can do 135. And a 9-month review, not 6." },
    { speaker: "Ryan",        text: "Decision moment. Is 135 + 9-month review still materially better than 130 + 12-month? Usually yes. Don't over-negotiate and damage the relationship." },
    { speaker: "User_Prompt", text: "Freestyle: (Accept 135 + 9-month review + 10k sign-on, or push once more — your call)" },
    { speaker: "Mary",        text: "Great. I'll send the revised paperwork by end of day." },
    { speaker: "Ryan",        text: "Close warm. She just fought for you internally." },
    { speaker: "User_Prompt", text: "Say: 'Appreciate you working through that with me. Looking forward to getting started.'" },
    { speaker: "Mary",        text: "Likewise. Welcome aboard." },
    { speaker: "Ryan",        text: "Negotiation endgame — three principles: (1) Always expand the pie before splitting it. Base salary is one number; sign-on, equity, review cycle, vacation, title, start date are all negotiable. (2) Every 'no' is a signal to ask what IS possible, not to give up. (3) The goal is the best total package AND a hiring manager who's glad she brought you on. Burning someone to win an extra 3k is the worst trade in business." },
    { speaker: "Ryan",        text: "Last thing — ALWAYS get the final number in writing before you resign from your current role. Verbal offers evaporate. Get the revised offer letter, re-read it, THEN give notice." }
  ]
};


// ==========================================================
// DARK PSYCHOLOGY SCENARIOS — Manipulation Defense
// ==========================================================
// These scenarios teach users to RECOGNIZE and DEFEND against
// manipulation tactics. The user is always the TARGET. The goal
// is literacy and self-protection, not manipulation training.
// ==========================================================


// --- 1. Gaslighting Defense ---
SCENARIOS.darkpsych_gaslight = {
  title: "Gaslighting Defense: Don't Doubt Your Reality",
  thumb: "darkpsych_livingroom.jpg",
  category: "dark_psychology",
  difficulty: 4,
  duration_min: 12,
  demo: [
    { speaker: "Ryan",   text: "Gaslighting is a manipulation tactic where someone denies reality you witnessed or distorts your memory of it, to make you doubt your own perception. It's named after the 1944 film Gaslight." },
    { speaker: "Ryan",   text: "The counter is NOT arguing harder. It's staying calm and holding your reality without needing them to agree. Watch Daniel handle his partner Mary after she cancelled a planned anniversary dinner without telling him." },
    { speaker: "Daniel", text: "Hey — I got to the restaurant and they said the reservation was cancelled. Did you cancel it?" },
    { speaker: "Mary",   text: "What? No. You told me you were tired and wanted to skip it this year." },
    { speaker: "Daniel", text: "I didn't say that. I was looking forward to it." },
    { speaker: "Mary",   text: "You literally said it Tuesday night. You're being forgetful lately. I'm worried about you." },
    { speaker: "Ryan",   text: "Three classic gaslighting moves in one minute: (1) invents a conversation, (2) insists he's forgetful, (3) frames the concern as 'worry for him.' It feels caring — but it's attack framed as care." },
    { speaker: "Daniel", text: "Mary, I know what I said and didn't say. I didn't cancel the dinner. I want to understand why it was cancelled." },
    { speaker: "Ryan",   text: "Notice: he didn't argue WHY he's right. He didn't produce evidence. He just stated his reality calmly. That's called the broken record technique." },
    { speaker: "Mary",   text: "Why are you attacking me? I literally remember you saying it. Maybe you're more stressed than you realize." },
    { speaker: "Daniel", text: "I'm not attacking you. I'm telling you what happened from my side. The reservation was cancelled. I didn't cancel it. If you did, I'd rather know." },
    { speaker: "Ryan",   text: "He refused to defend himself OR accept her reality. Key line: 'I'm telling you what happened from my side.' That's the anchor." },
    { speaker: "Mary",   text: "Okay, fine, maybe I misremembered. I thought we agreed." },
    { speaker: "Ryan",   text: "Notice how the story shifted. 'You told me' became 'we agreed' became 'maybe I misremembered.' That's the gaslighter's retreat when you don't bite. Most people cave before this moment." }
  ],
  practice: [
    { speaker: "Ryan",        text: "You're Daniel. Mary is your partner who's been gaslighting you. The goal: hold your reality WITHOUT escalating, WITHOUT apologizing for something you didn't do. Three tools: broken record, stating facts, and refusing to accept a false premise." },
    { speaker: "Mary",        text: "Hey, did you put the white shirt in the dryer? It's pink now." },
    { speaker: "Ryan",        text: "You know you didn't touch it. She knows too. But watch what happens next." },
    { speaker: "User_Prompt", text: "Say: 'I didn't do laundry yesterday. You did.'" },
    { speaker: "Mary",        text: "Are you sure? You've been so scattered lately. I watched you carry the basket downstairs." },
    { speaker: "Ryan",        text: "Two tactics in her sentence: calling you scattered, inventing a memory. Stay anchored. Broken record." },
    { speaker: "User_Prompt", text: "Say: 'I didn't do laundry yesterday.'" },
    { speaker: "Mary",        text: "Why are you so defensive? I'm just trying to figure out what happened to the shirt. It's not a big deal." },
    { speaker: "Ryan",        text: "She's reframing your calm response as 'defensive' and calling the issue small. Don't take the bait. Stay on the fact." },
    { speaker: "User_Prompt", text: "Say: 'I'm not being defensive. I'm telling you I didn't do laundry yesterday. If the shirt is pink, something happened, but I wasn't the one doing it.'" },
    { speaker: "Mary",        text: "You're impossible to have a conversation with. Forget it." },
    { speaker: "Ryan",        text: "Classic exit — she frames YOU as the problem. Do not chase. Do not apologize." },
    { speaker: "User_Prompt", text: "Say: 'I'm open to talking. I'm not open to agreeing to something that didn't happen.'" },
    { speaker: "Mary",        text: "(walks out of room)" },
    { speaker: "Ryan",        text: "She left because you didn't cave. A gaslighter needs you to doubt yourself to sustain the tactic. When you refuse to doubt, the tactic fails. This is success, even though it feels uncomfortable." },
    { speaker: "Ryan",        text: "Second round, different tactic — reality revision of a bigger event. Ready?" },
    { speaker: "Mary",        text: "Remember last month when you yelled at my mother at dinner?" },
    { speaker: "Ryan",        text: "You know that didn't happen. State it calmly. Don't argue why — just state." },
    { speaker: "User_Prompt", text: "Say: 'That didn't happen. I was quiet at that dinner. I remember it clearly.'" },
    { speaker: "Mary",        text: "Everyone saw it. My sister mentioned it afterwards." },
    { speaker: "Ryan",        text: "Invented witnesses. Don't chase the witnesses. Don't defend. Broken record." },
    { speaker: "User_Prompt", text: "Say: 'That didn't happen. I'm not going to agree I did something I didn't do.'" },
    { speaker: "Mary",        text: "Fine. Maybe I'm mixing up nights. Whatever." },
    { speaker: "Ryan",        text: "The retreat. Exactly like the demo. The tactic only works on people who doubt themselves or try to win on evidence. You won by staying calm and anchored." },
    { speaker: "Ryan",        text: "Three tells of gaslighting to spot in real life: (1) Someone insists on a version of events you know didn't happen. (2) They frame their manipulation as concern for YOUR well-being. (3) When you hold your ground calmly, they retreat, then try again later with a new scenario. If you see this pattern repeatedly in a relationship — romantic, family, or professional — that's not a misunderstanding. That's a pattern. And patterns don't fix themselves." }
  ]
};


// --- 2. DARVO — Deny, Attack, Reverse Victim and Offender ---
SCENARIOS.darkpsych_darvo = {
  title: "DARVO Decoded: When They Flip the Script",
  thumb: "darkpsych_cafe.jpg",
  category: "dark_psychology",
  difficulty: 4,
  duration_min: 10,
  demo: [
    { speaker: "Ryan",   text: "DARVO stands for Deny, Attack, Reverse Victim and Offender. It's a manipulation pattern where you raise a legitimate concern, and within sixty seconds, you're apologizing to the person who harmed you." },
    { speaker: "Ryan",   text: "Watch Daniel raise a real concern with Mary about her behavior at a party. Then watch how fast DARVO flips the conversation." },
    { speaker: "Daniel", text: "Hey — I wanted to talk about last night at the party. When you criticized my job in front of our friends, that really hurt." },
    { speaker: "Mary",   text: "(Deny) I didn't criticize you. I was joking. You're being way too sensitive." },
    { speaker: "Ryan",   text: "That's D — Deny. Reality is dismissed. He's not hurt, he's 'too sensitive.'" },
    { speaker: "Mary",   text: "(Attack) Honestly, you're the one who always has a problem with my humor. You're constantly making me feel like I can't be myself." },
    { speaker: "Ryan",   text: "A — Attack. The topic pivoted from what she did to what's wrong with him." },
    { speaker: "Mary",   text: "(Reverse Victim-Offender) I was having a great night until you decided to make me feel bad AGAIN for something that wasn't even a big deal. I'm exhausted." },
    { speaker: "Ryan",   text: "RVO — Reverse Victim and Offender. SHE is now the victim. HE is the offender. The original grievance has completely disappeared. Daniel brought up getting criticized in public, and now HE is the one causing HER emotional harm. That's the full DARVO arc — thirty seconds, three moves." },
    { speaker: "Daniel", text: "Mary — I'm not trying to make you feel bad. I'm telling you something that hurt me. I'd like to stay on that for a minute." },
    { speaker: "Ryan",   text: "Notice: he didn't defend against her attack. He didn't apologize for 'making her feel bad.' He just brought the conversation back to the original point. That's the counter. DARVO relies on you chasing each new topic. When you refuse to chase, it loses power." },
    { speaker: "Mary",   text: "Fine. I might have been blunt. I'll think about it." },
    { speaker: "Ryan",   text: "That's the minimum acknowledgment you're going to get in the moment. Don't push for more. Pushing triggers DARVO again." }
  ],
  practice: [
    { speaker: "Ryan",        text: "You're Daniel. Mary has been late to plans with your friends four times in two months. You're bringing it up. Watch for DARVO and counter it." },
    { speaker: "Ryan",        text: "Open with the specific behavior, not 'always' or 'never.'" },
    { speaker: "User_Prompt", text: "Say: 'Hey — I wanted to talk about Friday. You showed up an hour late and my friends were waiting. That's the fourth time in two months. It's bothering me.'" },
    { speaker: "Mary",        text: "I wasn't an hour late. It was like forty minutes, and traffic was insane. Why are you making this a thing?" },
    { speaker: "Ryan",        text: "D — Deny + dismiss. Don't argue the minute count. Don't let 'why are you making this a thing' pull you off course." },
    { speaker: "User_Prompt", text: "Say: 'I'm making it a thing because it's the fourth time. The minutes aren't the point — the pattern is.'" },
    { speaker: "Mary",        text: "Honestly, you're always keeping score on me. I can't do anything right in your eyes." },
    { speaker: "Ryan",        text: "A — Attack. She pivoted from her lateness to your 'always keeping score.' Don't defend against 'always.' Return to the behavior." },
    { speaker: "User_Prompt", text: "Say: 'I'm not keeping score. I'm telling you one specific thing that's happening repeatedly, and I want it to stop.'" },
    { speaker: "Mary",        text: "You know what, fine. I guess I'm just a terrible person. I clearly can't do anything right. Maybe you should find someone who's perfect like you want." },
    { speaker: "Ryan",        text: "RVO — she just flipped the whole frame. Now SHE'S the victim of YOUR unreasonable standards. Do NOT apologize. Do NOT rescue her feelings. Stay on the original point." },
    { speaker: "User_Prompt", text: "Say: 'I don't think you're a terrible person. I'm not talking about perfection. I'm asking you to be on time when we have plans with my friends. That's the whole ask.'" },
    { speaker: "Mary",        text: "Why does this have to be such a big deal? Can we just move on?" },
    { speaker: "Ryan",        text: "She wants the conversation to end without addressing anything. Don't let her escape without at least acknowledgment. No resolution = no closure = this happens again next week." },
    { speaker: "User_Prompt", text: "Say: 'We can move on when I feel like you've actually heard me. I need to know what you're going to do differently next time.'" },
    { speaker: "Mary",        text: "Okay. I'll set an alarm earlier. I didn't realize it was affecting you this much." },
    { speaker: "Ryan",        text: "That's a real concession. Take it. Don't lecture further." },
    { speaker: "User_Prompt", text: "Say: 'Thank you. That's what I needed to hear.'" },
    { speaker: "Ryan",        text: "DARVO counter framework: (1) State the specific behavior, never 'always/never.' (2) Don't defend against attacks — name them and return to the topic. (3) When they claim victimhood, don't rescue them. (4) Don't let the conversation end without concrete acknowledgment. If you let DARVO work, you're training the other person that bringing up real concerns will cost YOU more than staying silent. That's how resentment builds in relationships." },
    { speaker: "Ryan",        text: "Not every person who gets defensive is using DARVO. The signature is the COMPLETE flip — within the same conversation, you went from the one raising a concern to the one apologizing for raising it. If that happens repeatedly, you're dealing with a pattern, not a bad day." }
  ]
};


// --- 3. Narcissist Boss — The Unfair Review ---
SCENARIOS.darkpsych_narc_boss = {
  title: "Narcissist Boss: The Unfair Performance Review",
  thumb: "darkpsych_boss_office.jpg",
  category: "dark_psychology",
  difficulty: 5,
  duration_min: 12,
  demo: [
    { speaker: "Ryan",   text: "Workplace narcissism follows a predictable pattern in performance reviews. Vague negative feedback, moving goalposts, and selective memory about your wins. Your counter is documentation and asking for specifics — NOT defending yourself." },
    { speaker: "Ryan",   text: "Watch Daniel handle his boss during a surprise below-expectations review." },
    { speaker: "Mary",   text: "So Daniel, I've rated you 'needs improvement' this quarter. A few of the team have expressed concerns about your collaboration." },
    { speaker: "Daniel", text: "I appreciate you telling me directly. Can you share which specific projects or moments this is based on, and what the concerns were?" },
    { speaker: "Ryan",   text: "He didn't defend. He didn't ask 'who said that?' He asked for SPECIFICS. Vague feedback is the narcissist's weapon — specifics defuse it." },
    { speaker: "Mary",   text: "Well, it's more of a general theme. People feel you're not a team player." },
    { speaker: "Daniel", text: "To make sure I address this correctly, I'd need one or two specific examples. What project and what was the gap between what was expected and what I did?" },
    { speaker: "Ryan",   text: "He politely refused to accept vague feedback. He's not arguing — he's asking for the data any reasonable review would already contain." },
    { speaker: "Mary",   text: "Well — the Q3 launch. You pushed back on the timeline and that created friction." },
    { speaker: "Daniel", text: "I did push back on the timeline. I flagged technical risk in writing on July 12, which turned out to be correct — we shipped two weeks late because of the exact bug I raised. I'd want to understand how flagging real risk constitutes lack of collaboration." },
    { speaker: "Ryan",   text: "Documentation. He pulled a specific date and a specific outcome from his records. The narcissist's review depends on your foggy memory — clear documentation breaks it." },
    { speaker: "Mary",   text: "Well, it's how you raised it. Tone matters." },
    { speaker: "Daniel", text: "Fair — tone matters. Is there specific feedback on the way I raised it that I can work on? I want to understand the exact ask so I can hit it next quarter." },
    { speaker: "Ryan",   text: "He didn't dispute 'tone matters.' He asked for the specific ask. This makes the goalposts stop moving. Either she produces a real criticism, or she doesn't — and the review stops being credible." },
    { speaker: "Mary",   text: "You know what, let me take another look at the Q3 notes before we finalize the rating." },
    { speaker: "Ryan",   text: "Exactly what you want. The vague review is already eroding because it couldn't survive specifics. Send a follow-up email summarizing the conversation — create a paper trail." }
  ],
  practice: [
    { speaker: "Ryan",        text: "You're Daniel. Your boss Mary is giving you a surprise negative review. Goals: stay calm, ask for specifics, use documentation, don't JADE — Justify, Argue, Defend, Explain. JADE is defensive. Specifics are offensive." },
    { speaker: "Mary",        text: "Daniel, I have to tell you the leadership team isn't happy with your performance this half." },
    { speaker: "Ryan",        text: "Don't react emotionally. Don't agree or disagree. Ask for specifics." },
    { speaker: "User_Prompt", text: "Say: 'Thanks for telling me directly. Can you share which specific projects or outcomes are behind that?'" },
    { speaker: "Mary",        text: "It's more of a general theme. You're not meeting the bar of your peers." },
    { speaker: "Ryan",        text: "Vague. Don't accept it. Politely insist on specifics." },
    { speaker: "User_Prompt", text: "Say: 'To address this, I need to understand specifically. Can you give me one or two concrete examples with names or dates?'" },
    { speaker: "Mary",        text: "The Q2 report. You missed the deadline." },
    { speaker: "Ryan",        text: "Now you can use documentation. You know the deadline was moved. Gently bring receipts." },
    { speaker: "User_Prompt", text: "Say: 'The Q2 report. I remember the deadline was moved from April 15 to April 29 after the scope change. I delivered April 28. Can you walk me through what I missed?'" },
    { speaker: "Mary",        text: "Well, it wasn't the quality we expected." },
    { speaker: "Ryan",        text: "Classic goalpost move. Deadline became quality. Don't defend the quality — ask for the standard." },
    { speaker: "User_Prompt", text: "Say: 'Got it — so the concern is quality, not timing. What specifically was below standard, and what does the standard look like so I can match it?'" },
    { speaker: "Mary",        text: "Honestly, you're being really defensive right now." },
    { speaker: "Ryan",        text: "The pivot to you being 'defensive.' Do not apologize. Do not soften. Stay on the original ask." },
    { speaker: "User_Prompt", text: "Say: 'I'm asking for specifics on my performance — which is exactly what a review should contain. I'm not being defensive. I want to improve, and I can't improve without knowing exactly what to improve.'" },
    { speaker: "Mary",        text: "You know what, let me pull the file and we can continue this tomorrow." },
    { speaker: "Ryan",        text: "That's a retreat. Accept it — but lock the paper trail." },
    { speaker: "User_Prompt", text: "Say: 'Sounds good. I'll send an email tonight summarizing what we discussed so we're aligned for tomorrow.'" },
    { speaker: "Mary",        text: "Sure. Tomorrow then." },
    { speaker: "Ryan",        text: "Send that email. Summarize: (1) rating given, (2) vague concerns raised, (3) specific questions you asked that couldn't be answered, (4) you're awaiting specifics tomorrow. CC nobody yet. Just create the record." },
    { speaker: "Ryan",        text: "Narcissist boss survival kit: (1) Never JADE — no Justify, Argue, Defend, Explain. Ask questions instead. (2) Document everything in writing — dates, decisions, feedback. Email after every verbal meeting summarizing. (3) Ask for criteria BEFORE starting a project, in writing, so goalposts can't move. (4) Start interviewing. Narcissist bosses don't rehabilitate in place — they pick a new target. Don't wait to be it again next quarter." }
  ]
};


// --- 4. Love Bombing Red Flags ---
SCENARIOS.darkpsych_lovebomb = {
  title: "Love Bombing Red Flags: Slow Down Safely",
  thumb: "darkpsych_date.jpg",
  category: "dark_psychology",
  difficulty: 3,
  duration_min: 10,
  demo: [
    { speaker: "Ryan",   text: "Love bombing is a pattern where someone overwhelms you with affection, attention, and promises early in a relationship — often before any real intimacy has developed. It feels incredible. That's the point." },
    { speaker: "Ryan",   text: "Love bombing isn't the same as being excited about someone new. The signature is PACE and PRESSURE — moves that would normally take months happen in weeks. Watch Daniel recognize it and slow it down without rejecting the person." },
    { speaker: "Mary",   text: "I can't stop thinking about you. Nobody has ever understood me like you do. I know it's only been two weeks but I feel like you're my soulmate." },
    { speaker: "Ryan",   text: "Flag one: 'Nobody has ever understood me like you do.' You've been on four dates. She doesn't know you well enough for that to be factually true. It's a feeling dressed as a conclusion." },
    { speaker: "Daniel", text: "I'm really enjoying getting to know you too. I want to pace this so we actually get to know each other — not just the best versions." },
    { speaker: "Ryan",   text: "Watch his move — he didn't reject her feeling, he just named his own pace. That's the template." },
    { speaker: "Mary",   text: "But I KNOW. I can feel it. Let's plan a trip next weekend. Somewhere romantic." },
    { speaker: "Ryan",   text: "Flag two: 'future-faking' — planning significant future events before a relationship foundation exists. A weekend trip at week three is fast. It's not evil. It's fast." },
    { speaker: "Daniel", text: "That's a sweet idea. I think for me, a trip together makes sense once we've spent more ordinary time together — bad days, boring evenings, the full picture. Can we circle back in a couple of months?" },
    { speaker: "Ryan",   text: "He didn't say no. He said 'not yet, and here's my reasoning.' Love bombers escalate fast to create a bond before you notice the person underneath. Slowing down is the diagnostic — if the person respects the pace, they weren't love bombing. If they escalate pressure or punish you emotionally, you have your answer." },
    { speaker: "Mary",   text: "I feel like you're pulling away. Do you not feel the same way about me?" },
    { speaker: "Ryan",   text: "Flag three: equating 'not moving at her pace' with 'not caring.' This is the test. Does he cave to avoid making her feel bad? Or does he hold his pace?" },
    { speaker: "Daniel", text: "I'm not pulling away. I like you. I'm also someone who moves at my own pace, and pressure — even loving pressure — makes me move slower, not faster. I'd rather say this now than six months in." },
    { speaker: "Ryan",   text: "Masterclass. He named the pattern without accusing her of being manipulative, and stated his pace as non-negotiable. If she's secure, she'll adjust. If she's love bombing, this is where she'll either withdraw coldly or escalate harder. Both answers are useful information." }
  ],
  practice: [
    { speaker: "Ryan",        text: "You've been on three dates with Mary. She's intense — in a flattering way. You want to see if this is real interest or love bombing. Your tool: slow down and watch the response. This takes courage because it feels like you're risking a 'good thing.'" },
    { speaker: "Mary",        text: "I know this is crazy, but I think you might be the one. I've never felt this connected to anyone." },
    { speaker: "Ryan",        text: "Do not match her intensity to be nice. Don't reject the feeling. Name your pace." },
    { speaker: "User_Prompt", text: "Say: 'I'm really enjoying getting to know you. I want to pace this carefully — feelings that strong this fast make me want to slow down, not speed up.'" },
    { speaker: "Mary",        text: "Why slow down? Life is short. When you know, you know." },
    { speaker: "Ryan",        text: "Classic love bomber script. Don't argue philosophy. Stay on YOUR pace." },
    { speaker: "User_Prompt", text: "Say: 'Maybe. For me, knowing comes after I've seen someone's ordinary — not just their best version. That takes time.'" },
    { speaker: "Mary",        text: "So you don't trust me? Or your own feelings?" },
    { speaker: "Ryan",        text: "She's framing pacing as lack of trust. That's manipulation. Don't apologize for having a pace." },
    { speaker: "User_Prompt", text: "Say: 'Trust isn't the issue. I trust the time it takes to actually know someone. I'd rather be boring and certain than exciting and wrong.'" },
    { speaker: "Mary",        text: "Okay. Well, I bought us concert tickets for next month. Please don't make this weird." },
    { speaker: "Ryan",        text: "She's escalating — big gestures AND emotional pressure ('don't make this weird'). Watch your move." },
    { speaker: "User_Prompt", text: "Say: 'That's really generous of you, and I appreciate the thought. Big gestures this early make me uncomfortable. Let's keep our plans casual for the next little while and see how we feel.'" },
    { speaker: "Mary",        text: "You know what, forget it. I thought you were different. I guess I was wrong about you." },
    { speaker: "Ryan",        text: "That's the test result. A secure person adjusts when you name a pace. A love bomber punishes you for not matching their intensity. Don't chase the punishment." },
    { speaker: "User_Prompt", text: "Say: 'I'm sorry you feel that way. I'm being honest about where I am. If honest pacing is a dealbreaker, that tells us both something important.'" },
    { speaker: "Mary",        text: "(silence)" },
    { speaker: "Ryan",        text: "The silence is the data. Either she comes back in a day having thought about it and wanting to pace things differently, or she disappears, or she doubles down with the same pressure. All three tell you something true." },
    { speaker: "Ryan",        text: "Four love bombing red flags to watch for: (1) Declarations of love or soulmate-level connection before intimacy has developed. (2) Big future plans — trips, moving in, meeting family — in the first month. (3) Framing YOUR pace as a lack of feeling, trust, or character. (4) Escalating pressure or punishment when you ask for space. Excitement is real. Pressure is diagnostic." },
    { speaker: "Ryan",        text: "The hardest thing about this skill: love bombing works because it feels amazing. Slowing it down is painful even when it's right. If someone's love can't survive you having a pace, it was never love — it was a tactic. Your 2am instincts know this before your 9am self wants to admit it." }
  ]
};


// --- 5. The Guilt Trip — Family Boundaries ---
SCENARIOS.darkpsych_guilt = {
  title: "The Guilt Trip: Holding Boundaries with Family",
  thumb: "darkpsych_family_dinner.jpg",
  category: "dark_psychology",
  difficulty: 4,
  duration_min: 11,
  demo: [
    { speaker: "Ryan",   text: "Guilt tripping is a manipulation tactic where someone uses fear, obligation, or guilt — psychologists call it FOG — to get you to do something you've already declined. Family members are often the most skilled at it because they've practiced on you since childhood." },
    { speaker: "Ryan",   text: "The counter is a short, warm, repeating response — no debating, no over-explaining. Every sentence you add is leverage for them. Watch Daniel decline a family event with his mother Mary." },
    { speaker: "Mary",   text: "So Daniel, we're doing Easter at the house this year. I need to know you're coming." },
    { speaker: "Daniel", text: "I won't be able to make it this year, Mom. I already have plans." },
    { speaker: "Mary",   text: "Plans? With who? More important than your family?" },
    { speaker: "Daniel", text: "Friends. And it's not about importance — I won't be at Easter. I hope it's a great day." },
    { speaker: "Ryan",   text: "Notice — he didn't tell her WHO. He didn't justify WHY. Every detail you give a guilt tripper, they use to argue the detail. Keep it short." },
    { speaker: "Mary",   text: "Your grandmother is 84. How many more Easters do you think she has?" },
    { speaker: "Ryan",   text: "The guilt escalation. FOG: Fear of loss. Obligation to a dying relative. Guilt for living your life. All packed into one sentence. This is extremely hard to hold against — but this is exactly when holding matters most." },
    { speaker: "Daniel", text: "I love Grandma. I won't be at Easter. I'll visit her separately next month." },
    { speaker: "Ryan",   text: "Watch: he acknowledged the relationship without caving on the boundary. He even offered an alternative — but on HIS terms, not hers." },
    { speaker: "Mary",   text: "This is going to break her heart. I hope you know that. I just hope you can live with yourself." },
    { speaker: "Daniel", text: "I hear that you're disappointed. I understand. I won't be at Easter." },
    { speaker: "Ryan",   text: "That's called 'Miss Manners' style — brief acknowledgment, no apology, same answer. You don't argue the emotion. You don't dispute her right to feel disappointed. You just hold." },
    { speaker: "Mary",   text: "Fine. But I want you to know how hurtful this is." },
    { speaker: "Daniel", text: "Okay. I love you. I'll talk to you this week." },
    { speaker: "Ryan",   text: "He closed warm. No groveling, no capitulating, no matching her coldness. Warmth + boundary is the hardest combination to manipulate against, because there's nothing to attack." }
  ],
  practice: [
    { speaker: "Ryan",        text: "You're Daniel. Your mom Mary is guilt-tripping you about skipping Thanksgiving. You've already decided — you're not going. The test isn't deciding — it's holding the decision through the pressure." },
    { speaker: "Mary",        text: "So I'm putting your name on the Thanksgiving list. You're coming, right?" },
    { speaker: "Ryan",        text: "Short, clear, no justification. Don't give her material to argue with." },
    { speaker: "User_Prompt", text: "Say: 'I won't be able to make it this year, Mom.'" },
    { speaker: "Mary",        text: "What? Why not? You didn't come last Christmas either. Is something wrong?" },
    { speaker: "Ryan",        text: "Don't explain. Don't list reasons. Keep it short and warm." },
    { speaker: "User_Prompt", text: "Say: 'Nothing's wrong. I just won't be at Thanksgiving this year.'" },
    { speaker: "Mary",        text: "Your father will be so disappointed. He's been asking about you." },
    { speaker: "Ryan",        text: "Emotional proxy — using Dad's feelings to move you. Acknowledge, don't cave." },
    { speaker: "User_Prompt", text: "Say: 'I'll call Dad this weekend. I won't be at Thanksgiving.'" },
    { speaker: "Mary",        text: "I don't understand what's happened to you. You used to care about this family." },
    { speaker: "Ryan",        text: "Now she's escalating to character attack. Do not defend your character. Do not argue that you 'care.' Just hold the answer." },
    { speaker: "User_Prompt", text: "Say: 'I care about the family. I won't be at Thanksgiving.'" },
    { speaker: "Mary",        text: "Your brother's flying in from Seattle. Your cousins are coming. Everyone will be asking where you are. What am I supposed to tell them?" },
    { speaker: "Ryan",        text: "Classic move — making you responsible for managing other people's reactions. That's not your job. Simple response." },
    { speaker: "User_Prompt", text: "Say: 'You can tell them I won't be there. I'll reach out to them separately if they want to catch up.'" },
    { speaker: "Mary",        text: "This is so hurtful. I don't think you understand what you're doing to me." },
    { speaker: "Ryan",        text: "The emotional floor. Acknowledge her feeling WITHOUT agreeing you've done something wrong. Warm but firm." },
    { speaker: "User_Prompt", text: "Say: 'I hear that you're hurt. I don't want to hurt you. And I won't be at Thanksgiving this year.'" },
    { speaker: "Mary",        text: "Fine. I guess I'll tell everyone you were too busy." },
    { speaker: "Ryan",        text: "Passive-aggressive parting shot. Don't bite. Warm exit." },
    { speaker: "User_Prompt", text: "Say: 'Tell them whatever feels right. I love you, Mom. I'll call you next week.'" },
    { speaker: "Mary",        text: "(sighs) Okay. Talk to you then." },
    { speaker: "Ryan",        text: "FOG framework recap — recognize the tactic before it lands. Fear ('what if something happens to Grandma'), Obligation ('you HAVE to come, you're family'), Guilt ('how could you do this to me'). The counter is the same for all three: brief acknowledgment + unchanged answer + warm close. Repeated as many times as needed." },
    { speaker: "Ryan",        text: "The thing nobody tells you about family boundaries: the first time you hold one is the worst. The guilt feels enormous. By the fifth time, it's routine. By the twentieth, your parent has adjusted and the dynamic actually improves — because they now know 'yes' means yes and 'no' means no. Uncertainty is what keeps guilt-tripping profitable. Consistency kills it." }
  ]
};

// ============================================================
// END OF EXTENDED SCENARIOS
// ============================================================
// Total: 10 new scenarios
//   - 5 interview (behavioral, salary, stress, weakness, counter)
//   - 5 dark psychology (gaslight, darvo, narc_boss, lovebomb, guilt)
//
// Note on thumbnails: filenames referenced above (e.g.
// interview_office.jpg) don't exist yet. Either generate them
// with your preferred AI image tool, or temporarily remap thumbs
// to existing files (street.jpg, museum.jpg, etc.) to avoid
// broken image placeholders in the UI.
// ============================================================
