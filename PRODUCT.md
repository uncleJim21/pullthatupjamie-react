# Product

## Register

brand

> The landing page is the surface in focus. The app itself (`/app/*`) is a product
> surface; when working there, treat it as `product`.

## Users

Three audiences, in priority order for the landing page:

1. **Researchers & curious humans** (primary). People who want to find what was
   actually said across podcasts: journalists, analysts, knowledge workers, fans
   doing a deep dive. Their context is "I have a question and I want the real
   moment it was discussed, not an AI hallucination." Job to be done: search by
   meaning, explore connections, collect and share findings.
2. **Agents & developers** (strong secondary). People (or the machines they send)
   who want to query Jamie programmatically via the public API, `llms.txt`,
   OpenAPI spec, and the `/api/pull` orchestration layer. Job to be done: discover
   that Jamie is agent-native, then either paste a ready prompt into a chat or wire
   the spec into their own tooling, in one move.
3. **Podcast creators (Jamie Pro)**. Creators turning back catalogs into clips,
   social posts, and audience intelligence. Served by `/for-podcasters`.

## Product Purpose

Pull That Up Jamie makes the podcast corpus searchable by meaning, not keywords:
~109 feeds, ~7K episodes, ~1.9M indexed paragraphs. Ask in natural language, get
the exact moment with timestamp, audio, and speaker. Results explore as a 3D
galaxy of connected ideas; findings collect into shareable, AI-analyzable research
sessions. Crucially, the same corpus is exposed as agent-native infrastructure:
a public API, `llms.txt`, OpenAPI spec, an `/api/pull` plain-English agent layer,
and L402 Lightning micropayments. Success for the landing page: a human starts a
search, or an agent/dev grabs the gateway prompt/spec, without confusion about
which path is theirs.

## Brand Personality

Three words: **high-signal, confident, builder-credible.**

Voice cuts through noise. The product's own tagline ("More signal. Less slop.") is
the personality: it has a point of view about the AI-slop era and positions Jamie
as the antidote, real sources over hallucinated answers. Tone is direct and a
little opinionated, never hypey. It should feel like a sharp tool made by people
who use it, not a pitch deck. The fact that it serves both humans and machines is
a point of pride, stated plainly, not as a gimmick.

## Anti-references

- **Crypto / Lightning-bro.** Despite using L402 payments, never neon-on-black,
  "web3" hype, rocket emojis, or get-rich energy. The Lightning rail is plumbing,
  not the pitch.
- **Corporate / enterprise.** No navy-and-gray sterility, stock photography,
  soulless "trusted by" logo walls, or vague B2B abstraction.
- **Generic AI-SaaS reflex.** No gradient blobs, glassmorphism, big-number hero
  template, or stars-on-a-black-void. (The current cosmic/nebula treatment is
  exactly this reflex and is being retired.)

## Design Principles

1. **Show the corpus, don't describe it.** Real numbers (1.9M paragraphs, 109
   feeds) and real interaction beat adjectives. The product proves itself.
2. **Two doors, one truth.** Humans and agents are both first-class. Make the fork
   explicit and confident rather than hiding the machine path.
3. **Signal over atmosphere.** Structure, type, and data carry the page. Decoration
   earns its place or is cut. This is the visual form of "more signal, less slop."
4. **Practice what you preach.** A product that filters slop cannot look like slop.
   Restraint is the brand.
5. **Respect the visitor's intent.** A researcher wants to search; a dev wants the
   spec. Reduce the distance from landing to that first real action.

## Accessibility & Inclusion

Target WCAG 2.1 AA. Maintain AA contrast on the dark surface (especially the
low-opacity white text currently used for body copy, which often fails). Honor
`prefers-reduced-motion`: the page leans on motion today, so all non-essential
animation must have a reduced-motion off-ramp. Ensure keyboard focus states and
real semantic landmarks for the human/agent fork.
