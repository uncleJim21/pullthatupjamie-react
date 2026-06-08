// Tape skin — per-company Read In fixtures.
//
// Hand-curated: clip ids are real quotes captured from /api/search-quotes via
// /tmp/tape_app.py; ticker prices come from /tmp/tape_app_tickers.py (Yahoo).
// Add a new company by appending another entry to COMPANIES and mockReadIn
// will dispatch by ticker.

import type { ReadInResult } from '../services/tape/tapeTypes.ts';

const APP_RESULT: ReadInResult = {
  ticker: "APP",
  name: "AppLovin Corp",
  sectorTag: "SOFTWARE \u00b7 ADTECH",
  yahoo: "APP",
  whatTheyDo: "AppLovin is a mobile-app advertising platform. The engine is AXON 2, an in-house machine-learning ad system that ranks and serves ads inside other companies' mobile apps (most of them games). App developers plug in to acquire users; AppLovin takes a cut of the ad spend.\n\nTwo narratives drove the multi-bagger run in 2024-2025: (1) AXON 2 became the mid-cap pure-play on AI ad monetization, often mentioned alongside Meta and Google; (2) the company joined the S&P 500 in September 2024, forcing benchmark buyers in. The next leg of the bull case is expanding from gaming ads into the much larger e-commerce ad pool.\n\nThe short side is loud: Muddy Waters and Fuzzy Panda put out reports in early 2025 questioning the revenue model and ad-quality practices; Bloomberg subsequently reported the SEC was probing how AppLovin mediates certain transactions; and Q3 2025 earnings included a revenue-forecast cut and a delayed customer contract.",
  pulse: {
    bullLine: "AXON 2 is one of the cleanest pure-play AI-monetization stories in mid-cap tech, a multi-bagger on the back of mobile-ad targeting.",
    bearLine: "Concentration in mobile-gaming ad spend, an SEC inquiry hanging over the revenue model, and a Muddy Waters short report nobody has cleanly refuted.",
    priceAction: "Up sharply over the last 18 months, still well above the post-short-report lows; volatile around earnings.",
    marqueeCitation:     {
      pineconeId: "f5d08f4f-4184-461a-933c-ad65230eb5e0_p3",
      text: "Every few years a new ad channel opens before the market catches on. That's Axon AI right now, the AI ad platform behind one of the biggest runs in tech with access to over a billion daily active users. Full screen video ads in mobile games watched for a median of 35 seconds. Businesses are profitably spending hundreds of thousands of dollars a day on it and most advertisers don't even know it exists yet. The window is Open at Axon AI Allin all in Silicon Valley.",
      episodeTitle: "Charles & Chase Koch on How They Quietly Built a $150B Empire",
      creator: "All-In with Chamath, Jason, Sacks & Friedberg",
      episodeImage: "https://static.libsyn.com/p/assets/0/a/f/e/0afe1ed26eaee8a516c3140a3186d450/1_Koch_Pod.png",
      audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/1015378/f5d08f4f-4184-461a-933c-ad65230eb5e0.mp3",
      startTime: 38.43,
      endTime: 64.81,
      publishedDate: "2026-05-12T21:03:00.000Z",
    },
  },
  uvp: {
    summary: "AXON 2 is the moat. Three reinforcing assets: a proprietary ML ad-targeting engine, a first-party data set spanning over a billion daily mobile users via SDKs embedded in thousands of apps, and vertical integration with Lion Studios' own games feeding the model. The flywheel: more ad spend, better model, tighter targeting, more spend.",
    citations: [
      {
        pineconeId: "65648533-c855-4cfd-92ae-300eebbf0163_p4",
        text: "That's axon.ai right now. The AI ad platform behind one of the biggest runs in tech with access to over a billion daily active users. Full screen video ads in mobile games watched for a median of thirty five seconds. Businesses are profitably spending hundreds of thousands of dollars a day on it and most advertisers don't even know it exists yet. The window is open at axon.ai/allin.",
        episodeTitle: "The Companies Changing Warfare Forever: Palantir & Anduril Execs on Drones, AI & the Future of War",
        creator: "All-In with Chamath, Jason, Sacks & Friedberg",
        episodeImage: "https://static.libsyn.com/p/assets/7/a/6/1/7a61a2a17e8bf93316c3140a3186d450/1_Pod_Palantir_Anduril.png",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/1015378/65648533-c855-4cfd-92ae-300eebbf0163.mp3",
        startTime: 33.36,
        endTime: 53.88,
        publishedDate: "2026-04-06T12:51:00.000Z",
      },
    ],
  },
  strategy: {
    summary: "Two prongs. Defend and grow the cash cow by keeping monetizing mobile-gaming inventory where AXON dominates. Then pivot the same engine into e-commerce ads, a TAM many times larger than gaming. On the capital side, aggressive buybacks have been steadily reducing the float.",
    citations: [
      {
        pineconeId: "675e48b4-216a-11f1-8720-b7c7e07c9c4a_p274",
        text: "We're using an AI engine to serve up these ads and we're improving kind of the return for our clients. Why don't we start putting in lipstick or actual goods? And monetize our ads differently. Okay. And so that whole story of we're not only going to show you games to be downloaded inside of games.",
        episodeTitle: "Why Bubble Talk is Totally Wrong with Ankur Crawford",
        creator: "The Compound and Friends",
        episodeImage: "https://megaphone.imgix.net/podcasts/c0f06420-11e1-11ee-a510-23f565a6b03e/image/b3d6e0a8116d0a9d7b3ca47e27d801b1.jpg?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/743660/675e48b4-216a-11f1-8720-b7c7e07c9c4a.mp3",
        startTime: 4322.13,
        endTime: 4343.01,
        publishedDate: "2026-04-17T09:01:00.000Z",
      },
    ],
  },
  leadership: {
    summary: "Founder-led. Adam Foroughi has been CEO since co-founding the company in 2012. Heavy insider ownership and a dual-class share structure keep control with the founders, a setup the market typically pays a premium for and a structural bull-side argument.",
    facts: [
      { label: "CEO", value: "Adam Foroughi" },
      { label: "Since", value: "2012 (co-founder)" },
      { label: "Insider ownership", value: "~7%" },
      { label: "Structure", value: "Dual-class, founder-led" },
    ],
  },
  financials: {
    headline: [
      { label: "Revenue (TTM)", value: "~$5.4B" },
      { label: "Revenue growth (YoY)", value: "~40%" },
      { label: "Adj. EBITDA margin", value: "~70%" },
      { label: "Free cash flow (TTM)", value: "~$2.8B" },
      { label: "Net debt / EBITDA", value: "~0.5x" },
    ],
    note: "Compounding ~20%/yr per investor commentary; FCF margin among the best in mid-cap software.",
  },
  smartMoney: {
    bulls: [
      {
        pineconeId: "057cd2ee-2a96-11f0-ab51-f74810753ded_p123",
        text: "This is my highest conviction position. How you like me now? App Loven is up 60% off the lows. I don't know their user base. I just know that this is online games and their ad business is interwoven with online games.",
        episodeTitle: "The COUGRs Trade Takes Wall Street, America Downgraded by Moodys, Walmart vs Trump",
        creator: "The Compound and Friends",
        episodeImage: "https://megaphone.imgix.net/podcasts/c0f06420-11e1-11ee-a510-23f565a6b03e/image/b3d6e0a8116d0a9d7b3ca47e27d801b1.jpg?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/743660/057cd2ee-2a96-11f0-ab51-f74810753ded.mp3",
        startTime: 2170.95,
        endTime: 2187.59,
        publishedDate: "2025-05-20T23:09:00.000Z",
      },
      {
        pineconeId: "f47fcd4b-83ac-48ac-a4b4-9b52ffa5767d_p83",
        text: "Number one, revenue growth. A lot of the Mag 7 is driven by advertising, and AI plus advertising is amazing. We've seen this with App Loven. We've seen this with Meta. Google's doing it using a massive self-learning LLM to target 30,000 times more effectively than the old CPU-based systems.",
        episodeTitle: "Top 5 of 2025: #4: Alex Sacerdote",
        creator: "Capital Allocators \u2013 Inside the Institutional Investment Industry",
        episodeImage: "https://static.libsyn.com/p/assets/f/b/7/6/fb76e1c8bfb69e8dd959afa2a1bf1c87/CA_Square_logo_light_background_6.26.24.jpg",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/222998/f47fcd4b-83ac-48ac-a4b4-9b52ffa5767d.mp3",
        startTime: 2327.33,
        endTime: 2349.65,
        publishedDate: "2025-12-22T08:00:00.000Z",
      },
      {
        pineconeId: "152998c8-e8e4-11f0-b4e2-0ba2b49a8c97_p52",
        text: "So I sense that there's some pretty good downside protection for a company that's compounding earnings at 20% a year. And I don't think, and I don't think we need to speculate that AI is going to continue to improve their algorithms, leading to more engagement, better results for advertisers. And they're still in the very early innings of monetizing WhatsApp, which has over 3 billion monthly active users. So, yeah, we'll see how these play out. But yeah, those are some picks that I'm pretty excited about.",
        episodeTitle: "TIP781: My Portfolio & Current Market Conditions w/ Clay Finck & Stig Brodersen",
        creator: "The Investor's Podcast (We Study Billionaires) - The Investor\u2019s Podcast Network",
        episodeImage: "https://megaphone.imgix.net/podcasts/152998c8-e8e4-11f0-b4e2-0ba2b49a8c97/image/6378120560c2fcf8db0fc3746cf18f08.jpg?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/793331/152998c8-e8e4-11f0-b4e2-0ba2b49a8c97.mp3",
        startTime: 1558.95,
        endTime: 1587.51,
        publishedDate: "2026-01-04T01:00:00.000Z",
      },
      {
        pineconeId: "675e48b4-216a-11f1-8720-b7c7e07c9c4a_p273",
        text: "I need another hour with you guys. So with App Loven, they're basically an advertising company. And what they realized is that they have a lot of data. They have probably 50% share of served ads and mobile games. And what they realized is, you know what, we're pretty good at this.",
        episodeTitle: "Why Bubble Talk is Totally Wrong with Ankur Crawford",
        creator: "The Compound and Friends",
        episodeImage: "https://megaphone.imgix.net/podcasts/c0f06420-11e1-11ee-a510-23f565a6b03e/image/b3d6e0a8116d0a9d7b3ca47e27d801b1.jpg?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/743660/675e48b4-216a-11f1-8720-b7c7e07c9c4a.mp3",
        startTime: 4304.69,
        endTime: 4321.97,
        publishedDate: "2026-04-17T09:01:00.000Z",
      },
    ],
    bears: [
      {
        pineconeId: "1e95d348-cf9c-4be7-b2c5-b36f01122642_p27",
        text: "And Applovin typically charges a fee in mediating that transactions. So go going on to the SEC prop or potential SEC prop rather because nothing is confirmed as of now. S SEC allegedly is looking into its data collection practices. And and, you know, there was a a couple of links made to short seller reports, that surfaced back in February, and that was also around the com the company business practices, particularly in its, inflation of app installation numbers. And, actually, you know, in addition to this SEC probe or potential SEC probe rather, there was a class action lawsuit filed in March, and and and it's it's it could advance the trial according to our litigation analyst, Matthew, based in Washington, DC.",
        episodeTitle: "Dell Hikes Estimates for Next Four Years on Strong AI Demand",
        creator: "Bloomberg Intelligence",
        episodeImage: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/7f534b8c-9e91-429a-b102-ae3c00090c6d/0ad812bf-fd15-4012-a18c-ae3c00090c76/image.jpg?t=1750939420&size=Large",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/4143163/1e95d348-cf9c-4be7-b2c5-b36f01122642.mp3",
        startTime: 599.86,
        endTime: 650.66,
        publishedDate: "2025-10-07T16:50:23.000Z",
      },
      {
        pineconeId: "c4dc1cd4-d358-11ef-a25c-8f6756920620_p70",
        text: "Essentially, what happened in these earnings was they lowered a revenue forecast, which is a little scary. And then there was a delay in fulfilling a customer contract, which is also a little scary because it suggests that they can't keep up in this race of a build out. Again, if you're building stuff, this is not a huge surprise. Like everybody who is familiar with construction schedules knows that you could have the best contractor in the world. It just rains for like two weeks and there's nothing you can do.",
        episodeTitle: "The company at the heart of the AI bubble",
        creator: "Decoder with Nilay Patel",
        episodeImage: "https://megaphone.imgix.net/podcasts/c4dc1cd4-d358-11ef-a25c-8f6756920620/image/835c887f9468ed2995e0c930dabf92b2.jpg?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/2123/c4dc1cd4-d358-11ef-a25c-8f6756920620.mp3",
        startTime: 1629.58,
        endTime: 1656.38,
        publishedDate: "2025-11-13T14:30:00.000Z",
      },
      {
        pineconeId: "e767e8e0-9153-48f0-a811-dc007e73e88c_p47",
        text: "So there's two sort of questionable ingredients to the revenue model here. But on the other side, the revenue growth we've seen to date is actually real. It is incredibly rapid. The number of customers here are enormous. And some of the upside here is really large too.",
        episodeTitle: "AI Bubble, Inflation, and the Limits of Monetary Policy | Jason Furman",
        creator: "Hidden Forces",
        episodeImage: "https://static.libsyn.com/p/assets/5/3/8/c/538c7b5356701516e5bbc093207a2619/New_HF_Logo.jpeg",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/203667/e767e8e0-9153-48f0-a811-dc007e73e88c.mp3",
        startTime: 1588.75,
        endTime: 1610.11,
        publishedDate: "2025-12-15T09:00:00.000Z",
      },
    ],
  },
  catalysts: [
    { date: "2024-09-23", label: "Joined the S&P 500. Forced index buying lifted the float." },
    { date: "2025-02-26", label: "Muddy Waters and Fuzzy Panda short reports trigger a sharp selloff." },
    { date: "2025-08-28", label: "Q2 earnings in-line, not a beat-and-raise; Bloomberg flags fuzziness in the numbers." },
    { date: "2025-10-07", label: "Bloomberg reports the SEC is probing how the company mediates transaction fees." },
    { date: "2025-11-13", label: "Q3: lowered revenue forecast, delayed customer contract (per Decoder coverage)." },
  ],
  peers: ["GOOGL", "META", "TTD", "U", "PUBM"],
  risks: [
    "Revenue-source concentration in mobile gaming and a handful of programmatic partners.",
    "Short-seller scrutiny (Muddy Waters, Fuzzy Panda) and SEC inquiry overhang.",
    "Mobile-ad cycle exposure and ATT/iOS privacy headwinds.",
    "Execution risk on the e-commerce ads expansion: early and unproven at scale.",
    "AXON edge could erode as Meta and Google iterate on their own ad-ML stacks.",
  ],
  generatedAt: new Date().toISOString(),
};

const COMPANIES: Record<string, ReadInResult> = { APP: APP_RESULT };

export function mockReadIn(ticker: string): ReadInResult {
  const t = ticker.trim().toUpperCase();
  return (
    COMPANIES[t] || {
      ticker: t,
      name: '',
      sectorTag: '',
      yahoo: t,
      whatTheyDo: '',
      pulse: {
        bullLine: '',
        bearLine: '',
        priceAction: '',
        marqueeCitation: {
          pineconeId: '', text: '', episodeTitle: '', creator: '',
          episodeImage: '', audioUrl: '', startTime: 0, endTime: 0, publishedDate: '',
        },
      },
      smartMoney: { bulls: [], bears: [] },
      catalysts: [],
      peers: [],
      risks: [],
      generatedAt: new Date().toISOString(),
    }
  );
}
