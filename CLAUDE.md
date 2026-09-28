# CLAUDE.md – Rules for this project

Project: **Talkies** – movie ticket booking app (MERN) with a vintage 70s–80s Indian cinema theme.

## Start of every session (always do this first)

1. Read `docs/requirements.md` (the full requirements).
2. Read `docs/progress.md` (what is done, what is next, known bugs).
3. Tell the developer in simple English, in a few short lines:
   - what was done last time
   - what the next task is (from progress.md)
   - any open bugs or questions
4. Wait for the developer to say OK before starting.

## While working

- Follow the build order in `docs/requirements.md` Section 15. Do not jump to a later phase.
- Work on one task at a time. Use the requirement IDs (e.g. `U-10`, `UI-21`) in commit messages.
- Plan first, show the plan, then write code after the developer agrees.
- Do not invent features that are not in `docs/requirements.md`. If something is missing or unclear, ask.
- Ask before adding a new npm package that is not in Section 2.
- Keep code simple and readable. Add short comments for hard parts.
- Follow the Talkies theme (Section 16) for every screen.
- Never put secrets in code. Use `.env`. Never commit `.env`.
- Write or update tests for important logic (Section 15.4).
- Explain things to the developer in short, simple English.

## End of every session (always do this)

1. Run the tests and tell the developer the result.
2. Update `docs/progress.md`:
   - tick finished tasks `[x]`
   - write "Last session" (date + what was done)
   - write "Next step"
   - add any bugs to "Known bugs"
3. Make a git commit with a clear message, e.g. `feat(U-01): sign up with email verification`.

## Commands

- Install: `npm install` (root, client and server)
- Run both: `npm run dev`
- Seed test data: `npm run seed`
- Tests: `npm test`

Client only (works now, run inside `client/`): `npm run dev` (http://localhost:5173), `npm run build`, `npm run lint`

(Update this list when the real scripts are created.)
