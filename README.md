# Pull That Up Jamie
AI-powered podcast intelligence. Jamie makes podcasts searchable, explorable, and shareable — turning hours of conversation into moments you can find, understand, use and share with friends.

![1-jamie-landing-demo](https://github.com/user-attachments/assets/fd51549f-ead8-4a1f-ac65-a1800f4ba89e)

[pullthatupjamie.ai](https://pullthatupjamie.ai) · [Backend Repo](https://github.com/uncleJim21/pullthatupjamie-backend) · [@PullThatUpJ_AI](https://x.com/PullThatUpJ_AI)

---

## What Jamie Does

**TLDR:** Jamie lets you search, analyze and clip a huge number of podcasts while you explore them conceptually.

Jamie indexes podcast episodes — transcribing, chunking, and embedding them into a vector database — so you can search by *meaning*, not keywords. Ask a question in natural language and Jamie finds the exact moments where that topic was discussed, across 100,000+ indexed clips.

But search is just the starting point. Jamie turns results into a navigable 3D space where you can see how ideas connect across episodes, feeds, and speakers. You can collect findings into research sessions, share them with rich link previews, and generate derivative content (clips, social posts, AI summaries, embedded iframes) directly from what you find.

For podcast creators, Jamie automates the most tedious parts of content repurposing: transcription, clip discovery, social posting, and audience intelligence.

<img width="1584" height="676" alt="image" src="https://github.com/user-attachments/assets/c2289b81-21eb-4346-b9d1-23311cbad35b" />


---

## Core Capabilities

### Semantic Podcast Search

Search across the full indexed library using natural language queries. Jamie uses vector similarity (Pinecone) to match by meaning — not just keywords. Results return full-text quotes with timestamps, episode metadata, speaker attribution, and direct audio playback.

Searches can be filtered by podcast feed, date range, episode, and hierarchy level (feed → episode → chapter → paragraph). Results are available in classic list view or as a 3D galaxy.

![2-jamie-search-demo](https://github.com/user-attachments/assets/ee2efc68-bb1e-46b4-9899-2b8b3ce299d9)


### 3D Galaxy Visualization

Search results render as an interactive Three.js constellation. Each node represents a podcast moment — positioned spatially by semantic similarity so related ideas cluster together. You can navigate hierarchically: zoom out to see feeds and episodes as broad clusters, zoom in to individual paragraphs and quotes.

Nodes are color-coded by hierarchy level (blue for feeds, white for episodes, orange for chapters, deep red for paragraphs). Click any node to read the quote, play the audio, or add it to your research session.

![3-jamie-exploring-demo](https://github.com/user-attachments/assets/2cdb6e35-2b63-4ff7-869d-a93eff91bbc0)


### Research Sessions

As you explore, you can collect findings into a research session — a curated set of up to 20 podcast moments. Sessions persist for indefinitely:

- **Viewed in 3D** — your collected moments rendered as their own galaxy
- **Shared via link** — with full Open Graph metadata for rich previews on Twitter, Slack, iMessage, etc.
- **Analyzed by AI** — request an executive summary, key point extraction, or thematic analysis of everything you've collected

Featured research sessions are showcased on the app's home screen as a carousel of explorable galaxies.

![4-research-session-exploration](https://github.com/user-attachments/assets/7d176a44-7c93-48ee-9b01-3e614c3b632e)


### AI Summaries & Analysis

LLM-powered analysis runs on search results and research sessions. Jamie can generate executive summaries, extract key points, and surface thematic connections across multiple episodes and speakers. Users can configure their preferred model via the model settings bar.
![5-jamie-analyze](https://github.com/user-attachments/assets/028b8c0b-3706-4bac-ac01-4d600e946f5e)

### Try Jamie Wizard

A guided onboarding flow that lets anyone — without signing up — test Jamie on their own podcast. The wizard walks through:

1. **Select a podcast feed** (paste an RSS URL or search)
2. **Pick an episode**
3. **Confirm and process** — Jamie transcribes and indexes the episode
4. **Search and explore** — run semantic queries against your freshly indexed episode

This is the primary on-ramp for new users and potential subscribers.

---

## Creator Tools (Jamie Pro)

Jamie Pro is built for podcast creators who want to turn their back catalog into a content engine. Pro is not about managing feeds — it's about generating derivative value from episodes that already exist.

### Auto-Transcription & Indexing

Every new episode in your feed is automatically transcribed and made searchable. No manual uploads, no waiting — new content enters the Jamie search index as it publishes.

### Curated Clips & Automation Pipeline

Jamie surfaces recommended clips from your episodes based on topic relevance and engagement potential. The automation settings wizard lets you configure:

- **Curation settings** — topics and themes to prioritize
- **Posting style** — tone and format preferences for AI-generated captions
- **Posting schedule** — time slots for automated social posting
- **Platform integration** — connect Twitter and Nostr accounts

### Video Editing

Import straight from the RSS feed or upload arbitrary media of your choice.

Trim, subtitle, and export video clips directly in the browser. Edit timestamps with precision, preview changes in real-time, and publish to CDN-backed storage.

### Social Cross-Posting

Share clips and content to **Twitter/X** (via OAuth) and **Nostr** (via NIP-07 browser extensions) — individually or in bulk. AI-assisted caption generation (Jamie Assist) helps craft posts. Schedule posts for optimal timing or publish immediately.

### Jamie Assist (Mention Detection)

Set up "mention pins" — topics, names, or themes you want to track. Jamie scans indexed podcasts and surfaces moments where your pinned topics are discussed, even across shows you don't produce. Think of it as a listening tool for your brand's presence in the podcast ecosystem.

---

## Subscription Tiers

### Free

- Semantic podcast search (limited queries)
- 3D galaxy visualization
- Research session creation and sharing
- Try Jamie Wizard (process one episode)
- Quick topic grid for discovery

### Jamie Plus — $9.99/mo

- More searches, clips, and AI assists per month
- Visual concept exploration with 3D maps
- AI summaries and key point analysis
- Add any podcast to Jamie's searchable library (on-demand episode processing)

### Jamie Pro — $49.99/mo

- Everything in Plus
- Auto-transcription and indexing for every new episode in your feed
- Curated clips and full automation pipeline
- Video editing from the browser
- Cross-post to Twitter and Nostr in seconds
- Jamie Assist (mention detection across the podcast ecosystem)
- Scheduled posting with time-slot management
- Onboarding support from the team within 1 business day

**Payment:** Processed via Square. Billing information is sent directly to Square and is not stored by Jamie.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18, TypeScript, React Router v7 |
| 3D Visualization | Three.js, React Three Fiber, React Three Drei |
| Styling | Tailwind CSS, Emotion, Material-UI v6 |
| Payments | Square |
| Social | Twitter OAuth, Nostr (NIP-07 via nostr-tools) |
| Audio/Video | HLS.js, native browser audio, canvas-based video editing |
| Search Backend | Pinecone (vector DB), SearXNG (deprecated) |
| AI | OpenAI, Claude (via backend) |
| Build | CRACO (Webpack override), Vercel |
| Hosting | Vercel (frontend), DigitalOcean App Platform (backend) |
| Storage | DigitalOcean Spaces (CDN) |

---

## Development Setup

### Prerequisites

- Node.js (LTS recommended)
- npm

### Install and Run

```bash
git clone https://github.com/uncleJim21/pullthatupjamie-react.git
cd pullthatupjamie-react
git checkout jc/new-auth   # Current active development branch
npm install
npm start
```

The app runs at `http://localhost:3000`. The frontend talks to the production backend by default — no local backend setup required for UI development.

### Build for Production

```bash
npm run build
```

### Project Structure

```
src/
├── components/           # UI components
│   ├── podcast/          # Podcast-specific views (feed page, dashboard, chat, search results)
│   ├── conversation/     # Conversation rendering (search result display)
│   └── ...               # Landing page, modals, social sharing, settings, etc.
├── constants/            # App-wide constants, feature flags
├── config/               # API endpoint URLs
├── context/              # React contexts (audio controller)
├── hooks/                # Custom hooks (auth, subscription, settings, streaming)
├── services/             # API service modules (auth, search, clips, social, uploads, mentions)
├── types/                # TypeScript type definitions
├── utils/                # Utility functions (time, URL, Nostr, hierarchy images)
├── lib/                  # External service integrations
├── data/                 # Mock/seed data (galaxy demo data)
└── pages/                # Route-level page components
api/                      # Vercel serverless functions (social meta tag rendering for share links)
public/                   # Static assets (icons, images)
```

### Key Routes

| Path | Component | Description |
|---|---|---|
| `/` | LandingPage | Marketing landing page with embedded demo |
| `/app` | SearchInterface | Main search + galaxy exploration interface |
| `/for-podcasters` | ForPodcastersPage | Creator-focused landing page |
| `/try-jamie` | TryJamieWizard | Guided onboarding wizard |
| `/podcast/:feedId` | PodcastFeedPage | Individual podcast dashboard (Pro users) |
| `/dashboard/:feedId` | DashboardPage | Recommended clips dashboard |
| `/automation-settings` | AutomationSettingsPage | Pro automation configuration wizard |
| `/privacy` | PrivacyPage | Privacy policy |
| `/terms` | TermsPage | Terms of service |

---

## Current Development Notes

- **Web search is deprecated** — the SearXNG-powered web search mode has been removed from the UI. The search interface is now podcast-search only. Legacy code remains but is gated.
- **Lightning payments deprecated** — BOLT11/Bitcoin Connect code exists in the codebase but Lightning auth is deprecated in the current version. Payments are Square-only.

---

## Links

- **Website:** [pullthatupjamie.ai](https://pullthatupjamie.ai)
- **Backend:** [github.com/uncleJim21/pullthatupjamie-backend](https://github.com/uncleJim21/pullthatupjamie-backend)
- **Twitter:** [@PullThatUpJ_AI](https://x.com/PullThatUpJ_AI)
- **Contact:** jim@cascdr.xyz
- **Built by:** [CASCDR Inc.](https://cascdr.xyz)

## License

GPL-3.0 — see [LICENSE](./LICENSE).
