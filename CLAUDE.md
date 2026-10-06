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
- Run both (works now, project root): `npm run dev`: client + server together with `concurrently`
- Seed test data (works now, project root): `npm run seed`. Clear first: `npm run seed -- --reset`. Refuses a non-local `MONGODB_URI` (e.g. Atlas) unless `-- --yes`. Test login password comes from `SEED_PASSWORD` in `.env`
- Tests (works now, project root): `npm test` runs client tests, then server tests (Vitest)
  - Client tests: next to the code, `client/src/**/*.test.js`
  - Server tests: `server/tests/**/*.test.js`. One in-memory `MongoMemoryReplSet` (MongoDB 8.3.11, same as Docker) for the whole run (`tests/globalSetup.js`); helpers `connectTestDB` / `clearTestDB` / `closeTestDB` in `tests/helpers/db.js`. Never uses the Docker database
  - First server test run downloads MongoDB once (~880 MB, cached in the user folder)

Client only (works now, run inside `client/`): `npm run dev` (http://localhost:5173), `npm run build`, `npm run lint`
Server only (works now, run inside `server/`): `npm run dev` (watch mode, http://localhost:5000), `npm start`. Check: http://localhost:5000/api/health
Server settings: copy `.env.example` (project root) to `.env`. The server reads the root `.env` with Node's `--env-file-if-exists` (no dotenv). The server does not start without `JWT_ACCESS_SECRET` and `PAYMENT_SECRET` (mock payment signing key, U-16), each at least 32 characters.

Database (development = Docker MongoDB as a single-node replica set `rs0`, only on 127.0.0.1; replica set is needed for transactions):
- First time: `docker run -d --name talkies-mongo -p 127.0.0.1:27017:27017 -v talkies-mongo-data:/data/db --restart unless-stopped mongo:8 --replSet rs0`
- Then once (after a few seconds): `docker exec talkies-mongo mongosh --quiet --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] })"`
- Check: `docker exec talkies-mongo mongosh --quiet --eval "rs.status().members[0].stateStr"` → `PRIMARY`
- `.env`: `MONGODB_URI=mongodb://127.0.0.1:27017/talkies?replicaSet=rs0`
- Start / stop later: `docker start talkies-mongo` / `docker stop talkies-mongo` (replica set config is kept)
- Data is kept in the Docker volume `talkies-mongo-data`
- Tests use `MongoMemoryReplSet` (not `MongoMemoryServer`) so transactions work

(Update this list when the real scripts are created.)
