// Tape skin — fixtures baked from REAL /api/search-quotes + /api/corpus/people output.
//
// HIGH-CONFIDENCE attribution despite no diarization: dossier + Arc quotes are
// pulled ONLY from guest-dominant episodes (1-on-1 interviews / keynotes), never
// panels or rotating anchor desks. The Arc traces one person's thesis over time
// with a conviction read taken from the LANGUAGE of each quote (not a market
// score). See docs/tape-api.md for the method + the diarization caveat.

import type {
  TapeCitation, DossierResult, TimelineResult, TimelineBucket,
  TimelineDrilldownResult, BriefResult, SplitResult,
  NarrativeResult, NarrativeInput,
} from '../services/tape/tapeTypes.ts';
import {
  TICKERS_ARC_GROMEN, TICKERS_DOSSIER_ELERIAN, TICKERS_DOSSIER_GREEN,
  TICKERS_BRIEF_OIL, TICKERS_SPLIT_AI,
} from './mockTapeTickers.ts';

// Symbol-only views of each baked ticker set, matching the backend's
// `synthesize.tickers: string[]` shape. Canon fixtures use these so canon-hit
// results render the strip without an extra round trip.
const SYM_ARC_GROMEN = TICKERS_ARC_GROMEN.map(t => t.yahoo);
const SYM_DOSSIER_ELERIAN = TICKERS_DOSSIER_ELERIAN.map(t => t.yahoo);
const SYM_DOSSIER_GREEN = TICKERS_DOSSIER_GREEN.map(t => t.yahoo);
const SYM_BRIEF_OIL = TICKERS_BRIEF_OIL.map(t => t.yahoo);
const SYM_SPLIT_AI = TICKERS_SPLIT_AI.map(t => t.yahoo);

const slug = (s: string) => s.trim().toLowerCase();

const DOSSIERS: Record<string, DossierResult> = {
  "el-erian": {
    person: "Mohamed El-Erian",
    topics: [
      {
        topic: "Inflation and the Fed",
        positionSummary: "El-Erian's core warning: the Fed cannot afford to look through inflation again the way it did in 2021, and the fight against it has stalled rather than ended.",
        citations: [
          {
            pineconeId: "971334dc-fb84-11ef-b10d-5f7c5528ba91_p63",
            text: "The Fed is not going to look through the inflation problem because last time it looked through it in 2021, it made a major mistake. And you will hear over and over the experience of the 70s, the experience of the 70s. Be careful, because if you don't, if you let the inflation genie out of the bottle, when people have a recent history of inflation, then how inflation-prone the economy is goes up significantly. I want to go one notch deeper on the inflation stalling out situation because, you know, obviously we've seen most of the disinflation has occurred due to goods disinflation. Services have been quite sticky.",
            episodeTitle: "The US is Risking Stagflation | Mohamed El-Erian",
            creator: "Forward Guidance",
            episodeImage: "https://megaphone.imgix.net/podcasts/f398def0-373d-11ec-a51f-8fb207c4cf09/image/a75147ace106f858919e6a202dfa4c94.png?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress",
            audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/4502930/971334dc-fb84-11ef-b10d-5f7c5528ba91.mp3",
            startTime: 1346.95,
            endTime: 1388.23,
            publishedDate: "2025-03-07T18:54:00.000Z",
          },
          {
            pineconeId: "8f08fc3e-0522-11f0-b872-8b7fb79b78c4_p18",
            text: "And there, everybody agrees that the fight against inflation has stalled. That at best we are plateaued. Now that wouldn't be a problem if the Fed had a 2.5% to 3% inflation target. It is a problem because the Fed has a 2% inflation target and it needs to decide does it do something about it or not.",
            episodeTitle: "The U.S. Debt Crisis: Why Growth Is the Only Solution | Mohamed El-Erian Pt. 2 LIVE @ DAS",
            creator: "Forward Guidance",
            episodeImage: "https://megaphone.imgix.net/podcasts/f398def0-373d-11ec-a51f-8fb207c4cf09/image/a75147ace106f858919e6a202dfa4c94.png?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress",
            audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/4502930/8f08fc3e-0522-11f0-b872-8b7fb79b78c4.mp3",
            startTime: 419.24,
            endTime: 439.71,
            publishedDate: "2025-03-20T08:00:00.000Z",
          },
        ],
      },
      {
        topic: "The growth scare",
        positionSummary: "At the same time he sees growth getting revised toward stall speed, with markets betting the Fed's jobs worries start to outweigh its inflation worries.",
        citations: [
          {
            pineconeId: "971334dc-fb84-11ef-b10d-5f7c5528ba91_p21",
            text: "Last year, the US economy grew by 2.8%. Consensus estimates for this year were between 2.3 to 2.5. I think when we see revisions, they're going to be in the 1.5 to 2, and stall speed is anywhere below one. So I want to dig in a little bit deeper. You mentioned how the risk is of a stagflationary situation, which is, I see that, you know, has come out a lot over the past year, but it feels like it's really starting to hit the data.",
            episodeTitle: "The US is Risking Stagflation | Mohamed El-Erian",
            creator: "Forward Guidance",
            episodeImage: "https://megaphone.imgix.net/podcasts/f398def0-373d-11ec-a51f-8fb207c4cf09/image/a75147ace106f858919e6a202dfa4c94.png?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress",
            audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/4502930/971334dc-fb84-11ef-b10d-5f7c5528ba91.mp3",
            startTime: 425.29,
            endTime: 455.45,
            publishedDate: "2025-03-07T18:54:00.000Z",
          },
          {
            pineconeId: "971334dc-fb84-11ef-b10d-5f7c5528ba91_p62",
            text: "You've seen stocks sell off. And that is right now the reason why people believe that the employment side of the Fed mandate is going to dominate the price side, meaning that the Fed is going to worry about what's happening to growth and will have to cut more than it would, given what's happening to inflation, which has stalled in terms of progress. That's possible. I myself don't think you're going to get three cuts. Based on what we know today, I think we get one cut, but I don't think we're going to get three because I think the inflation issue is going to be a challenge to the Fed.",
            episodeTitle: "The US is Risking Stagflation | Mohamed El-Erian",
            creator: "Forward Guidance",
            episodeImage: "https://megaphone.imgix.net/podcasts/f398def0-373d-11ec-a51f-8fb207c4cf09/image/a75147ace106f858919e6a202dfa4c94.png?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress",
            audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/4502930/971334dc-fb84-11ef-b10d-5f7c5528ba91.mp3",
            startTime: 1306.55,
            endTime: 1346.71,
            publishedDate: "2025-03-07T18:54:00.000Z",
          },
        ],
      },
    ],
    appearances: [
      { show: "Forward Guidance", episodeTitle: "The US is Risking Stagflation | Mohamed El-Erian", publishedDate: "2025-03-07T18:54:00.000Z", citationCount: 4 },
    ],
    generatedAt: new Date().toISOString(),
    tickers: SYM_DOSSIER_ELERIAN,
  },
  "gromen": {
    person: "Luke Gromen",
    topics: [
      {
        topic: "The Treasury market is the constraint",
        positionSummary: "Gromen's whole framework runs through the bond market: foreign holders and even levered hedge funds become forced sellers of Treasuries when volatility spikes, so the deficit math collides with a shrinking buyer base.",
        citations: [
          {
            pineconeId: "macrovoices_podbean_com_38642e0b-b3e7-37f0-9c81-14b0f489cf8e_p103",
            text: "U.S. deficits, especially if we have a recession, foreigners selling. Your biggest marginal buyers have been levered hedge funds. And when volatility goes up in equities or anywhere else, they're going to sell treasuries, not buy them. So it is an accelerant, without a doubt, to the stresses we've been talking about for some time in the sovereign bond markets, and particularly Western sovereign bond markets.",
            episodeTitle: "MacroVoices #528 Luke Gromen: Hormuz Could Lead To a 1956 US Suez Moment",
            creator: "Macro Voices",
            episodeImage: "https://pbcdn1.podbean.com/imglogo/image-logo/6042395/MacroVoicesiTunesLogo-01.png",
            audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/49438/macrovoicespodbeancom38642e0b-b3e7-37f0-9c81-14b0f489cf8e.mp3",
            startTime: 2649.92,
            endTime: 2669.28,
            publishedDate: "2026-04-16T16:48:30.000Z",
          },
          {
            pineconeId: "macrovoices_podbean_com_38642e0b-b3e7-37f0-9c81-14b0f489cf8e_p81",
            text: "Now, to be clear, until they do, that's going to be a market where you can get dollar up rates up, everything else down. And we've seen a number of those markets since 2019. And so there's this very sensitive, okay, inflationary impulse of higher commodities, higher oil, deflationary impulse of those things, and then a deflationary impulse of those things hitting receipts, which are going to create dollar up rates up, slow things down. But then it also is going to raise the question of are they going to print money? Are they going to default on treasury bonds and entitlements?",
            episodeTitle: "MacroVoices #528 Luke Gromen: Hormuz Could Lead To a 1956 US Suez Moment",
            creator: "Macro Voices",
            episodeImage: "https://pbcdn1.podbean.com/imglogo/image-logo/6042395/MacroVoicesiTunesLogo-01.png",
            audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/49438/macrovoicespodbeancom38642e0b-b3e7-37f0-9c81-14b0f489cf8e.mp3",
            startTime: 2145.9,
            endTime: 2182.46,
            publishedDate: "2026-04-16T16:48:30.000Z",
          },
        ],
      },
      {
        topic: "Gold is quietly replacing Treasuries",
        positionSummary: "His tell that the regime has already turned: central banks stopped accumulating Treasuries and started buying gold.",
        citations: [
          {
            pineconeId: "macrovoices_podbean_com_38642e0b-b3e7-37f0-9c81-14b0f489cf8e_p98",
            text: "And so people say, well, when's it going to start? And you go, when's it going to start? Since central banks stopped buying treasuries and started buying gold. You know, long-term treasury bond futures priced in gold are down 90% since 2014. And it's like the dream trade for a macro.",
            episodeTitle: "MacroVoices #528 Luke Gromen: Hormuz Could Lead To a 1956 US Suez Moment",
            creator: "Macro Voices",
            episodeImage: "https://pbcdn1.podbean.com/imglogo/image-logo/6042395/MacroVoicesiTunesLogo-01.png",
            audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/49438/macrovoicespodbeancom38642e0b-b3e7-37f0-9c81-14b0f489cf8e.mp3",
            startTime: 2521.93,
            endTime: 2539.36,
            publishedDate: "2026-04-16T16:48:30.000Z",
          },
        ],
      },
    ],
    appearances: [
      { show: "Macro Voices", episodeTitle: "MacroVoices #528 Luke Gromen: Hormuz Could Lead To a 1956 US Suez Moment", publishedDate: "2026-04-16T16:48:30.000Z", citationCount: 3 },
    ],
    generatedAt: new Date().toISOString(),
    tickers: SYM_ARC_GROMEN,
  },
  "green": {
    person: "Mike Green",
    topics: [
      {
        topic: "Passive flows and concentration",
        positionSummary: "Green's market-structure thesis: passive index flows mechanically funnel capital into the largest companies, an extraordinary, built-in concentrating force.",
        citations: [
          {
            pineconeId: "macrovoices_podbean_com_4aa96c07-c349-3879-ba83-acf684c476a2_p14",
            text: "And then the second component of it is the mechanics of how we invest. This passive factor has a concentrating factor built into it that creates a feedback loop that causes the market to get narrower and narrower. Many people are reporting this as an anomalous outperformance by the size factor. That's not what my research suggests. My research suggests that these are really the stocks that are most positively affected by the passive bid.",
            episodeTitle: "MacroVoices #506 Mike Green: Volatility, High-Yield, Precious Metals & More",
            creator: "Macro Voices",
            episodeImage: "https://pbcdn1.podbean.com/imglogo/image-logo/6042395/MacroVoicesiTunesLogo-01.png",
            audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/49438/macrovoicespodbeancom4aa96c07-c349-3879-ba83-acf684c476a2.mp3",
            startTime: 415.37,
            endTime: 441.13,
            publishedDate: "2025-11-13T18:00:45.000Z",
          },
          {
            pineconeId: "12c2ada2-46af-425d-ac28-b2d600ed5b62_p18",
            text: "And because what we have seen is just an extraordinary inflow into passive strategies, which now represent about 45% of the market cap of the United States. We've actually just seen a continual upward pressure in valuation and prices that a lot of us unfortunately think is the up and to the right phenomenon in markets. On your commute across the nation on this Fed Day, a lot of good voices coming up. Katie Kaminsky will be with us. The absolute best on trend investing or the shattering of trends right now.",
            episodeTitle: "Tariff Uncertainty Ahead of Fed Meeting",
            creator: "Bloomberg Surveillance",
            episodeImage: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/8e704079-ca57-4eac-9741-ae27003e2b7f/9739700c-72c3-4176-ae55-ae27003e2b96/image.jpg?t=1705949541&size=Large",
            audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/4114115/12c2ada2-46af-425d-ac28-b2d600ed5b62.mp3",
            startTime: 319.91,
            endTime: 346.31,
            publishedDate: "2025-05-07T14:29:08.000Z",
          },
        ],
      },
      {
        topic: "What is cracking now (May 2026)",
        positionSummary: "His latest flag: credit spreads keep tightening even as the signs of actual credit deterioration build underneath.",
        citations: [
          {
            pineconeId: "macrovoices_podbean_com_d97b7e41-af5b-378b-9e8f-c18cbe83e306_p95",
            text: "We've seen credit spreads by and large tighten significantly, even as we're seeing signs of credit deterioration in the broader economy. Part of that is, of course, due to the passive bid as money flows into these strategies. They buy the highest price securities disproportionately. That has driven a bifurcation in the high-yield market, just like it's driven a bifurcation as we've seen in U.S. markets where there's the 493 and the Mag 7.",
            episodeTitle: "MacroVoices #532 Mike Green: Record Mechanical Flows",
            creator: "Macro Voices",
            episodeImage: "https://pbcdn1.podbean.com/imglogo/image-logo/6042395/MacroVoicesiTunesLogo-01.png",
            audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/49438/macrovoicespodbeancomd97b7e41-af5b-378b-9e8f-c18cbe83e306.mp3",
            startTime: 3231.78,
            endTime: 3256.58,
            publishedDate: "2026-05-14T16:45:23.000Z",
          },
        ],
      },
    ],
    appearances: [
      { show: "Macro Voices", episodeTitle: "MacroVoices #506 Mike Green: Volatility, High-Yield, Precious Metals & More", publishedDate: "2025-11-13T18:00:45.000Z", citationCount: 2 },
      { show: "Bloomberg Surveillance", episodeTitle: "Tariff Uncertainty Ahead of Fed Meeting", publishedDate: "2025-05-07T14:29:08.000Z", citationCount: 1 },
    ],
    generatedAt: new Date().toISOString(),
    tickers: SYM_DOSSIER_GREEN,
  },
};

const BRIEF_OIL: BriefResult = {
  topic: 'oil & the Strait of Hormuz',
  asOfDate: '2026-05-18',
  headline: 'Two months into the war with Iran, the Strait of Hormuz is still the whole oil story, and the desks are pricing an open-ended supply shock with no clear off-ramp.',
  sections: [
    {
      publisher: "Odd Lots",
      summary: "Odd Lots looks at the supply response: even with more barrels coming, it leaves a real challenge for Saudi Arabia and the balance of the market.",
      citations: [
        {
          pineconeId: "2cddec97-5995-4812-abea-b44b016dc69f_p82",
          text: "So they will produce a lot more oil. And I think that that really brings a big challenge to Saudi Arabia. And if and when the Strait of Hormuz reopens, we can have a situation in which for a while there's going to be demand for the extra oil because global inventories are going to need to be replenished because a lot of countries are going to build larger estate inventories. But at some point, you're going to see a raise for market share. And if we have a race for market share, then everyone wants to produce more oil, then the price of oil has to come down.",
          episodeTitle: "Why the Price of Oil, Beef, Electricity, and Everything Else Makes No Sense",
          creator: "Odd Lots",
          episodeImage: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/8a94442e-5a74-4fa2-8b8d-ae27003a8d6b/982f5071-765c-403d-969d-ae27003a8d83/image.jpg?t=1681322812&size=Large",
          audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/4114173/2cddec97-5995-4812-abea-b44b016dc69f.mp3",
          startTime: 1567.81,
          endTime: 1602.13,
          publishedDate: "2026-05-18T08:00:00.000Z",
        },
      ],
    },
    {
      publisher: "Macro Voices",
      summary: "MacroVoices weighs the swing variable: whether Iran can credibly claim control of the chokepoint.",
      citations: [
        {
          pineconeId: "macrovoices_podbean_com_d97b7e41-af5b-378b-9e8f-c18cbe83e306_p56",
          text: "And this is going to be particularly true if Iran is successful in articulating that it is in control of the Straits of Hormuz on an extended period of time. The other reality, though, and this is something I wrote about in 22, and if you remember, the projections were that we were going to see a surge in oil demand and that oil prices were going much higher. And that as China reopened from the COVID events, that we would see an incredible surge of demand that would power us well above the 106 million barrels that were the forecast. My argument was that we actually had multiple demand curves. The developed world was already in decline in terms of its oil usage.",
          episodeTitle: "MacroVoices #532 Mike Green: Record Mechanical Flows",
          creator: "Macro Voices",
          episodeImage: "https://pbcdn1.podbean.com/imglogo/image-logo/6042395/MacroVoicesiTunesLogo-01.png",
          audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/49438/macrovoicespodbeancomd97b7e41-af5b-378b-9e8f-c18cbe83e306.mp3",
          startTime: 1865.55,
          endTime: 1906.19,
          publishedDate: "2026-05-14T16:45:23.000Z",
        },
      ],
    },
    {
      publisher: "Bloomberg Surveillance",
      summary: "Bloomberg goes back to basics on why the Strait matters so much for crude in the first place.",
      citations: [
        {
          pineconeId: "6195ef78-0ecd-4aa3-98be-b43a01000389_p35",
          text: "Why do we care so much about the Strait of Hormuz? It's a great question. I think when it comes to oil, we still do live in a global oil market. So even though the United States is not buying oil from the Gulf, because the price of oil is set globally, if you reduce the supply and the demand stays the same, the price goes up. And that means the price goes up for the oil exporters in the United States.",
          episodeTitle: "US Economic Signals and the Latest on Iran Negotiations",
          creator: "Bloomberg Surveillance",
          episodeImage: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/8e704079-ca57-4eac-9741-ae27003e2b7f/9739700c-72c3-4176-ae55-ae27003e2b96/image.jpg?t=1705949541&size=Large",
          audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/4114115/6195ef78-0ecd-4aa3-98be-b43a01000389.mp3",
          startTime: 757.96,
          endTime: 779.48,
          publishedDate: "2026-04-28T15:44:50.000Z",
        },
      ],
    },
  ],
  generatedAt: new Date().toISOString(),
  tickers: SYM_BRIEF_OIL,
};

const SPLIT_AI: SplitResult = {
  topic: 'the AI bubble',
  sideA: { person: 'The bears',
    positionSummary: 'Price is the risk. The Mag 7 have burnt through cash flow on an AI buildout they still have to monetize, and the market\u2019s concentration in a few names is the real danger.',
    citations: [
      {
        pineconeId: "ttmygh_podbean_com_d3a2b445-cdfe-300b-8434-8bae320e5d08_p43",
        text: "And so we're in a situation where the Mag7 have burnt through their cash flow investing in something which they hope to be profitable in the future, but where there is currently no evidence of profitability anywhere in the AI ecosystem, apart from at the very foundation NVIDIA the chip maker. And you might argue, people who provide some training data, like if you provide a service where you've got people in Venezuela to label videos that help you train, they make a bit of money. But broadly speaking, that's it. And everyone else is heavily loss-making. Now, one of your incentives in that situation, having already got yourself into this competitive against the other Mag7 situation where you're trying to invest heavily in AI, is you try and justify it.",
        episodeTitle: "The Grant Williams Podcast Ep. 109 - Julien Garran",
        creator: "The Grant Williams Podcast",
        episodeImage: "https://pbcdn1.podbean.com/imglogo/image-logo/8087777/PODCAST_THUMBNAIL-80_percent.jpg",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/446935/ttmyghpodbeancomd3a2b445-cdfe-300b-8434-8bae320e5d08.mp3",
        startTime: 1458.89,
        endTime: 1507.61,
        publishedDate: "2025-10-20T05:01:00.000Z",
      },
      {
        pineconeId: "16517d53-7d98-4e84-878e-b3930108e885_p40",
        text: "We've heard that concentration risk in the marketplace. Are they trying to hedge some of that concentration risk out at all? They're not. I mean, the way they're hedging it is they end up quite concentrated, meaning they probably hold more NVIDIA or more Mag 7 than they would like. You know, that makes them the fully invested bear.",
        episodeTitle: "Tech Rebound Lifts Stocks Ahead of Shutdown Vote; 10 Years of Odd Lots",
        creator: "Bloomberg Surveillance",
        episodeImage: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/8e704079-ca57-4eac-9741-ae27003e2b7f/9739700c-72c3-4176-ae55-ae27003e2b96/image.jpg?t=1705949541&size=Large",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/4114115/16517d53-7d98-4e84-878e-b3930108e885.mp3",
        startTime: 769.56,
        endTime: 788.36,
        publishedDate: "2025-11-12T16:18:48.000Z",
      },
      {
        pineconeId: "macrovoices_podbean_com_7a9575ec-6bdc-3448-9817-6bb47c112fe5_p89",
        text: "Now, we still have not seen a legitimate breakdown in NVIDIA, but I do believe that these Mag 7s are going to decide what happens next. There was this huge AI boom, and NVIDIA was the leader in this space. And if we see that Mag 7s in any way start to break, they're just so huge in their market capitalization and their weightings in the main SP index that it would almost certainly spur a sell cycle, irrespective of whether or not Trump is in office or not in office or what policies he has. I think we're setting up for some sort of a market correction here early in the year. And I think that this is going to be the story of the first quarter.",
        episodeTitle: "MacroVoices #462 Luke Gromen: 2025 Outlook",
        creator: "Macro Voices",
        episodeImage: "https://pbcdn1.podbean.com/imglogo/image-logo/6042395/MacroVoicesiTunesLogo-01.png",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/49438/macrovoicespodbeancom7a9575ec-6bdc-3448-9817-6bb47c112fe5.mp3",
        startTime: 2867.92,
        endTime: 2913.04,
        publishedDate: "2025-01-08T23:09:45.000Z",
      },
    ] },
  sideB: { person: 'The bulls',
    positionSummary: 'Fundamentals justify it. Double-digit profitability across the Mag 7, hyperscaler cloud revenue compounding, and AI-startup revenue going straight up, this is earnings, not hype.',
    citations: [
      {
        pineconeId: "f08f9136-46cb-42ba-9101-b40300fcffc3_p61",
        text: "You're still seeing extraordinary profitability, double digits across the Mag seven. Hyperscalers seeing cloud revenue growing 37% year over year. Valuations have actually gotten cheaper because of that sell off so far this year, and the technology continues to innovate and get more powerful. And the narrative there has switched from, is AI a bubble? And therefore, are we overestimating I AI to, actually, is AI something we're underestimating?",
        episodeTitle: "Trump Offers Hormuz Assurances as Iran War Rages On",
        creator: "Bloomberg Surveillance",
        episodeImage: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/8e704079-ca57-4eac-9741-ae27003e2b7f/9739700c-72c3-4176-ae55-ae27003e2b96/image.jpg?t=1705949541&size=Large",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/4114115/f08f9136-46cb-42ba-9101-b40300fcffc3.mp3",
        startTime: 1491.56,
        endTime: 1515.94,
        publishedDate: "2026-03-04T15:31:09.000Z",
      },
      {
        pineconeId: "420f4b3c-48bf-11f0-94f4-b76e4bc899d8_p109",
        text: "But this is the annualized revenue at 22 of the most mature AI startups, which is up into the right, $15 billion. And this is where I have a hard time. Why would you sell the Mag 7? If this is happening, and well, I guess you could say they're competitors, but if there's if this is a real productivity boom and you can run these giant oligarch businesses with half the people or a quarter of the people is what you used to, it makes them even more efficient. And then they can, it lowers their cost of capital where they can buy back stock.",
        episodeTitle: "The Unwinding Of The Global U.S Dollar Trade | Weekly Roundup",
        creator: "Forward Guidance",
        episodeImage: "https://megaphone.imgix.net/podcasts/f398def0-373d-11ec-a51f-8fb207c4cf09/image/a75147ace106f858919e6a202dfa4c94.png?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/4502930/420f4b3c-48bf-11f0-94f4-b76e4bc899d8.mp3",
        startTime: 2522.11,
        endTime: 2564.46,
        publishedDate: "2025-06-14T08:51:00.000Z",
      },
      {
        pineconeId: "ebe75ec6-dd4b-11f0-b864-1368af03541c_p57",
        text: "Dan wants the AI bubble to pop so badly. Maybe. He's not alone. He's not alone, I don't think. I honestly, well, before I answer Ben's question, I am actually, I go on record as saying I don't think there's an AI bubble as measured by the Mag 7, because if you look at the Mag 7 relative to the SP 500 over the past 12 months, it's an inline performer, right?",
        episodeTitle: "Talk Your Book: A Tactical Strategy That Actually Works",
        creator: "Animal Spirits Podcast",
        episodeImage: "https://megaphone.imgix.net/podcasts/50b7643c-0c60-11ee-b6d1-f783f78436de/image/AnimalSpirts-Cover.jpg?ixlib=rails-4.3.1&max-w=3000&max-h=3000&fit=crop&auto=format,compress",
        audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/399817/ebe75ec6-dd4b-11f0-b864-1368af03541c.mp3",
        startTime: 1282.76,
        endTime: 1305.16,
        publishedDate: "2025-12-22T09:00:00.000Z",
      },
    ] },
  contrastSummary: 'Same Mag 7, opposite reads: the bears fixate on concentration and unproven AI capex, the bulls on the cash actually coming in the door.',
  generatedAt: new Date().toISOString(),
  tickers: SYM_SPLIT_AI,
};

// ─── Citations recycled across Narrative buckets ─────────────────────────────
// Same clips that powered the old Arc canon, now regrouped into the bucket
// shape. Keeping them as standalone constants so the same TapeCitation can be
// referenced in multiple buckets if needed without duplicating the data.
const CITE_GROMEN_2021: TapeCitation = {
  pineconeId: "macrovoices_podbean_com_d8c720dc-dea5-323b-8efb-19cacc16756a_p65",
  text: "And so I think right now people say, well, you know, I don't think they're aware of the politics of the situation. And by that, I mean if you are just repeating to yourself that debt is always deflationary, yes, that's true, until the sovereign is where the debt reaches. And that's a different game because once the sovereign gets into too much debt, the question is, are they going to print the money or not? And they always print the money. They always print the money.",
  episodeTitle: "MacroVoices #294 Luke Gromen: The U.S. Government Cannot Afford Secular Inflation",
  creator: "Macro Voices",
  episodeImage: "https://pbcdn1.podbean.com/imglogo/image-logo/6042395/MacroVoicesiTunesLogo-01.png",
  audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/49438/macrovoicespodbeancomd8c720dc-dea5-323b-8efb-19cacc16756a.mp3",
  startTime: 1650.75, endTime: 1676.99,
  publishedDate: "2021-10-21T21:00:39.000Z",
};
const CITE_GROMEN_2022: TapeCitation = {
  pineconeId: "macrovoices_podbean_com_6f52b14f-3208-39e2-b8f7-573c99b7e40d_p88",
  text: "going to a recession and treasury yields going up because of the balance of payments problem I just laid out, that is a message to those with the eyes to see it that one of two things is going to happen. The global economy, the U.S. dollar system, is going to go into a debt-death spiral, which is, you know, Brent Johnson's, hey, the dollar goes to 200, DXY goes to 200, and the world collapses. I don't know that that'll happen, but it could if the Fed just stands aside. The more likely outcome, and why I think it is, you know, dollar negative is much more likely as the Fed comes in with some version of yield curve control and actually prints money to contain U.S.",
  episodeTitle: "MacroVoices #327 Luke Gromen: Recession with Rising Yields is Entirely Possible",
  creator: "Macro Voices",
  episodeImage: "https://pbcdn1.podbean.com/imglogo/image-logo/6042395/MacroVoicesiTunesLogo-01.png",
  audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/49438/macrovoicespodbeancom6f52b14f-3208-39e2-b8f7-573c99b7e40d.mp3",
  startTime: 2402.06, endTime: 2439.98,
  publishedDate: "2022-06-09T22:00:56.000Z",
};
const CITE_GROMEN_2023A: TapeCitation = {
  pineconeId: "macrovoices_podbean_com_501810ee-6f2c-3b75-9108-a5c86c103e5f_p87",
  text: "First bursting global sovereign debt bubble in 100 years, first peak cheap energy cycle in a long, long time, this rise of another great power competition, all of these, you know, the derivative side. So, the barbell to us is an acknowledgement of, and it's how we're investing our own money. It's an acknowledgement to really I have high conviction in how this game is going to end, which is with inflation. Because once sovereign debt bubbles, sovereign debt crises rarely end in deflation. However, the cash and the short-term treasuries are really a nod to, I have no conviction in the path.",
  episodeTitle: "MacroVoices #367 Luke Gromen: USD Update in the Wake of SVB Collapse",
  creator: "Macro Voices",
  episodeImage: "https://pbcdn1.podbean.com/imglogo/image-logo/6042395/MacroVoicesiTunesLogo-01.png",
  audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/49438/macrovoicespodbeancom501810ee-6f2c-3b75-9108-a5c86c103e5f.mp3",
  startTime: 2615.63, endTime: 2663.55,
  publishedDate: "2023-03-16T16:19:51.000Z",
};
const CITE_GROMEN_2023B: TapeCitation = {
  pineconeId: "macrovoices_podbean_com_cc72dec5-0cf4-318a-a1f7-bdb91fe5f216_p18",
  text: "And so what do they sell? They sell what they can, not necessarily what they want to. They sell treasuries. So that adds to what is already a very problematic supply-demand dynamic in terms of the U.S. running a two-point, you know, trailing 12-month deficit is about 8.5%, just short of 8.5% to GDP.",
  episodeTitle: "MacroVoices #396 Luke Gromen: The Dollar Treasury Feedback Loop, Deconstructed",
  creator: "Macro Voices",
  episodeImage: "https://pbcdn1.podbean.com/imglogo/image-logo/6042395/MacroVoicesiTunesLogo-01.png",
  audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/49438/macrovoicespodbeancomcc72dec5-0cf4-318a-a1f7-bdb91fe5f216.mp3",
  startTime: 376.8, endTime: 396.96,
  publishedDate: "2023-10-05T16:22:25.000Z",
};
const CITE_GROMEN_2024: TapeCitation = {
  pineconeId: "macrovoices_podbean_com_adddb25c-9824-3ea7-933e-1f4f6e575d4f_p65",
  text: "It's that we are issuing more and more debt more and more frequently at the front end because the debt is getting so big and the sort of big, patient, nonprofit-motivated creditor, central banks, haven't bought any U.S. Treasury bonds in 10 years. And so, again, this is fine. This doesn't mean, oh, the world's coming to an end, but this is like payday lending kind of stuff. And it has, again, a very specific set of contextual implications, which is issuing more and more bonds at shorter and shorter durations with more and more fickle creditors in a world where the Fed and Treasury are not allowing Treasury volatility to go above a certain level.",
  episodeTitle: "MacroVoices #448 Luke Gromen: Why the Gold Recycling Trade is Accelerating",
  creator: "Macro Voices",
  episodeImage: "https://pbcdn1.podbean.com/imglogo/image-logo/6042395/MacroVoicesiTunesLogo-01.png",
  audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/49438/macrovoicespodbeancomadddb25c-9824-3ea7-933e-1f4f6e575d4f.mp3",
  startTime: 1682.29, endTime: 1726.45,
  publishedDate: "2024-10-03T14:15:14.000Z",
};
const CITE_GROMEN_2026: TapeCitation = {
  pineconeId: "macrovoices_podbean_com_38642e0b-b3e7-37f0-9c81-14b0f489cf8e_p98",
  text: "And so people say, well, when's it going to start? And you go, when's it going to start? Since central banks stopped buying treasuries and started buying gold. You know, long-term treasury bond futures priced in gold are down 90% since 2014. And it's like the dream trade for a macro.",
  episodeTitle: "MacroVoices #528 Luke Gromen: Hormuz Could Lead To a 1956 US Suez Moment",
  creator: "Macro Voices",
  episodeImage: "https://pbcdn1.podbean.com/imglogo/image-logo/6042395/MacroVoicesiTunesLogo-01.png",
  audioUrl: "https://cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com/49438/macrovoicespodbeancom38642e0b-b3e7-37f0-9c81-14b0f489cf8e.mp3",
  startTime: 2521.93, endTime: 2539.36,
  publishedDate: "2026-04-16T16:48:30.000Z",
};

// Narrative canon: Luke Gromen's view of the sovereign-debt endgame, 2021→2026.
// Five yearly buckets + two inflection callouts + the forward call he's still
// running with. Same six clips that powered the old Arc, regrouped chrono.
const NARRATIVE_DEBT_SPIRAL: NarrativeResult = {
  topic: "the sovereign debt endgame",
  group: "Luke Gromen",
  thesis: "Washington can't fund itself without printing. The bond market eventually breaks under the supply, and gold quietly takes the baton from Treasuries as the reserve asset of choice.",
  buckets: [
    {
      start: "2021-01-01", end: "2021-12-31",
      stance: "Foundational framing. The standard 'debt is always deflationary' rule breaks once the sovereign IS the debt — at that point, the only choice is whether to print, and they always print.",
      citations: [CITE_GROMEN_2021],
      sentiment: 2,
    },
    {
      start: "2022-01-01", end: "2022-12-31",
      stance: "Non-consensus combo named: recession AND rising yields together, driven by the U.S. balance-of-payments problem. Either the system goes debt-death spiral or the Fed prints to contain Treasury volatility. Bet is on the latter.",
      citations: [CITE_GROMEN_2022],
      sentiment: 3,
    },
    {
      start: "2023-01-01", end: "2023-12-31",
      stance: "Thesis hardens into the language of a sovereign-debt bubble — 'the first in 100 years.' By Q4 the mechanism gets specific: foreign holders sell what they can, not what they want, which means Treasuries. Supply-demand for Treasuries deteriorates measurably.",
      citations: [CITE_GROMEN_2023A, CITE_GROMEN_2023B],
      sentiment: 4,
    },
    {
      start: "2024-01-01", end: "2024-12-31",
      stance: "Pivot from 'Treasuries break' to 'gold takes the baton.' Central banks haven't bought net U.S. Treasuries in a decade — they've been recycling into gold. The structural Treasury bid is already gone; it's just not in the price.",
      citations: [CITE_GROMEN_2024],
      sentiment: 4,
    },
    {
      start: "2025-01-01", end: "2026-06-30",
      stance: "Thesis transitions from forecast to in-progress. The gold recycling trade is no longer hypothetical — long-bond futures priced in gold are down 90% since 2014. 'When's it going to start?' is the wrong question; it already did.",
      citations: [CITE_GROMEN_2026],
      sentiment: 5,
    },
  ],
  inflections: [
    { date: "2023-Q1", description: "Vague 'debt matters eventually' framing → explicit 'sovereign-debt bubble, first in 100 years.' The thesis got a name." },
    { date: "2024-Q4", description: "Pivot from 'rates break the bond market' to 'gold takes the baton from Treasuries' as the dominant framing — the trade narrative shifted from short rates to long gold." },
  ],
  forwardCall: "Forced dollar devaluation against gold this decade, FDR-style, as the only path out of the debt spiral.",
  generatedAt: new Date().toISOString(),
  tickers: SYM_ARC_GROMEN,
};

const findDossier = (person: string): DossierResult | null => {
  const q = slug(person);
  for (const key of Object.keys(DOSSIERS)) {
    if (q.includes(key) || q.includes(DOSSIERS[key].person.toLowerCase())) return DOSSIERS[key];
  }
  return null;
};
export function mockDossier(person: string): DossierResult {
  return findDossier(person) || { person: person.trim(), topics: [], appearances: [], generatedAt: new Date().toISOString() };
}
export function mockBrief(topic: string, asOfDate?: string): BriefResult {
  const q = slug(topic);
  if (q.includes('oil') || q.includes('hormuz') || q.includes('strait')) return BRIEF_OIL;
  // Empty fallback: honor the user's asOfDate so the "no commentary" message
  // reflects the window they asked about, not the canon fixture's stale date.
  return { topic: topic.trim(), asOfDate: asOfDate || BRIEF_OIL.asOfDate, headline: '', sections: [], generatedAt: new Date().toISOString() };
}
export function mockSplit(personA: string, personB: string, topic: string): SplitResult {
  // Canon match is TOPIC-only and intentionally narrow. "bulls" / "bears" are
  // universal camp labels for any debate; if we keyed on side names we'd
  // force-return SPLIT_AI for every "bulls vs bears on X" query.
  const t = slug(topic);
  const isAiBubble = (t.includes('ai') && t.includes('bubble')) || t.includes('mag 7') || t.includes('mag7') || t.includes('magnificent 7');
  if (isAiBubble) return SPLIT_AI;
  return { topic: topic.trim(), sideA: { person: personA.trim(), positionSummary: '', citations: [] }, sideB: { person: personB.trim(), positionSummary: '', citations: [] }, generatedAt: new Date().toISOString() };
}
/** Canon match for Narrative. The single canon today is the Gromen
 *  debt-spiral narrative; matches on topic keywords OR on group=Gromen
 *  regardless of topic (so "Drift on anything filtered to Gromen" hits the
 *  curated canon). */
export function mockNarrative(input: NarrativeInput): NarrativeResult {
  const t = slug(input.topic || '');
  const g = slug(input.group || '');
  const topicMatch = t.includes('debt') || t.includes('sovereign') || t.includes('endgame') || t.includes('treasur') || t.includes('gold') || t.includes('spiral');
  const groupMatch = g.includes('gromen');
  if (topicMatch || groupMatch) return NARRATIVE_DEBT_SPIRAL;
  return {
    topic: (input.topic || '').trim(),
    group: input.group,
    thesis: '',
    buckets: [],
    inflections: [],
    generatedAt: new Date().toISOString(),
  };
}
const mondayOf = (d: Date): Date => { const o = new Date(d); o.setDate(o.getDate() - ((o.getDay() + 6) % 7)); o.setHours(0, 0, 0, 0); return o; };
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
export function mockTimeline(topic: string, startDate: string, endDate: string): TimelineResult {
  const start = mondayOf(new Date(startDate)); const end = new Date(endDate); const buckets: TimelineBucket[] = [];
  const seed = [...slug(topic)].reduce((a, c) => a + c.charCodeAt(0), 0); let week = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7), week += 1) {
    const wave = Math.sin((week + seed) / 3.3) + Math.sin((week + seed) / 1.7);
    buckets.push({ weekStart: isoDate(new Date(d)), count: Math.max(0, Math.round(5 + wave * 3 + ((seed + week) % 3))) });
  }
  return { topic, startDate, endDate, buckets, totalMentions: buckets.reduce((a, b) => a + b.count, 0) };
}
export function mockTimelineDrilldown(topic: string, weekStart: string, _weekEnd?: string): TimelineDrilldownResult {
  return { weekStart, summary: `Mentions of ${topic} for the week of ${weekStart}.`, citations: [] as TapeCitation[] };
}
