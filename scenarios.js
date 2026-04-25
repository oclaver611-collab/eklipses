window.SCENARIOS = {
  street_intro: {
    title: "Street Introduction (Demo + Practice)",
    thumb: "street.jpg",
    // seedLikes: 3, seedViews: 42, // optional starting numbers
    demo: [
      { speaker:"Ryan",   text:"Hi, I'm Ryan, a dating coach. Watch this example conversation first." },
      { speaker:"Daniel", text:"Excuse me, hi. I hope I'm not interrupting, but I just noticed your smile and had to say hello." },
      { speaker:"Mary",   text:"Oh! That's really sweet. Hello to you too." },
      { speaker:"Daniel", text:"I'm Daniel, by the way. I know it's random, but I felt like I'd regret not introducing myself." },
      { speaker:"Mary",   text:"Nice to meet you, Daniel. I'm Mary." },
      { speaker:"Daniel", text:"So Mary, I'll be honest—I don't have a pickup line. I just thought you seemed interesting and wanted to say hi." },
      { speaker:"Mary",   text:"I appreciate the honesty. That's refreshing." },
      { speaker:"Ryan",   text:"Notice how Daniel kept it respectful and genuine. Now it's your turn to practice!" }
    ],
    practice: [
      { speaker:"Ryan",        text:"Now YOU will be Daniel. I'll show you what to say, and Mary will respond. Ready?" },
      { speaker:"User_Prompt", text:"Say: 'Excuse me, hi. I hope I'm not interrupting, but I just noticed your smile and had to say hello.'" },
      { speaker:"Mary",        text:"Oh! That's really sweet. Hello to you too." },
      { speaker:"User_Prompt", text:"Say: 'I'm Daniel, by the way. I know it's random, but I felt like I'd regret not introducing myself.'" },
      { speaker:"Mary",        text:"Nice to meet you, Daniel. I'm Mary." },
      { speaker:"User_Prompt", text:"Say: 'So Mary, I'll be honest—I don't have a pickup line. I just thought you seemed interesting and wanted to say hi.'" },
      { speaker:"Mary",        text:"I appreciate the honesty. That's refreshing." },
      { speaker:"User_Prompt", text:"Say: 'Would you be open to grabbing a coffee sometime?'" },
      { speaker:"Mary",        text:"Yeah, I think I would. That sounds nice." },
      { speaker:"Ryan",        text:"Excellent work! You've completed the practice. Want to try a new scenario?" }
    ]
  },

  beach: {
    title: "Scenario2: dating on the beach",
    thumb: "beach.jpg",
    bg: "beach_bg.jpg",
    demo: [
      { speaker:"Ryan",   text:"New scenario: you're on a quiet beach path. Watch and listen first." },
      { speaker:"Daniel", text:"Hey, sorry to bother you—I'm heading for an iced coffee and your beach hat is iconic. Had to say hello." },
      { speaker:"Mary",   text:"Ha! Thanks. It keeps me from burning." },
      { speaker:"Daniel", text:"I'm Daniel, by the way. Are you local?" },
      { speaker:"Mary",   text:"Sort of. I moved here last year." },
      { speaker:"Ryan",   text:"See? Light, friendly, and context-aware." }
    ],
    practice: [
      { speaker:"Ryan",        text:"Your turn to be Daniel. Ready?" },
      { speaker:"User_Prompt", text:"Say: 'Hey, I’m grabbing an iced coffee and your beach hat is iconic—had to say hello.'" },
      { speaker:"Mary",        text:"Thanks! It’s been a lifesaver." },
      { speaker:"User_Prompt", text:"Say: 'I’m Daniel—are you from around here?'" },
      { speaker:"Mary",        text:"Kind of. Moved here last year." },
      { speaker:"User_Prompt", text:"Say: 'If you have a minute later, want to walk to the pier and chat?'" },
      { speaker:"Mary",        text:"That could be fun." }
    ]
  },

  bar: {
    title: "Scenario3: dating at bar",
    thumb: "bar.jpg",
    demo: [
      { speaker:"Ryan",   text:"New scenario: a busy bar, moderate noise. Watch the flow first." },
      { speaker:"Daniel", text:"Hey—quick question. Do you think that neon sign is ironically cool, or just bad?" },
      { speaker:"Mary",   text:"Haha, a little of both." },
      { speaker:"Daniel", text:"I'm Daniel. If this is random, blame the neon." },
      { speaker:"Mary",   text:"I'm Mary. You’re forgiven." },
      { speaker:"Ryan",   text:"Playful opener acknowledged, then names." }
    ],
    practice: [
      { speaker:"Ryan",        text:"Your turn!" },
      { speaker:"User_Prompt", text:"Say: 'Is that neon sign ironically cool, or just bad?'" },
      { speaker:"Mary",        text:"Maybe both." },
      { speaker:"User_Prompt", text:"Say: 'I'm Daniel—if this is random, blame the neon.'" },
      { speaker:"Mary",        text:"I'm Mary. Forgiven." },
      { speaker:"User_Prompt", text:"Say: 'Want to grab a quieter corner to talk?'" },
      { speaker:"Mary",        text:"Sure, why not." }
    ]
  },

  museum: {
    title: "Scenario4: dating at the museum",
    thumb: "museum.jpg",
    demo: [
      { speaker:"Ryan",   text:"New scenario: a museum gallery—quiet tone." },
      { speaker:"Daniel", text:"Hey—sorry, quick thought. That sculpture looks like it wants a nap." },
      { speaker:"Mary",   text:"Ha! Totally. Relatable." },
      { speaker:"Daniel", text:"I'm Daniel—do you have a favorite room here?" },
      { speaker:"Mary",   text:"The Impressionists." },
      { speaker:"Ryan",   text:"Observe the gentle volume and shared focus." }
    ],
    practice: [
      { speaker:"Ryan",        text:"Your turn." },
      { speaker:"User_Prompt", text:"Say: 'That sculpture looks like it wants a nap.'" },
      { speaker:"Mary",        text:"It really does." },
      { speaker:"User_Prompt", text:"Say: 'I'm Daniel—what's your favorite room?'" },
      { speaker:"Mary",        text:"Impressionists." },
      { speaker:"User_Prompt", text:"Say: 'Want to loop back there and chat more?'" },
      { speaker:"Mary",        text:"Sure." }
    ]
  }
};

// === New Scenario: Wedding Reception ===
SCENARIOS.wedding = {
  title: "Wedding Reception — Warm Approach",
  thumb: "wedding.jpg",
  demo: [
    { speaker: "Ryan",   text: "Watch this smooth, respectful intro at a wedding." },
    { speaker: "Daniel", text: "Hey—congrats to the happy couple! I’m Daniel. How do you know them?" },
    { speaker: "Mary",   text: "Hi Daniel! I’m Mary—college friend of the bride. You?" },
    { speaker: "Daniel", text: "Groom’s coworker. I almost didn’t come, but I’m glad I did." },
    { speaker: "Mary",   text: "Same. The music’s great tonight." },
    { speaker: "Ryan",   text: "Notice how Daniel opened with context and a light question." }
  ],
  practice: [
    { speaker: "Ryan",        text: "Your turn! Read the line out loud when prompted." },
    { speaker: "User_Prompt", text: "Say: 'Hey—congrats to the happy couple! I’m Daniel. How do you know them?'" },
    { speaker: "Mary",        text: "Hi Daniel! I’m Mary—college friend of the bride. You?" },
    { speaker: "User_Prompt", text: "Say: 'Groom’s coworker. I almost didn’t come, but I’m glad I did.'" },
    { speaker: "Mary",        text: "Same. The music’s great tonight." },
    { speaker: "Ryan",        text: "Nice! You kept it warm and situational. Want to try another?" }
  ]
};

// === Bookstore Encounter — Shared Curiosity (Extended Edition) ===
SCENARIOS.bookstore_extended = {
  title: "Bookstore Encounter — Shared Curiosity (Extended Edition)",
  thumb: "bookstore.jpg",
  demo: [
    { speaker:"Ryan",   text:"You’re in a cozy downtown bookstore. Low jazz playing, soft lamp lighting, smell of old paper. You notice a woman browsing the same shelf — psychology and philosophy." },
    { speaker:"Ryan",   text:"This one’s about micro-progressions — small, stacked wins. Watch how Daniel moves from curiosity to connection." },
    { speaker:"Daniel", text:"Hey—sorry, random question. Have you read this one before? ‘The Courage to Be Disliked’? The title feels like a trap." },
    { speaker:"Mary",   text:"Haha, yeah—it’s intense but surprisingly optimistic. Why? You thinking of buying it?" },
    { speaker:"Daniel", text:"Mostly pretending to be intellectual. But yeah, maybe." },
    { speaker:"Mary",   text:"Well, fake it till you make it, right?" },
    { speaker:"Daniel", text:"Exactly! I’m Daniel, by the way." },
    { speaker:"Mary",   text:"Mary. Nice to meet a fellow overthinker." },
    { speaker:"Daniel", text:"Guilty. Are you more of a psychology reader or fiction escapist?" },
    { speaker:"Mary",   text:"Bit of both. Depends on how chaotic life feels that week." },
    { speaker:"Ryan",   text:"Notice the easy rhythm — humor, curiosity, and then a light personal hook." },
    { speaker:"Daniel", text:"So… if you had to recommend one book to restore someone’s faith in humanity, what would it be?" },
    { speaker:"Mary",   text:"Oof, that’s tough. Maybe ‘Man’s Search for Meaning.’ Classic." },
    { speaker:"Daniel", text:"That’s a deep cut. I respect it. Also, you officially raised the bar." },
    { speaker:"Ryan",   text:"Here Daniel adds a playful compliment — confident but not needy. Now watch what happens when he stumbles." },
    { speaker:"Daniel", text:"So, uh, do you come here often?—wow, that sounded so cliché." },
    { speaker:"Mary",   text:"Haha! It did, but I’ll let you recover." },
    { speaker:"Daniel", text:"Redemption arc activated. What’s your go-to escape aisle, then?" },
    { speaker:"Mary",   text:"Cookbooks. But mostly to look at the pictures." },
    { speaker:"Ryan",   text:"He made a mistake, owned it with humor, and kept momentum. Perfect recovery." },
    { speaker:"Daniel", text:"Tell you what, I’ll buy this one if you promise to tell me later if it’s life-changing or just shelf decor." },
    { speaker:"Mary",   text:"Deal. But only if you don’t judge my next pick." },
    { speaker:"Daniel", text:"No promises. I’m a harsh critic of book covers." },
    { speaker:"Mary",   text:"Ha! Okay, critic. Maybe we’ll run into each other here again." },
    { speaker:"Ryan",   text:"Smooth close — mutual joke, subtle invitation. Let’s break it down." },
    { speaker:"Ryan",   text:"Key lessons: 1️⃣ Curiosity is the ultimate icebreaker. 2️⃣ Self-awareness beats perfection. 3️⃣ Keep it playful, not performative." },
    { speaker:"Ryan",   text:"Now, your turn to practice the full progression — with new challenges." }
  ],
  practice: [
    { speaker:"Ryan", text:"Ready? Picture it: quiet bookstore, scent of coffee from the small café corner. You spot her — same shelf." },
    { speaker:"Ryan", text:"Start light. Open with curiosity." },
    { speaker:"User_Prompt", text:"Say: 'Hey—have you read this one before? The title feels like it’s judging me already.'" },
    { speaker:"Mary", text:"Haha, yeah—it’s one of those self-help-but-not-self-help books." },
    { speaker:"Ryan", text:"Good! You got her to smile. Keep the humor going — micro-win." },
    { speaker:"User_Prompt", text:"Say: 'Good to know. I was pretending to be deep for Instagram anyway.'" },
    { speaker:"Mary", text:"Ha! You’re honest, I’ll give you that." },
    { speaker:"Ryan", text:"Nice. You built early rapport. Now level up — add a personal touch." },
    { speaker:"User_Prompt", text:"Say: 'I’m Daniel, by the way. You seem like you actually finish the books you buy.'" },
    { speaker:"Mary", text:"Guilty as charged. You?" },
    { speaker:"Ryan", text:"Great. She’s engaged. Now, challenge moment — she’s checking her phone. You have 20 seconds." },
    { speaker:"User_Prompt", text:"Say: 'Okay, you’ve got two seconds: recommend me one book that actually changed your life.'" },
    { speaker:"Mary", text:"Whoa, deep question. Probably ‘Man’s Search for Meaning.’" },
    { speaker:"Ryan", text:"Perfect — deeper layer unlocked. She shared something meaningful. Now choose your path:" },
    { speaker:"Ryan", text:"Choice Point: A) Tease lightly, or B) Ask why that book matters to her." },
    { speaker:"User_Prompt", text:"Freestyle: (Choose your response freely)" },
    { speaker:"Mary", text:"Interesting take. I like how you think." },
    { speaker:"Ryan", text:"Nice — you’re holding conversational frame. Next, plot twist — her friend shows up." },
    { speaker:"Mary", text:"Hey, this is my friend Jenna—she’s hunting for poetry books." },
    { speaker:"Ryan", text:"Adapt fast — show social grace." },
    { speaker:"User_Prompt", text:"Say: 'Nice to meet you, Jenna. Any chance you’ll save me from bad poetry recommendations?'" },
    { speaker:"Mary", text:"Haha! Don’t get her started!" },
    { speaker:"Ryan", text:"You diffused the interruption — smooth handling. Micro-progression achieved." },
    { speaker:"Ryan", text:"Now, mini-twist — she accidentally bumps your arm, small coffee spill." },
    { speaker:"Mary", text:"Oh no, I’m so sorry!" },
    { speaker:"User_Prompt", text:"Say: 'No worries, I needed a caffeine tattoo anyway.'"},
    { speaker:"Mary", text:"Hah! You’re quick. I owe you a napkin and maybe a coffee." },
    { speaker:"Ryan", text:"Perfect tension reset — humor turned an accident into bonding. You’re leveling up fast." },
    { speaker:"Ryan", text:"Next — vulnerability checkpoint. Show a hint of real personality." },
    { speaker:"User_Prompt", text:"Say: 'Honestly, bookstores are my therapy. No Wi-Fi, no pressure, just stories that don’t ghost you.'" },
    { speaker:"Mary", text:"That’s… actually kind of beautiful." },
    { speaker:"Ryan", text:"Boom. Emotional resonance achieved. Now bring it home — final test." },
    { speaker:"Mary", text:"I should probably go meet my friend. She’s waiting by the register." },
    { speaker:"Ryan", text:"You’ve got 30 seconds. Close naturally — don’t overthink it." },
    { speaker:"User_Prompt", text:"Say: 'Totally. Tell you what, next time we both pretend to be intellectuals here again, I’ll buy the coffee.'" },
    { speaker:"Mary", text:"Deal. I’ll hold you to that, book philosopher." },
    { speaker:"Ryan", text:"You did it — full emotional arc: curiosity → comfort → connection → close." },
    { speaker:"Ryan", text:"💡 Pro Moves Unlocked: (1) Turn mistakes into jokes. (2) Ask questions that feel spontaneous. (3) End with a callback — it creates closure." },
    { speaker:"Ryan", text:"If you replay this, experiment with different tones — confident, playful, or calm curiosity. Mastery is variation." }
  ]
};

// === Gym Sparks — The Unplanned Spot ===
SCENARIOS.gym_sparks = {
  title: "Gym Sparks — The Unplanned Spot",
  thumb: "gym.jpg",
  demo: [
    { speaker: "Ryan", text: "Scenario: a crowded gym, late afternoon. Music pumps, weights clank. You notice her struggling slightly on her last rep." },
    { speaker: "Daniel", text: "Need a spot?" },
    { speaker: "Mary", text: "Oh—uh, yeah, thanks! I thought I had it… almost." },
    { speaker: "Daniel", text: "You did great. For the record, ‘almost’ counts as a solid 9.5 out of 10." },
    { speaker: "Mary", text: "Haha, I’ll take that. Do you give ratings to everyone who lifts near you?" },
    { speaker: "Daniel", text: "Only the ones who actually finish the set." },
    { speaker: "Mary", text: "Touché." },
    { speaker: "Daniel", text: "So what’s your favorite form of gym torture—legs, cardio, or pretending to stretch while actually recovering?" },
    { speaker: "Mary", text: "Definitely option three. You?" },
    { speaker: "Daniel", text: "Recovering, obviously. But I disguise it as 'deep focus mode' so people think I’m meditating." },
    { speaker: "Mary", text: "Right. The classic 'gym philosopher' pose." },
    { speaker: "Daniel", text: "Exactly. And speaking of philosophy—ever notice how nobody here makes eye contact, but everyone secretly hopes someone will?" },
    { speaker: "Mary", text: "(smiling) Maybe they’re just waiting for the right spotter." },
    { speaker: "Ryan", text: "Notice how Daniel keeps it light and self-aware. He plays off her energy and never over-explains. That balance is key." },
    { speaker: "Ryan", text: "Now it’s your turn. Same setting. See if you can build chemistry while keeping it fun, grounded, and respectful." }
  ],
  practice: [
    { speaker: "Ryan", text: "Okay—you walk into the gym. You spot her between sets. Let’s start simple." },
    { speaker: "User_Prompt", text: "Say: 'Need a spot?'" },
    { speaker: "Mary", text: "Oh—sure, that’d be great!" },
    { speaker: "User_Prompt", text: "Say: 'You’ve got this—last rep, come on!'" },
    { speaker: "Mary", text: "Whew… okay, maybe I needed that. Thanks!" },
    { speaker: "Ryan", text: "Good. Now transition from helping to casual chat—no interrogation, just vibe." },
    { speaker: "User_Prompt", text: "Say: 'Do you come here often or just here for the torture session?'" },
    { speaker: "Mary", text: "Ha! Depends on how you define torture." },
    { speaker: "Ryan", text: "Nice. Keep it flowing—light teasing works well here." },
    { speaker: "User_Prompt", text: "Say: 'So what’s your go-to recovery ritual—protein shake or pretending to stretch?'" },
    { speaker: "Mary", text: "Honestly? Scrolling memes. Pure athletic recovery." },
    { speaker: "Ryan", text: "She’s laughing. You’re in sync. Now raise the stakes slightly—show curiosity without turning serious." },
    { speaker: "User_Prompt", text: "Say: 'You seem pretty dedicated. Ever competed or just love the grind?'" },
    { speaker: "Mary", text: "Actually… I used to. Stopped after an injury. Getting back into it now." },
    { speaker: "Ryan", text: "Good—acknowledge vulnerability, don’t pry." },
    { speaker: "User_Prompt", text: "Say: 'Respect. Getting back up is the hardest lift there is.'" },
    { speaker: "Mary", text: "(smiling softly) That’s actually… a good line." },
    { speaker: "Ryan", text: "Perfect. You created a moment. But now—interruption. Her friend waves from across the room." },
    { speaker: "Mary", text: "That’s my cue for cardio, I guess." },
    { speaker: "Ryan", text: "This is your final test—make your move naturally." },
    { speaker: "User_Prompt", text: "Say: 'Then I guess I’ll see you during your next recovery stretch?'" },
    { speaker: "Mary", text: "Haha, deal. Same time tomorrow?" },
    { speaker: "Ryan", text: "Smooth, confident, respectful. You left on a high note—and earned the next encounter." },
    { speaker: "Ryan", text: "Pro tip: Great gym conversations are about rhythm and timing. Talk like you train—short, focused, and with purpose." }
  ]
};
