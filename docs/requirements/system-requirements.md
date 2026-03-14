# System Requirements

Living specification of technical decisions, data contracts, and system behaviour. Last updated: 2026-03-13.

---

## 1. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS v4, React Router v6 |
| Backend | Node.js, Express |
| Database | MySQL (LONGBLOB for binary data) |
| Streaming | MediaMTX v1.16.3 (WHIP ingest, HLS output) |
| Face Recognition | CompreFace (self-hosted; AWS Rekognition interface abstracted) |
| Auth | JWT (jsonwebtoken); stored in sessionStorage |
| File Uploads | multer (memoryStorage) |
| HTTP Client | Axios |
| Video Playback | HLS.js |
| Process Manager | PM2 |
| Reverse Proxy | nginx |
| CI/CD | GitHub Actions (SSH deploy on push to `main`) |

---

## 2. Infrastructure

| Component | Detail |
|-----------|--------|
| VPS | srv1462585, IP 187.124.88.103 |
| App root | `/var/www/crowdview` |
| API process | PM2 `crowdview-api` — Express on port 5000 |
| Client process | PM2 `crowdview` — Vite preview on port 4173 |
| nginx config | `/etc/nginx/sites-enabled/crowdview.tv` |
| MediaMTX binary | `/usr/local/bin/mediamtx` |
| MediaMTX config | `/mediamtx.yml` (root — NOT `/etc/mediamtx.yml`) |
| MediaMTX service | systemd `mediamtx.service` |
| HLS output | Port 8888, proxied via nginx at `/hls/` |
| WHIP ingest | Port 8889, proxied via nginx at `/whip/` |
| Recordings | `/var/www/crowdview-streams/`, served at `/recordings/` |

---

## 3. Authentication & Session

- JWT issued on login/signup. Stored in `sessionStorage` under keys `cv_token` and `cv_user`.
- Axios interceptor attaches `Authorization: Bearer <token>` to every request.
- On 401 response: Axios interceptor redirects to `/` (clears session).
- Server middleware (`server/middleware/auth.js`) validates token; attaches `req.user = { userId, email }`.
- Session is restored from sessionStorage on app mount (not localStorage — session ends when tab closes).
- `JWT_EXPIRES_IN` defaults to `7d`.
- Password reset tokens stored as `Password_Reset_Token` + `Password_Reset_Expires` in User table. Requires SMTP config to send email.

---

## 4. Database Schema

### Naming Conventions
- Table and column names: `PascalCase`
- Column suffixes: `_Txt` (VARCHAR), `_Fl` (CHAR(1) Y/N flag), `_Id` (PK/FK integer), `_Multi_Line_Txt` (TEXT)
- All user-owned rows scoped by `User_Id`

### Tables

#### `User`
| Column | Type | Notes |
|--------|------|-------|
| User_Id | INT PK auto-increment | |
| Email | VARCHAR UNIQUE | |
| Password_Hash | VARCHAR | bcrypt |
| Name_Txt | VARCHAR(100) | |
| Last_Source_Device_Id | VARCHAR | MediaDeviceInfo.deviceId |
| Connect_Last_Used_Device_After_Login_Fl | CHAR(1) | 'Y'/'N', default 'N' |
| Facebook_Token | VARCHAR | stub |
| Instagram_Token | VARCHAR | stub |
| YouTube_Token | VARCHAR | stub |
| User_Level | INT | default 0 |
| Password_Reset_Token | VARCHAR | nullable |
| Password_Reset_Expires | DATETIME | nullable |
| Created_At | TIMESTAMP | default NOW() |

#### `Friend`
| Column | Type | Notes |
|--------|------|-------|
| Friend_Id | INT PK auto-increment | |
| User_Id | INT FK → User (cascade delete) | |
| Name_Txt | VARCHAR(100) | |
| Note_Multi_Line_Txt | TEXT | nullable |
| Friend_Group | VARCHAR | default 'Friend' |
| Friend_User_Id | INT FK → User | nullable; links to another CrowdView account |
| Created_At | TIMESTAMP | |

#### `Friend_Photo`
| Column | Type | Notes |
|--------|------|-------|
| Friend_Photo_Id | INT PK auto-increment | |
| Friend_Id | INT FK → Friend (cascade delete) | |
| Photo_Data | LONGBLOB | |
| Photo_Mime_Type | VARCHAR | default 'image/jpeg' |
| Rekognition_Face_Id | VARCHAR | nullable; CompreFace face UUID |
| Created_At | TIMESTAMP | |

#### `User_Media`
| Column | Type | Notes |
|--------|------|-------|
| User_Media_Id | INT PK auto-increment | |
| User_Id | INT FK → User (cascade delete) | |
| Media_Data | LONGBLOB | |
| Media_Mime_Type | VARCHAR | |
| Media_Type | ENUM('photo','video') | |
| Created_At | TIMESTAMP | |

#### `Stream`
| Column | Type | Notes |
|--------|------|-------|
| Stream_Id | INT PK auto-increment | |
| User_Id | INT FK → User | |
| Stream_Key_Txt | VARCHAR UNIQUE | UUID |
| Title_Txt | VARCHAR | |
| Status_Fl | VARCHAR | 'live' / 'ended' |
| Started_At | TIMESTAMP | |
| Ended_At | TIMESTAMP | nullable |
| Recording_Dir_Txt | VARCHAR | nullable; set by MediaMTX on-unpublish webhook |
| Created_At | TIMESTAMP | |

⚠ The `Stream` table structure is inferred from route code — verify against `server/db/schema.sql` if the file includes it, as it may be absent from the migration.

---

## 5. API Contracts

### Base URL
- Development: `http://localhost:5000`
- Production: `https://crowdview.tv` (proxied by nginx)

All authenticated endpoints require: `Authorization: Bearer <JWT>`

### Auth Routes (`/api/auth`)
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/signup` | No | `{email, password, name}` | `{token, userId, email, name}` |
| POST | `/login` | No | `{email, password}` | `{token, userId, email, name, lastSourceDeviceId, connectLastDevice}` |
| POST | `/forgot-password` | No | `{email}` | `{message}` |
| POST | `/reset-password` | No | `{token, newPassword}` | `{message}` |

### User Routes (`/api/users`)
| Method | Path | Auth | Body/Query | Response |
|--------|------|------|-----------|----------|
| GET | `/profile` | Yes | — | `{User_Id, Email, Name_Txt, Last_Source_Device_Id, Connect_Last_Used_Device_After_Login_Fl, User_Level}` |
| PUT | `/profile` | Yes | `{name?, password?, connectLastDevice?, lastSourceDeviceId?}` | `{message}` |

### Friend Routes (`/api/friends`)
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/` | Yes | `?group=X` optional filter |
| POST | `/` | Yes | Body: `{name, note?, group?}` |
| PUT | `/:id` | Yes | Body: `{name, note, group}` |
| DELETE | `/:id` | Yes | Cascades to photos; cleans up CompreFace faces |
| GET | `/:id/photos` | Yes | List photo metadata |
| GET | `/:id/photos/primary/data` | Yes | Binary; Content-Type from DB |
| GET | `/:id/photos/:pid/data` | Yes | Binary; Content-Type from DB |
| POST | `/:id/photos` | Yes | Multipart `photo`; triggers async face indexing |
| DELETE | `/:id/photos/:pid` | Yes | Async face deletion in CompreFace |
| PATCH | `/:id/link` | Yes | Body: `{email}` — links Friend_User_Id |
| PATCH | `/:id/unlink` | Yes | Clears Friend_User_Id |

### Media Routes (`/api/media`)
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/` | Yes | Returns array (no binary data) |
| GET | `/:id/data` | Yes | Binary media with Content-Type |
| POST | `/` | Yes | Multipart `media`; max 50MB; prunes to 20 per user |
| DELETE | `/:id` | Yes | |

### Stream Routes (`/api/stream`)
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/key` | Yes | Returns/generates stream key |
| POST | `/on-publish` | No | MediaMTX webhook; path=`live/<key>` |
| POST | `/on-unpublish` | No | MediaMTX webhook; sets status=ended |
| GET | `/live` | Yes | Own + friends' live streams |
| GET | `/past` | Yes | Own + friends' past streams with recording URLs |

### Rekognition Routes (`/api/rekognition`)
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/identify` | Yes | `{imageData: "data:image/jpeg;base64,..."}` | `{jobId, status, faces[], totalFacesDetected}` |

**Face object shape:**
```json
{
  "faceId": "uuid",
  "boundingBox": { "left": 0.0, "top": 0.0, "width": 0.0, "height": 0.0 },
  "confidence": 0.0,
  "status": "known|identified|unknown",
  "friendId": 1,
  "friendName": "string",
  "friendGroup": "string",
  "note": "string",
  "matchedLabel": "string",
  "attributes": {
    "ageRange": "25-35",
    "gender": "Male",
    "emotion": "Happy",
    "mask": false,
    "smile": true,
    "eyeglasses": false,
    "sunglasses": false,
    "beard": false
  }
}
```

---

## 6. Face Recognition System

- **Engine**: CompreFace (self-hosted), interfaced via `server/routes/rekognition.js`
- **Collection**: Initialised on server startup (non-fatal if unavailable)
- **Face Indexing**: Triggered async when a photo is added to a friend (`POST /api/friends/:id/photos`). Non-fatal — photo is saved even if indexing fails.
- **Face Deletion**: Triggered async when a friend photo is deleted. Fetches `Rekognition_Face_Id` before deletion.
- **Identification process**:
  1. Receive base64 image
  2. Decode to Buffer
  3. `detectFaces()` — returns bounding boxes
  4. For each face: crop with 15% padding → `searchFace()` in CompreFace
  5. Match against user's own friends (similarity ≥ 70%) first
  6. Then match against friends-of-friends via `Friend_User_Id` links (similarity ≥ 72%)
  7. Return structured face array

⚠ `server/routes/rekognition.js` currently returns **hardcoded mock data** with a 1.5s delay. Real CompreFace integration must be activated before this feature is production-ready.

---

## 7. Streaming Architecture

### WHIP Ingest (browser → MediaMTX)
1. Client fetches stream key from `GET /api/stream/key`
2. Client creates `RTCPeerConnection` with Google STUN server
3. Codec preference: H.264 forced for video (required for MediaMTX HLS muxing; VP8/VP9 not supported)
4. ICE gathering waits for `complete` state (3s max timeout)
5. SDP offer POSTed to `/live/{streamKey}/whip` (port 8889, proxied)
6. MediaMTX returns SDP answer
7. `isStreamingOut` set to true in AppContext

### MediaMTX Webhooks
- `runOnReady` → `POST /api/stream/on-publish` (path regex: `~^live/.*$:`)
- `runOnNotReady` → `POST /api/stream/on-unpublish`
- Hook field names in MediaMTX v1.16.3: `runOnReady` / `runOnNotReady` (NOT `runOnPublish` / `runOnUnpublish`)

### HLS Playback
- Live: `{protocol}//{hostname}/hls/live/{streamKey}/index.m3u8`
- Recordings stored at `/var/www/crowdview-streams/`; served at `/recordings/`

### Recording
- Configured under `pathDefaults` in `mediamtx.yml` (NOT at global level)

---

## 8. Media Storage

- All binary data stored as `LONGBLOB` in MySQL
- Server streams raw bytes with `Content-Type` from DB
- Client `<img>` tags point directly to API endpoints (no base64 embedding)
- File uploads via `multer` with `memoryStorage` (no temp files on disk)
- Media library capped at **20 items per user** — oldest pruned automatically on upload

---

## 9. Global State (AppContext)

| State | Type | Source | Cleared on |
|-------|------|--------|-----------|
| `user` | `{userId, email, name}` | Login API | Logout |
| `isAuthenticated` | boolean | Login | Logout |
| `currentSource` | MediaDeviceInfo | SelectSourcePopup / auto-connect | Disconnect video / Logout |
| `currentAudioIn` | MediaDeviceInfo | SelectSourcePopup | Disconnect audio / Logout |
| `currentOutlet` | `{id, name, icon, color}` | StreamToPopup | Logout |
| `isStreaming` | boolean | startStream() | stopStream() / Logout |
| `mediaStream` | MediaStream | startStream() | stopStream() / Logout |
| `slideoutOpen` | boolean | MenuSlideout | Close |
| `voicePaused` | boolean | SelectSourcePopup / IdScreen mount | Unmount of those screens |
| `isStreamingOut` | boolean | startWhipStream() | stopWhipStream() / Logout |

Session persisted in `sessionStorage` (cleared on tab close). On mount, AppContext restores from sessionStorage.

---

## 10. Voice Command Architecture

### GlobalVoiceCommands (component, mounted in App.jsx)
- Runs one `SpeechRecognition` instance for the whole app lifetime
- Defers start until first user gesture (click or keydown) — Chrome requirement
- Handles: "scan" / "scan faces" → captures frame from `mediaStream` → navigates to `/id`
- On `not-allowed` error: retries after 5 seconds
- Paused (recognition stopped) when `voicePaused=true` in AppContext

### useVoiceCommands (hook, used by IdScreen)
- Runs a separate `SpeechRecognition` instance scoped to one screen
- Screen-aware command matching (hub, id, friends)
- Auto-restarts on `onend`
- IdScreen must set `voicePaused=true` on mount to avoid two concurrent instances

⚠ Two concurrent `SpeechRecognition` instances conflict on macOS/Chrome — always ensure only one is running at a time. IdScreen pauses GlobalVoiceCommands; SelectSourcePopup pauses GlobalVoiceCommands.

---

## 11. Browser Compatibility & Permissions

- **Target browser (PoC)**: Google Chrome desktop — only browser with full Web Speech API support
- **Camera**: `navigator.mediaDevices.getUserMedia({video})` — requires HTTPS in production
- **Microphone**: Requires BOTH macOS System Settings permission (Privacy & Security → Microphone → Chrome) AND Chrome site permission
- **Auto-connect**: Video-only on login (no audio requested) to avoid zombie getUserMedia blocking subsequent mic access
- **Device enumeration**: `navigator.mediaDevices.enumerateDevices()` returns empty `audioinput` list until mic permission is granted; shows "Grant Microphone Access" button in that case
- **SpeechRecognition**: Requires user gesture before first start; `not-allowed` error retried after 5s delay
- **WHIP**: Chrome + HTTPS required for WebRTC

### Microphone Model (per platform)

| Platform | Stream audio | Voice commands | Implementation |
|----------|-------------|----------------|----------------|
| macOS + Chrome | Yes | **No** | SpeechRecognition not initialised on macOS. `getUserMedia({video,audio})` on mount — identical to Zoom/Teams. |
| Windows 11 + Chrome | Yes | Yes | WASAPI shared mode; SpeechRecognition + stream audio concurrent. |
| Android + Chrome | Yes | Yes | No systemic conflict. |
| iOS + any browser | Yes (target) | Needs redesign | WebKit; SpeechRecognition unreliable. |
| Wearables (future) | Yes | Yes | Dedicated hardware mic. |

**OS detection**: `isMac` flag in `client/src/utils/platform.js` — `GlobalVoiceCommands` and `useVoiceCommands` return early when `isMac` is true. No pause/resume needed on macOS.

---

## 12. CORS & Allowed Origins

**Server (`server/server.js`):**
- `http://localhost:4173`
- `http://localhost:5173`
- `http://localhost:3000`
- `https://crowdview.tv`
- `https://www.crowdview.tv`
- `process.env.CLIENT_URL` (production override)

**Vite preview (`client/vite.config.js`):**
- `allowedHosts`: `crowdview.tv`, `www.crowdview.tv`

---

## 13. Known Stubs / Not-Yet-Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Real face recognition | Stub | `rekognition.js` returns mock data with 1.5s delay |
| Social platform posting | Stub | PostScreen exists but no OAuth or API calls |
| Platform tokens (FB/IG/YT/TT) | Stub | Stored in DB but not used |
| Email sending (SMTP) | Conditional | Forgot-password only works if SMTP env vars configured |
| Devices API endpoint | Stub | Returns message saying to use client-side enumeration |
