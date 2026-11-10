# CLAUDE.md

Rules for agents working this repo in the agentic loop.

- Implement only from GitHub issues labelled `claude-ready`. One ticket per PR.
- Work on branch `claude/issue-N`. Never push to `main`. Never force-push.
- Verify before opening a PR:
  - `npm test`
  - `npm run gate`
  - `npm run typecheck` when TypeScript changes
- Do not publish to npm from a ticket unless the ticket explicitly says so.
- Do not change runner registration or `CI_RUNS_ON`.
- Never commit secrets or `.env` files.

See `README.md` and `docs/` for the package itself.
