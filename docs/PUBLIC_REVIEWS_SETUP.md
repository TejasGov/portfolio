# Public project ratings and comments

The portfolio reads and writes shared reviews through Supabase's PostgREST API. No localStorage reviews, sample ratings, privileged browser credentials, or extra npm dependencies are used. Without configuration the site shows an honest unavailable state; all other project features work normally.

## Connect the database

1. Create or select a Supabase project using PostgreSQL 15 or later.
2. Run [supabase/project-reviews.sql](../supabase/project-reviews.sql) once in its SQL editor. This creates the table, index, public read/insert policies, and aggregate view.
3. In the site's build environment set `VITE_SUPABASE_URL` to the project URL and `VITE_SUPABASE_PUBLISHABLE_KEY` to its **publishable** key (or legacy `anon` JWT). These are browser-visible configuration. Never use a secret or `service_role` key; Vite rejects those before generating a bundle.
4. Rebuild and deploy the site. Vite includes these values at build time, so changing hosting variables requires a new build. For local development put them in an ignored `.env.local` and restart Vite.

Use the hosting provider's environment settings for values. For this cloud workspace the two variable requirements are also saved in the environment configuration draft. Enter values in environment settings, review/save, and publish the environment. Draft saving alone does not provision a database or change a running server. If cloud egress restricts live validation, allow the exact Supabase project hostname in network settings.

## Behavior

- Every project has a stable ID; a filter never changes which project owns a review.
- Visitors can publish a comment, a 1–5 star rating, or both. Name is optional and defaults to Guest. All submitted information is public.
- Reviews load ten at a time. Average/counts come from a database view over all rows, including ratings beyond the current page. Refresh retrieves new visitors' feedback.
- Requests time out, failures preserve the draft, and duplicate clicks are blocked while publishing. The form clears only after a server-created record is confirmed.
- Browser clients have read and column-scoped insert access. They cannot set IDs/timestamps, edit, or delete records. Names are visitor supplied; there is no verified identity or one-rating-per-person guarantee. The owner can remove unwanted rows in Supabase's dashboard.

## Validation

`node scripts/check-public-reviews.mjs` runs a private Vite fixture and a shared HTTP database stand-in. It exercises two independent visitors, reload persistence, star-only/comment-only submissions, full rating counts, pagination, retry, failed-save draft retention, project isolation, and escaped user text. It does **not** submit fixture reviews to an external database. Live Supabase/schema validation remains a separate step after your project is connected.

The SQL itself was also executed in an isolated PGlite PostgreSQL engine. To reproduce that check without adding a production dependency:

```sh
npm install --prefix /tmp/portfolio-review-sql-check --cache /tmp/portfolio-npm-cache --no-audit --no-fund @electric-sql/pglite@0.5.8
PGLITE_MODULE=/tmp/portfolio-review-sql-check/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-review-schema.mjs
```

This checks the actual schema, anonymous role permissions, server-owned columns, rating/text constraints, and aggregate view. It validates PostgreSQL behavior locally; it does not configure or validate a hosted Supabase instance.

`node scripts/check-review-config.mjs` checks key formats and ensures privileged keys stop the build configuration without printing the key. Cloud commands that invoke Vite need the `ESBUILD_BINARY_PATH` override documented in `docs/DESIGN_PROGRESS.md`.
