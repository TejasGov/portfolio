# Project collection sources

Reviewed October 7, 2026 with a Luna agent at the user's request. The collection contains seven projects. New entries use public repository documentation and package manifests; no popularity, benchmark, completion, or production-readiness claims were inferred.

| Entry | Source | Presentation |
| --- | --- | --- |
| Yudhveer | [Repository](https://github.com/TejasGov/Yudhveer) and its README/package.json/tsconfig.json | Browser game; documented [playable build](https://yudhveer.pages.dev). TypeScript, Three.js, Rapier, Vite. |
| Cohere | [Repository](https://github.com/TejasGov/cohere), workspace manifests, demo portal and coordinator packages | Coordination prototype; [README-linked demo](https://cohere-six-nu.vercel.app). TypeScript, Vite, Express, Strands Agents, A2A SDK, Zod. |
| Stratos | [Repository](https://github.com/TejasGov/Stratos), README and package manifest | Flight-game prototype; source link, without claiming a public deployment. |
| Backpack Brain | [Repository](https://github.com/TejasGov/Backpack), current main manifest and app tree | Source-only prototype: Next.js, React, Tailwind, Supabase, AI SDK. README's older Lovable demo cannot be confirmed as matching this source revision, so it is not advertised. |
| CogniFight / Cognitive Support | [CogniFlow repository](https://github.com/TejasGov/cogniflow) | Matching public ADHD cognitive-support pipeline; source link added to existing entry. |

Existing Smash Cricket and Revere entries retain their authored descriptions and imagery. No public Smash Cricket source was found. The public Revere repository describes a cinematic product showcase rather than the wearable implementation, so it is not labelled as the wearable source.

## Local visuals

- `public/projects/yudhveer.webp`: [docs/media/06-dwarka-charged-blow.jpg](https://github.com/TejasGov/Yudhveer/blob/main/docs/media/06-dwarka-charged-blow.jpg), labelled as an in-engine gameplay capture.
- `public/projects/stratos.webp`: [docs/images/stratos-banner.svg](https://github.com/TejasGov/Stratos/blob/main/docs/images/stratos-banner.svg), labelled as repository banner artwork.
- `public/projects/cohere.webp`: [apps/demo-portal/public/cohere-logo-full.png](https://github.com/TejasGov/cohere/blob/main/apps/demo-portal/public/cohere-logo-full.png), labelled as a project logo.
- `public/projects/backpack.webp`: [public/logo.png](https://github.com/TejasGov/Backpack/blob/main/public/logo.png), labelled as project artwork.

Assets were fetched from each repository's `main` branch, resized and compressed as local WebP files (about 133 KB total). The portfolio does not depend on remote GitHub image loading or runtime scraping.

Excluded from this pass: CodeOpoly (README records an unresolved client-exposed API-key configuration issue), earlier Socra variants (pilot/MVP status and no verified public demo), Past-Sins (greybox prototype), GottaGetRich (less current visual/implementation evidence), and duplicate Revere/CogniFlow presentations. Repository research does not prove that external deployments or service integrations work; live demos are documented links, not newly validated deployments.
