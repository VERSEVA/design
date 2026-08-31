# verseva.design · deploy

**Ruled OPEN 2026-08-31** (supersedes the same-day gated ruling): the package is MIT and
public, and this docs + gallery site ships public with it. The gating options below stay
only as tools for pre-release drafts.

The site is static: `site/*.html` consuming `../tokens.css` and `../components.css` by
relative link (the board's no-drift pattern). Deploy the REPO ROOT as the static output so
those links resolve; `/` rewrites to `/site/index.html`.

## Steps (Xhunn: 1 and 4 are yours; they need the domain purchase and Vercel auth)

1. **Domain**: buy `verseva.design` at the registrar of choice.
2. **Vercel project**: `vercel link` in the repo, framework preset "Other", no build step,
   output directory `.` (repo root). Add `vercel.json`:

```json
{
  "cleanUrls": true,
  "rewrites": [{ "source": "/", "destination": "/site/index.html" }]
}
```

3. **Local preview**: `npm run board` already serves the repo root on :4390;
   `http://localhost:4390/site/` is the site.
4. **DNS**: point `verseva.design` at the Vercel project (A/CNAME per Vercel's dashboard).

## Gating (ratified 2026-08-31: team + engaged clients, not public)

Pick one; do not ship un-gated:

| Option | Mechanism | Trade |
|---|---|---|
| Vercel Deployment Protection | Password or Vercel SSO on the deployment | Cleanest; password tier needs a paid plan |
| Cloudflare Access in front | Email-allowlist gate at the DNS layer | Free tier covers it; DNS moves to Cloudflare |
| Keep it un-DNS'd | Share the *.vercel.app URL with Vercel SSO protection | Zero cost, no custom domain yet |

Recommendation: Cloudflare Access with an allowlist of team + engaged-client emails; the
allowlist IS the "engaged clients" gate and revoking access is deleting a row.

## Publishing discipline

- The package files stay the source; the site renders them. A change to tokens, the
  contract, or the laws updates the site in the same change (the board sync rule extends
  to the site).
- Run the full suite before any deploy: `node bin/verseva-gate.mjs --tokens tokens.css site`
- The version chip on the overview page tracks package.json; bump together.
