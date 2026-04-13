# System Requirements

Living specification of technical decisions, data contracts, and system behaviour. Last updated: 2026-04-06.

---

## 1. Technology Stack

| Layer | Technology | Scope |
|-------|-----------|-------|
| Frontend | React 18, Vite 5, Tailwind CSS v4, React Router v6 | Web, desktop, account management |
| Native wrapper | Capacitor 6 | iOS, Android phones (non-AR screens) |
| AR layer | Unity (C#), AR Foundation, URP | INMO Air 3, iOS (ARKit), Android (ARCore) |
| Backend | Node.js, Express | Server |
| Database | MySQL (LONGBLOB for binary data) | Server |
| Streaming | MediaMTX v1.16.3 (WHIP ingest, HLS output) | Server |
| Face Recognition | CompreFace (self-hosted; AWS Rekognition interface abstracted) | Server |
| Auth | JWT (jsonwebtoken); stored in sessionStorage | All platforms |
| File Uploads | multer (memoryStorage) | Server |
| HTTP Client | Axios | All platforms |
| Video Playback | HLS.js | All platforms |
| Speech Recognition | Browser `SpeechRecognition` / `webkitSpeechRecognition` — single session owned by `GlobalVoiceCommands`; single-shot restart loop on WKWebView (iOS) | Web/Capacitor platforms |
| Process Manager | PM2 | Server |
| Reverse Proxy | nginx | Server |
| CI/CD | GitHub Actions (SSH deploy on push to `main`) | Server |

### Dual-layer mobile architecture

The mobile/wearable strategy uses two complementary layers:

**Layer 1 — React/Capacitor** handles all traditional UI screens (login, friends list, library, settings, profile). Ships to iOS and Android phones using the existing codebase with no AR dependency.

**Layer 2 — Unity AR** handles the live camera + face overlay screen and the golf topographic green overlay. Ships to:
- INMO Air 3 wearable (via INMO SDK, AR Foundation)
- iPhone / iPad (via ARKit + AR Foundation)
- Android phone (via ARCore + AR Foundation)

Unity calls the existing CrowdView Express API (`/api/rekognition/identify`) for face data — no server changes required. The Unity app deep-links back to the React/Capacitor app for account management screens.

This avoids rebuilding traditional UI in Unity (which is painful) while giving a single AR codebase across all camera-equipped platforms.

### Capacitor Architecture

Capacitor wraps the existing React/Vite web app in a native iOS (WKWebView) and Android (WebView) shell without rewriting any UI code.

| Plugin | Purpose |
|--------|---------|
| `@capacitor/camera` | Optional: native camera picker for friend photo uploads |
| `@capacitor/push-notifications` | Future: notify user when a friend goes live |

`@capacitor-community/speech-recognition` was evaluated but abandoned — SPM incompatibility on iOS. The app uses the browser `webkitSpeechRecognition` API on all platforms including WKWebView, with a single-shot restart loop to avoid the WKWebView continuous-mode loop bug.

Capacitor is detected via `window.location.protocol === 'capacitor:'`. TTS (`SpeechSynthesis`) is skipped on Capacitor to avoid audio session conflict with the active mic.

### Evaluated & Rejected Wearable Platforms

| Device | Reason Rejected |
|--------|----------------|
| **Brilliant Labs Halo** ($299–349) | Bluetooth-only (no WiFi) — cannot make real-time API calls. 20° peripheral monocular display — unsuitable for face bounding box overlays or green topo lines. Camera feed not exposed to developers (feeds internal AI pipeline only). |
| **Rokid AR Lite** ($749) | No confirmed Unity support — Java/Kotlin only, requiring a full SDK rebuild. Separate Station 2 compute module (180g extra) undermines the hands-free wearable story. FOV (50°) and battery (5hrs) are superior to INMO Air 3 — worth revisiting if Rokid confirms Unity support and integrates compute into the glasses. |
| **Snap Spectacles Gen 5** ($99/month dev program) | Best display architecture evaluated (46° FOV, 4-camera array incl. IR depth, 37 PPD) but: 45-minute battery (unusable for golf/events), 226g weight (3× INMO), TypeScript/JS only (no Unity — proprietary Lens Studio toolchain), US developer program only. Worth revisiting if battery and weight improve in next gen. |
| **RayNeo X3 Pro** ($1,099–$1,299) | Dedicated depth/SLAM camera alongside colour camera is genuinely useful for green topo anchoring. Rejected: ~40-minute real-world battery (worse than INMO), 640×480 display (far below INMO's 1080p), 4GB RAM vs 8GB (insufficient for face recognition pipelines), 30° FOV (narrower than INMO). Note: RayNeo Air series (Air 4 Pro etc.) are display-only passive screens with no camera/processor — not development platforms. |
| **Meta Ray-Ban** | No HUD display at all — camera capture only. AR overlays not accessible to third parties. |

### Unity AR Architecture

The Unity AR layer is a separate project targeting the AR camera/overlay experience only.

| Component | Detail |
|-----------|--------|
| Unity version | 2022 LTS |
| Render pipeline | Universal Render Pipeline (URP) |
| AR framework | AR Foundation 5.x |
| iOS backend | ARKit |
| Android backend | ARCore |
| INMO Air 3 backend | INMO SDK (github.com/INMOXR/air3-unity-sdk) |
| Face data | POST frames to `crowdview.tv/api/rekognition/identify` → render overlays as spatial anchors |
| Topo data | Pre-loaded GeoJSON per hole → converted to Unity mesh → SLAM-anchored to green surface |
| Ball tracking | Roboflow inference API — viable for putts/chips (30–60fps); full drive tracking deferred (needs 120fps+) |
| Voice | 4-mic array (INMO Air 3) / device mic (phone) → trigger scan commands |
| Auth | JWT passed from Capacitor/web layer via deep link on launch |
| Connectivity (field) | Phone cellular hotspot → Air 3 connects as WiFi client. No deep pairing or companion SDK required. Phone acts purely as an internet bridge. |
| Voice (Air 3) | Android SpeechRecognizer API via Unity Android plugin. 4-mic array on Air 3. Structured command parser: "Add Unknown N, [name], [group/tier], save" split on commas. Conversational fallback for multi-turn flow. |
| Auth (Air 3) | JWT deep-linked from phone Capacitor app to Unity app on launch (`inmocrowdview://auth?token=<JWT>`). Stored in Android SharedPreferences. Same JWT payload used to detect individual vs corporate mode (`parentOrganizationId`). |
| Friend add (Air 3) | POST /api/friends + POST /api/friends/:id/photos — existing endpoints, no server changes. Face crop extracted from bounding box at time of voice command. |

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

CompreFace integration is fully implemented in `server/routes/rekognition.js`.

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
- Live: HLS.js, URL `{protocol}//{hostname}/hls/live/{streamKey}/index.m3u8`
- Past (VOD): native `<video>` element with `.mp4` URL — HLS.js is not used for VOD playback
- Recordings stored at `/var/www/crowdview-streams/`; served at `/recordings/`
- ⚠ **Known limitation**: only the first recording segment is played for past streams. MediaMTX may split long recordings into multiple `.mp4` files; multi-segment VOD playback is not yet implemented.

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
| `captureMode` | `'phone'\|'glasses'` | `connectGlasses()` / `disconnectGlasses()` | Never auto-cleared |
| `glassesConnected` | boolean | `connectGlasses()` | `disconnectGlasses()` |
| `cameraReconnectKey` | number | `disconnectGlasses()` (incremented) | Never reset |
| `latestGlassesFrameRef` | ref to dataUrl string | `injectGlassesFrame()` on every frame | Cleared on disconnect |

`injectGlassesFrame(dataUrl)` — called by `GlassesSDK.onFrame` callback in HubScreen; continuously updates `latestGlassesFrameRef.current`.
`connectGlasses()` — calls `GlassesSDK.connect()`, sets `captureMode='glasses'`, `glassesConnected=true`, `isStreaming=true`, clears `mediaStream`.
`disconnectGlasses()` — calls `GlassesSDK.disconnect()`, restores `captureMode='phone'`, `glassesConnected=false`, `isStreaming=false`, increments `cameraReconnectKey`.

Session persisted in `sessionStorage` (cleared on tab close). On mount, AppContext restores from sessionStorage.

---

## 10. Voice Command Architecture

### Single-session design
One `SpeechRecognition` instance for the entire app, owned by `GlobalVoiceCommands` (mounted in `App.jsx`, enabled when `isAuthenticated`). Screen-local commands are registered into AppContext via `screenVoiceRef` — no second instance is ever started.

### GlobalVoiceCommands dispatch order
1. **Screen-local first** — checks `screenVoiceRef.current.screen` and dispatches to registered command handlers
2. **Global fallback** — commands active from any screen (snap/scan, stream, end)

### Global commands (any screen)
| Command | Guard | Action |
|---------|-------|--------|
| `snap` / `scan` | `isStreaming` (camera live) | Capture frame → navigate to `/id` |
| `stream` | `isStreaming && !isStreamingOut && !isStreamingConnecting` | Start WHIP stream |
| `end` | `isStreamingOut \|\| isStreamingConnecting` | Stop WHIP stream |

### Screen-local commands
| Screen | Command | Action |
|--------|---------|--------|
| hub | `snap`/`scan` | `handleId()` |
| id | `prev`/`previous` | Previous face (boundary: speaks "First face") |
| id | `next` | Next face (boundary: speaks "Last face") |
| id | `show` | Open friend form for selected face |
| id | `cancel` | Close friend form |
| id | `back` | Navigate to `/hub` |
| friends | `name <text>` | Set name field |
| friends | `note <text>` | Set note field |
| friends | `update` | Save friend |
| friends | `cancel` | Cancel edit |

### useSpeechRecognition (hook)
- `continuous = false` on Capacitor (WKWebView cannot sustain continuous sessions)
- Normal restart delay: 200ms (Capacitor) / 0ms (desktop)
- After `audio-capture`/`aborted` error: 1500ms restart delay
- On `not-allowed` error: stops loop; restarts via `visibilitychange` (1500ms delay) when app returns to foreground
- TTS (`SpeechSynthesis`) skipped on Capacitor to prevent mic/speaker conflict

### useVoiceCommands (hook)
- Used by screens to register local commands; does NOT start a recognition session
- Returns `{ speak }` for TTS feedback (no-op on Capacitor)

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
| macOS + Chrome | Yes | Yes | `webkitSpeechRecognition`; `isMac` gate removed — mic shared mode. |
| Windows 11 + Chrome | Yes | Yes | `SpeechRecognition`; WASAPI shared mode allows concurrent stream audio. |
| iOS (Capacitor) | Yes | Yes | `webkitSpeechRecognition` single-shot loop; TTS disabled; foreground resume on `visibilitychange`. |
| Android (Capacitor) | Yes | Yes | `webkitSpeechRecognition` (same as iOS path). |
| Wearables (Capacitor) | TBD | TBD | Via `GlassesSDK` abstraction — platform-dependent. |

**Capacitor detection**: `window.location.protocol === 'capacitor:'`.

---

## 12. Glasses Integration Architecture

### Abstraction layer (client-side)

| File | Role |
|------|------|
| `src/services/GlassesSDK.js` | Platform interface stub: `connect()`, `disconnect()`, `onFrame(cb)`, `offFrame(cb)`, `_dispatchFrame(dataUrl)`, `onTranscript(cb)`, `offTranscript(cb)`, `_dispatchTranscript(text)`, `sendResult(faces)`, `displayFace(cropDataUrl, name, status)`, `speak(text)` |
| `src/hooks/useCaptureSource.js` | `getCaptureFrame(maxW)` → `Promise<HTMLCanvasElement>` — phone: reads `videoRef`; glasses: reads `latestGlassesFrameRef.current` |
| `src/hooks/useResultDisplay.js` | `showResult(photoDataUrl, { saveToLibrary, faces })` — always navigates to IdScreen; additionally calls `GlassesSDK.sendResult(faces)` + `GlassesSDK.speak(summary)` when `captureMode === 'glasses'` |
| `src/hooks/useGlassesPresentation.js` | Sequential face presentation on Halo: crops faces, speaks summary, calls `GlassesSDK.displayFace()` + `GlassesSDK.speak()` on load and on index change. Used by IdScreen. |

### AppContext additions
- `captureMode: 'phone' | 'glasses'` — default `'phone'`
- `glassesConnected: boolean` — true while glasses connected
- `latestGlassesFrameRef` — ref continuously updated with latest frame dataUrl from `GlassesSDK.onFrame`
- `injectGlassesFrame(dataUrl)` — updates `latestGlassesFrameRef.current`; called per frame in HubScreen
- `cameraReconnectKey` — counter incremented by `disconnectGlasses()`; triggers HubScreen `useEffect` to re-connect phone camera
- `connectGlasses()` — single call to enable all glasses I/O
- `disconnectGlasses()` — single call to disable all glasses I/O and restore phone

### Toggle design
One button on HubScreen (desktop sidebar + mobile overlay) calls `connectGlasses()` or `disconnectGlasses()`. A single toggle switches camera input, microphone input, display output, and audio output simultaneously — no partial state.

### Phone mic vs glasses mic
- `GlobalVoiceCommands` runs `useSpeechRecognition` only when `!glassesConnected`
- When glasses connected, `GlobalVoiceCommands` subscribes to `GlassesSDK.onTranscript(handleResult)` instead
- Voice command dispatch logic (`handleResult`) is shared by both paths

### HubScreen display
- Phone mode: `<video ref={videoRef}>` shows camera feed
- Glasses mode: `<canvas ref={glassesCanvasRef}>` fed by `GlassesSDK.onFrame()` per-frame draw; overlaid by face-detection canvas as normal

### TTS routing (`useVoiceCommands` speak function)
| Condition | Output |
|-----------|--------|
| `captureMode === 'glasses'` | `GlassesSDK.speak(text)` |
| Capacitor iOS/Android | Silent (mic/speaker conflict) |
| Desktop | `window.speechSynthesis` |

### Sequential face presentation (Halo)
1. Faces loaded → speak summary ("N faces. X friend, Y identified, Z unknown.")
2. Crop face 0 image (15% padding) → `GlassesSDK.displayFace(crop, name, status)` → speak "Face 1: Name."
3. User says "next"/"prev" → `selectedFaceIndex` changes → `useGlassesPresentation` updates Halo display + speaks next announcement

### Platform implementation notes
| Platform | Desktop support | SDK | Display |
|----------|----------------|-----|---------|
| Brilliant Labs Halo | Potentially (Web Bluetooth in Chrome) | `@brilliantlabs/frame-sdk` (BLE 5.3) | 640×400 microOLED monocular; `frame.display.bitmap()` / `frame.display.text()` |
| Meta Ray-Ban Display | **No** — Android/iOS SDK only | Meta Wearables Device Access Toolkit | **Camera capture only — HUD not accessible to third parties** |
| Vuzix Blade 2 | Via Android bridge | Android intent / WebSocket | JSON payload to activity |

### Desktop connectivity (research findings 2026-03-26)
- **Web Bluetooth** (Chrome desktop, macOS/Windows 10+): `navigator.bluetooth.requestDevice()` can connect to Halo via BLE 5.3. Requires HTTPS. Experimental but stable in Chrome.
- `GlassesSDK.connect()` will branch by platform: Web Bluetooth on desktop, native BLE Capacitor plugin on iOS/Android. All upstream app code is unaffected.
- Halo Python SDK (`frame-sdk`) is an alternative for desktop tooling but not the web app path.

### Result routing
In glasses mode, `showResult` sends to `GlassesSDK.sendResult()` **and** navigates to IdScreen. Both outputs are always active when `captureMode === 'glasses'`.

---

## 13. CORS & Allowed Origins

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

## 14. Future Enhancements — Scalability

### Dedicated Streaming Server

As the user base grows, MediaMTX should be migrated off the main VPS onto a dedicated streaming server to isolate streaming I/O from the API and web serving workloads.

**Proposed architecture:**

```
Browser/App
  ├── crowdview.tv (main VPS)
  │     ├── /api/      → Express :5000
  │     ├── /          → Vite preview :4173
  │     └── /hls/, /whip/  ──proxy──► streaming server
  │
  └── streaming server (dedicated)
        ├── MediaMTX :8888 (HLS)
        └── MediaMTX :8889 (WHIP)
```

**What changes:**
- nginx on main VPS: `proxy_pass` for `/hls/` and `/whip/` points to streaming server IP instead of localhost
- MediaMTX config: webhook URLs change from `http://localhost:5000/api/stream/...` to `https://crowdview.tv/api/stream/...`
- No client code changes required if the nginx proxy approach is used

**Recording storage options (in order of preference):**

| Option | Complexity | Notes |
|--------|-----------|-------|
| rsync after stream ends | Low | `on-unpublish` webhook triggers sync to main VPS; short delay before recording is available |
| Express proxies recording requests to streaming server | Medium | No disk duplication; streaming server needs authenticated file endpoint |
| Object storage (S3/R2) | Higher | Best long-term; no disk management; recordings survive server replacement |

**Estimated effort:** 4–10 hours depending on recording strategy chosen.

---

## 15. Known Stubs / Not-Yet-Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Real face recognition | **Live** | CompreFace fully integrated in `rekognition.js` |
| Social platform posting | Stub | PostScreen exists but no OAuth or API calls |
| Platform tokens (FB/IG/YT/TT) | Stub | Stored in DB but not used |
| Email sending (SMTP) | Conditional | Forgot-password only works if SMTP env vars configured |
| Devices API endpoint | Stub | Returns message saying to use client-side enumeration |

---

## 15. Corporate Mode

### Detection

| Condition | Meaning |
|-----------|---------|
| `user.parentOrganizationId !== null` | User belongs to a corporate organisation |
| `user.corporateAdminFl === 'Y'` | User is an Org Admin User (OAU) |

Individual (non-corporate) users have `parentOrganizationId: null` and `corporateAdminFl: 'N'`.

### JWT Payload (additions)

```json
{
  "userId": 1,
  "email": "user@example.com",
  "parentOrganizationId": 42,
  "corporateAdminFl": "Y"
}
```

Both fields are present for all users. Individual users receive `parentOrganizationId: null` and `corporateAdminFl: 'N'`.

### New Middleware

| File | Purpose |
|------|---------|
| `server/middleware/corporateAdmin.js` | Rejects (403) any request whose JWT does not have `corporateAdminFl === 'Y'`; used on all corporate management routes |

### New Routes (`server/routes/corporate.js`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/corporate/users` | OAU | Returns all users with matching `Parent_Organization_Id` |
| POST | `/api/corporate/users` | OAU | Create new org user; password hashed with bcrypt |
| PUT | `/api/corporate/users/:id` | OAU | Update name, `Connect_Last_Used_Device_After_Login_Fl`, `corporateAdminFl`; OAU cannot edit own admin flag |
| DELETE | `/api/corporate/users/:id` | OAU | Delete org user; OAU cannot delete themselves |
| POST | `/api/corporate/users/:id/reset-password` | OAU | Set a new password for a specified org user |

### Org-Wide Friends (`friendsScope()` helper — `server/routes/friends.js`)

- For individual users: scope = `[req.user.userId]`
- For corporate users: scope = all `User_Id` values where `Parent_Organization_Id` matches the requester's org
- All friend CRUD routes use this helper to determine the query scope; corporate users can read and manage all org-owned friend records

### Org-Wide Rekognition

- On `/api/rekognition/identify`, an `orgPrefixes` array is constructed from all user IDs in the organisation
- Face search runs against every org user's CompreFace collection prefix; first match above threshold wins
- Match thresholds unchanged (own-org ≥70%; friends-of-friends ≥72%)

### Org-Wide Streams

- `/api/stream/live`: for corporate users, returns streams for all users sharing the same `Parent_Organization_Id`
- `/api/stream/past`: similarly scoped by `Parent_Organization_Id`
- **Retention cap**: 200 past stream records per organisation. Enforced in the `POST /api/stream/on-unpublish` webhook handler — oldest records beyond the cap are deleted after each new stream ends

### Forgot-Password Restriction

- `POST /api/auth/forgot-password`: if the email belongs to a corporate user whose `corporateAdminFl !== 'Y'`, the request is rejected with a message instructing the user to contact their OAU for a password reset
- OAUs may still use self-service forgot-password

### New Screens

| Screen | Path | Guard |
|--------|------|-------|
| `CorporateUsersScreen` | `/corporate/users` | `OAUGuard` (redirects non-OAU to `/hub`) |
| `CorporateUserForm` (popup) | Overlay on `CorporateUsersScreen` | — |

`OAUGuard` is a route wrapper in `App.jsx` analogous to `AuthGuard`. It checks `user.corporateAdminFl === 'Y'`; if not, redirects to `/hub`.

### NavBar Behaviour (corporate users)

| User type | NavBar tabs |
|-----------|-------------|
| Individual | Home, Friends, Library, Streams, User Menu |
| Corporate (non-OAU) | Home, Customers, Library, Streams, Logout |
| OAU | Home, Customers, Library, Streams, Logout, Users |

- "Customers" tab links to `/friends` (same screen, relabelled)
- "Users" tab links to `/corporate/users`
- "Logout" tab directly calls `logout()` (no MenuSlideout); no ProfileScreen access for corporate users

### Org Bootstrapping

- No self-service organisation registration
- A sysadmin inserts a row into the `Organization` table and inserts the first OAU directly into the `User` table with `Parent_Organization_Id` set and `Corporate_Admin_Fl = 'Y'`
- Subsequent org users are created by the OAU via the Corporate Users screen

### Employee Routes (`/api/corporate/employees`)

All employee routes require OAU authentication (`corporateAdmin` middleware).

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/corporate/employees` | OAU | Returns all employees for the OAU's organisation |
| POST | `/api/corporate/employees` | OAU | Create new employee; body: `{name, note?}` |
| PUT | `/api/corporate/employees/:id` | OAU | Update employee details |
| DELETE | `/api/corporate/employees/:id` | OAU | Delete employee; cascades to photos and attendance; cleans up CompreFace faces |
| GET | `/api/corporate/employees/:id/photos` | OAU | List employee photo metadata |
| GET | `/api/corporate/employees/:id/photos/primary/data` | OAU | Binary; primary photo |
| GET | `/api/corporate/employees/:id/photos/:pid/data` | OAU | Binary; Content-Type from DB |
| POST | `/api/corporate/employees/:id/photos` | OAU | Multipart `photo`; triggers async face indexing |
| DELETE | `/api/corporate/employees/:id/photos/:pid` | OAU | Removes photo and async deletes face from CompreFace |
| GET | `/api/corporate/employees/attendance` | OAU | Returns attendance counts (week/month/year) per employee for the organisation |
| GET | `/api/corporate/employees/:id/attendance` | OAU | Returns specific detection dates for a single employee |

### Employee Face Collection Naming

Employee face photos are indexed in CompreFace/Rekognition using the naming convention:

```
org{orgId}_emp{employeeId}_p{photoId}
```

For example, photo ID 7 for employee ID 3 in organisation ID 1 → `org1_emp3_p7`.

This convention is distinct from the friend photo naming and allows the recognition engine to resolve matches back to a specific employee record.

### Employee Detection & Attendance Recording

During a detection run (`POST /api/rekognition/identify`), the face search includes employee collections in addition to friend/customer collections. When an employee face is matched:

1. The face object returned includes `employeeId`, `employeeName`, and `status: 'employee'`.
2. The client renders the bounding box in black (`#111827`, i.e. `bg-gray-900`) instead of the friend colour coding.
3. The face tile in the right-panel list shows a black left border (`border-gray-900`).
4. No "View" button is rendered on employee face tiles; View is only available for friends/customers (identified by `friendId`).
5. The server records attendance: `INSERT INTO Organization_Employee_Attendance (Organization_Employee_Id, Attendance_Date) VALUES (?, CURDATE()) ON DUPLICATE KEY UPDATE Organization_Employee_Id = Organization_Employee_Id` — effectively a no-op if the employee was already detected today.

### NavBar Behaviour (OAU — updated)

OAU NavBar now includes an Employees tab between Streams and Users:

| Tab | Icon | Path |
|-----|------|------|
| Home | HomeIcon | `/hub` |
| Customers | FriendsIcon | `/friends` |
| Library | LibraryIcon | `/library` |
| Streams | StreamsIcon | `/streams` |
| Employees | BadgeIcon | `/corporate/employees` |
| Users | UsersIcon | `/corporate/users` |
| Logout | LogoutIcon | `logout()` |

`BadgeIcon`: new SVG icon added to `client/src/components/Icons.jsx` — an ID badge / clipboard outline glyph.

### DB Schema Additions

#### `Organization`
| Column | Type | Notes |
|--------|------|-------|
| Organization_Id | INT PK auto-increment | |
| Name_Txt | VARCHAR(200) | Organisation display name |
| Employee_Fl | CHAR(1) NOT NULL DEFAULT 'N' | Reserved for future gating of Employees module; not currently used in UI logic |
| Created_At | TIMESTAMP | default NOW() |

#### `User` table additions
| Column | Type | Notes |
|--------|------|-------|
| Parent_Organization_Id | INT FK → Organization | nullable; NULL = individual user |
| Corporate_Admin_Fl | CHAR(1) | 'Y'/'N', default 'N' |

#### `Organization_Employee`
| Column | Type | Notes |
|--------|------|-------|
| Organization_Employee_Id | INT PK auto-increment | |
| Organization_Id | INT FK → Organization (cascade delete) | |
| Name_Txt | VARCHAR(100) | |
| Note_Multi_Line_Txt | TEXT | nullable; job title or notes |
| Created_At | TIMESTAMP | default NOW() |

#### `Organization_Employee_Photo`
| Column | Type | Notes |
|--------|------|-------|
| Organization_Employee_Photo_Id | INT PK auto-increment | |
| Organization_Employee_Id | INT FK → Organization_Employee (cascade delete) | |
| Photo_Data | LONGBLOB | |
| Photo_Mime_Type | VARCHAR | default 'image/jpeg' |
| Rekognition_Face_Id | VARCHAR | nullable; CompreFace/Rekognition face UUID |
| Created_At | TIMESTAMP | default NOW() |

#### `Organization_Employee_Attendance`
| Column | Type | Notes |
|--------|------|-------|
| Organization_Employee_Attendance_Id | INT PK auto-increment | |
| Organization_Employee_Id | INT FK → Organization_Employee (cascade delete) | |
| Attendance_Date | DATE | |
| Created_At | TIMESTAMP | default NOW() |
| UNIQUE KEY | (Organization_Employee_Id, Attendance_Date) | Enforces one record per employee per day |


---

## Subscription & Billing Tables (added 2026-04-12)

### `User_Subscription`
| Column | Type | Notes |
|--------|------|-------|
| Subscription_Id | BIGINT PK auto-increment | |
| User_Id | BIGINT FK → User UNIQUE | One row per user |
| Tier_Txt | VARCHAR(20) | 'trial' \| 'lite' \| 'personal' \| 'plus' \| 'power' |
| Period_Start_Dt | DATE | Start of current billing period |
| Live_Minutes_Alloc_Int | INT | Allocated live minutes; -1 = unlimited |
| Live_Minutes_Used_Int | INT | Minutes consumed this period |
| Live_Minutes_Topup_Int | INT | Top-up minutes purchased this period |
| Trial_Started_At | DATETIME | Timestamp when trial began |
| Created_At / Updated_At | TIMESTAMP | Managed by MySQL |

### `Live_Session_Log`
| Column | Type | Notes |
|--------|------|-------|
| Session_Id | BIGINT PK auto-increment | |
| User_Id | BIGINT FK → User | |
| Started_At | DATETIME | When Live button was turned on |
| Ended_At | DATETIME | Nullable; set when Live turned off |
| Duration_Seconds_Int | INT | Nullable; computed at session end |

### `Subscription_History`
| Column | Type | Notes |
|--------|------|-------|
| History_Id | BIGINT PK auto-increment | |
| User_Id | BIGINT FK → User | |
| Tier_Txt | VARCHAR(20) | Tier that was active during this period |
| Period_Start_Dt / Period_End_Dt | DATE | Closed period bounds |
| Live_Minutes_Alloc_Int | INT | Minutes allocated for this period |
| Live_Minutes_Used_Int | INT | Minutes consumed in this period |
| Topup_Minutes_Int | INT | Top-up minutes purchased in this period |

### `Detection_Call_Log`
| Column | Type | Notes |
|--------|------|-------|
| Call_Id | BIGINT PK auto-increment | |
| User_Id | BIGINT FK → User | |
| Detection_Type_Txt | VARCHAR(10) | 'id' \| 'live' \| 'snap' |
| Called_At | TIMESTAMP | default NOW() |

### API Endpoints
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| /api/subscription/status | GET | required | Returns current tier, minutesRemaining, canUseLive, trialDaysLeft |
| /api/subscription/live/start | POST | required | Opens a Live_Session_Log row; returns sessionId |
| /api/subscription/live/end | POST | required | Closes the session, debits used minutes |
| /api/subscription/history | GET | required | Returns last 24 closed periods |
| /api/subscription/topup | POST | required | Credits 1,200 minutes (payment stub) |
| /api/rekognition/identify | POST | required | Now accepts optional `detectionType` ('live'\|'id'\|'snap') and logs to Detection_Call_Log |
