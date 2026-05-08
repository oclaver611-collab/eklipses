window.SCENARIOS = {
  street_intro: {
    title: "Street Introduction (Demo + Practice)",
    thumb: "street.jpg",
    bg: "street_bg.jpg",
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
    title: "Beach — Cold Open",
    thumb: "beach.jpg",
    bg: "beach_bg.mp4",
    coldOpen: true,
    demo: [
      { speaker:"Ryan",   text:"Late afternoon. The beach is almost empty." },
      { speaker:"Ryan",   text:"She's been sitting there for twenty minutes. You've walked past once already." },
      { speaker:"Ryan",   text:"She noticed." },
      { speaker:"Ryan",   text:"Watch how this goes." },
      { speaker:"Daniel", text:"You look like you've been out here all day." },
      { speaker:"Mary",   text:"Since 7am. Is it that obvious?" },
      { speaker:"Daniel", text:"Only because you look completely at home. I'm Daniel." },
      { speaker:"Mary",   text:"Sofia. You always this observant or just trying something?" },
      { speaker:"Daniel", text:"Little of both, honestly." },
      { speaker:"Mary",   text:"Okay. That's actually a decent answer." },
      { speaker:"Ryan",   text:"See that? Situational. Specific. He didn't lead with her looks — he noticed something real. That's what opens a door." }
    ],
    practice: [
      { speaker:"Ryan", text:"Late afternoon. The beach is almost empty." },
      { speaker:"Ryan", text:"She's been sitting there for twenty minutes. You've walked past once already." },
      { speaker:"Ryan", text:"She noticed." },
      { speaker:"Ryan", text:"You have about thirty seconds before the moment passes for good." },
      { speaker:"Ryan", text:"What do you do?" }
    ]
  }
};
