# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CrowdView is a real-time crowd face-identification and live-streaming web app. It has two independent sub-projects that must run concurrently during development:

- `server/` — Node.js/Express REST API on port **5000**
- `client/` — React (CRA + Tailwind CSS) SPA on port **3000**, proxied to port 5000

## Commands

### Server
```bash
cd server
npm install          # first time
node server.js       # production
npm run dev          # with nodemon (auto-restart)
```

### Client
```bash
cd client
npm install          # first time
npm start            # dev server (port 3000)
npm run build        # production build → client/build/
```

### Database setup (run once)
```bash
mysql -u root -p < server/db/schema.sql
```

## Environment

Copy `server/.env.example` to `server/.env` and fill in:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (default: `crowdview`)
- `JWT_SECRET` — any strong random string
- `JWT_EXPIRES_IN` — default `7d`
- `PORT` — default `5000`

No `.env` file is needed for the client; the CRA proxy setting in `client/package.json` routes all `/api/*` calls to `http://localhost:5000`.

## Architecture

### Auth flow
JWT is issued on login/signup and stored in `localStorage` under keys `cv_token` and `cv_user`. `client/src/api/api.js` (Axios instance) attaches the token to every request via an interceptor and redirects to `/` on 401. The server validates tokens in `server/middleware/auth.js` and attaches `req.user = { userId, email }`.

### Global state (`AppContext`)
`client/src/context/AppContext.jsx` is the single source of truth for:
- Auth state (`user`, `isAuthenticated`, `login()`, `logout()`)
- Active `MediaStream` from the browser camera (`mediaStream`, `startStream()`, `stopStream()`)
- Currently selected video source device (`currentSource`) and streaming outlet (`currentOutlet`)
- Slide-out menu open state (`slideoutOpen`)

Session is restored from localStorage on mount. Stopping a stream calls `.stop()` on all MediaStream tracks.

### Screen routing (`App.jsx`)
React Router v6 with an `AuthGuard` wrapper. All routes except `/` require authentication:

| Path | Screen |
|------|--------|
| `/` | SplashScreen (login/signup/forgot) |
| `/hub` | StreamingHubScreen |
| `/friends` | ManageFriendsScreen |
| `/profile` | ProfileScreen |
| `/id` | IdScreen (face recognition results) |
| `/library` | LibraryScreen |

### Media handling
All binary data (friend photos, user media) is stored as `LONGBLOB` in MySQL. The server streams raw bytes with the correct `Content-Type` header — client `<img>` tags point directly to API endpoints like `/api/friends/:id/photos/:pid/data` and `/api/media/:id/data`. File uploads use `multer` with `memoryStorage`.

### Face recognition stub
`server/routes/rekognition.js` returns hardcoded mock face data with a 1.5s simulated delay. Face status values: `known` (green border), `identified` (orange), `unknown` (red). Replace the mock with real AWS Rekognition or similar to go live.

### Voice commands (`useVoiceCommands`)
`client/src/hooks/useVoiceCommands.js` wraps the browser Web Speech API. It is screen-aware — pass `screen` ('hub' | 'id' | 'friends') and a `commands` object of handler functions. Recognition auto-restarts on `onend`. TTS echo uses `SpeechSynthesis`. Chrome is the only browser with full support.

### Component conventions
- `AppHeader` — accepts `left`, `center`, `right` render props for the 3-column header
- `NavBar` — reads `useLocation()` to highlight the active tab
- `IconButton` (from `Icons.jsx`) — wraps any SVG icon with label, variant styling, and disabled state
- All screens follow: `AppHeader` → main content → `NavBar` → `TrueFooter`
- Modal/popup screens (`FriendFormPopup`, `SelectSourcePopup`, `StreamToPopup`) render as fixed overlays with a dark backdrop

### DB schema conventions
Table and column names use `PascalCase` with descriptive suffixes: `_Txt` (varchar), `_Fl` (CHAR(1) flag Y/N), `_Id` (PK/FK), `_Multi_Line_Txt` (TEXT). All user-owned rows are scoped by `User_Id` and the auth middleware's `req.user.userId` in every query — never expose other users' data.

## Git Workflow

Repository: `https://github.com/kennettg1962/crowdview`
Default branch: `main`

### Branching
- `main` — stable, deployable code; always push working state here
- Feature branches: `feature/<short-description>` (e.g. `feature/add-friend-search`)
- Bug fixes: `fix/<short-description>` (e.g. `fix/stream-stop-crash`)

### Commit discipline
Commit and push **after every meaningful unit of work** — completing a screen, fixing a bug, adding an API route, etc. Never leave a session without committing. Use concise imperative messages:

```
Add LibraryScreen year/month filter
Fix JWT expiry not clearing localStorage
Stub rekognition route with mock face data
```

### Routine workflow
```bash
git add <specific files>      # stage only relevant files
git commit -m "message"
git push origin main          # push after every commit
```

### Starting new feature work
```bash
git checkout -b feature/my-feature
# ... make changes, commit regularly ...
git push origin feature/my-feature
gh pr create --title "..." --body "..."   # open PR when ready
```

### What never gets committed
- `server/.env` (gitignored — contains DB credentials and JWT secret)
- `node_modules/` (gitignored in both `server/` and `client/`)
- `client/build/` (gitignored — generated artifact)
