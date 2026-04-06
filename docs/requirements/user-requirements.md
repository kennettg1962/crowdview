# User Requirements Log

Append-only log of user requests, ordered chronologically. Each entry records what was asked, the date, and a category tag.

---

## 2026-03-25

### [2026-03-25] Fix Capacitor iOS startup crash — `#ios #capacitor #bug`
- App would not load on iOS device after adding speech recognition. Error: "Cannot access 'a' before initialization" (TDZ crash in minified bundle). Root cause: `cap` variable used in `console.log` before its `const` declaration in `useSpeechRecognition.js`.

### [2026-03-25] iOS speech recognition — background/foreground handling — `#ios #voice #bug`
- When app is sent to background and returned, `not-allowed` error was thrown and recognition loop stopped permanently. Fix: stop restart loop on `not-allowed`; restart via `visibilitychange` event with 1500ms delay to allow iOS audio session to re-establish.

### [2026-03-25] iOS speech recognition — reduce command latency — `#ios #voice #ux`
- 2+ second lag before commands registered. Restart delay reduced from 500ms to 200ms for normal cycle; 1500ms delay only after `audio-capture`/`aborted` errors (background return).

### [2026-03-25] Skip TTS on Capacitor iOS — `#ios #voice #bug`
- SpeechSynthesis conflicts with active SpeechRecognition mic session on WKWebView. Fix: skip TTS when `window.location.protocol === 'capacitor:'`.

### [2026-03-25] Global 'stream' and 'end' voice commands — `#voice #hub`
- Add globally active voice commands: "stream" (starts WHIP stream) and "end" (stops stream).
- "snap"/"scan" guard: only fires when camera is live (Id button enabled).
- "stream" guard: only fires when camera live and not already streaming out.
- "end" guard: only fires when stream is active or connecting.
- All three work from any screen.

### [2026-03-25] Wearable glasses integration — research & architecture — `#glasses #architecture`
- Researched smart glasses platforms for capture → process → display result loop.
- Meta Ray-Ban Display SDK does not expose the HUD display to third-party developers (camera access only). Not suitable for result feedback.
- Brilliant Labs Halo (not yet shipping) identified as best fit when available.
- Designed glasses abstraction layer: `GlassesSDK.js` (interface stub), `useCaptureSource` hook (abstracts frame source), `useResultDisplay` hook (routes results to screen and/or glasses).
- `captureMode` in AppContext ('phone' | 'glasses') controls routing. Phone behaviour unchanged.
- In glasses mode: results sent to `GlassesSDK.sendResult()` AND IdScreen is navigated to (both).

---

## 2026-03-26

### [2026-03-26] Glasses audio feedback via GlassesSDK.speak — `#glasses #voice`
- TTS feedback routed through `GlassesSDK.speak()` when in glasses mode, instead of browser `SpeechSynthesis`.
- `useVoiceCommands` hook's `speak()` function checks `captureMode`: glasses mode → `GlassesSDK.speak(text)`; Capacitor → silent; desktop → `SpeechSynthesis`.
- `GlassesSDK.speak()` stub added — platform implementations: Halo (BLE TTS bridge), Ray-Ban (Meta Wearables SDK audio output), Vuzix (Android TextToSpeech intent).

### [2026-03-26] Sequential face presentation on Halo glasses — `#glasses #id #ux`
- On face ID result: audio summary announced (e.g. "3 faces. 1 friend, 1 identified, 1 unknown.").
- Face 0 auto-displayed on Halo screen with crop image + name; announced via audio.
- User navigates with "next"/"prev" voice commands; each step updates Halo display and announces face name.
- Implemented in `useGlassesPresentation` hook (used by IdScreen); crops per bounding box with 15% padding.
- `GlassesSDK.displayFace(cropDataUrl, name, status)` stub added for platform-specific display.
- `GlassesSDK.onTranscript(cb)` / `offTranscript(cb)` / `_dispatchTranscript(text)` added for glasses mic input.

### [2026-03-26] Glasses camera feed shown on HubScreen — `#glasses #hub #ux`
- When glasses are connected, HubScreen shows a `<canvas>` fed by `GlassesSDK.onFrame()` instead of the phone `<video>` element.
- Glasses frames also stored in `latestGlassesFrameRef` (replaces one-shot `pendingGlassesFrameRef`; continuously updated).
- `useCaptureSource` reads `latestGlassesFrameRef.current` for snap; no longer awaits a promise resolver.

### [2026-03-26] Single toggle button to connect/disconnect all glasses I/O — `#glasses #hub #ux`
- One button switches ALL I/O (camera, microphone, display, audio/speakers) to/from glasses simultaneously.
- Connects: `GlassesSDK.connect()`, `setCaptureMode('glasses')`, `setGlassesConnected(true)`, `setIsStreaming(true)`, clears phone MediaStream.
- Disconnects: `GlassesSDK.disconnect()`, `setCaptureMode('phone')`, `setGlassesConnected(false)`, `setIsStreaming(false)`, increments `cameraReconnectKey` to trigger HubScreen phone camera re-connect.
- Phone speech recognition disabled while glasses connected; glasses mic (via `GlassesSDK.onTranscript`) takes over.
- Button shown in HubScreen desktop sidebar (SideButton) and mobile overlay (FloatButton, bottom row alongside Flip).
- Button styled green when connected, default white when disconnected.
- `connectGlasses()` and `disconnectGlasses()` functions in AppContext; exported to all screens.

### [2026-03-26] Desktop glasses connectivity research — `#glasses #platform #research`
- Meta Ray-Ban / Ray-Ban Display: Android/iOS SDK only. No desktop or web support, no Web Bluetooth interface. Cannot connect to desktop.
- Brilliant Labs Halo: BLE 5.3. Web Bluetooth (Chrome desktop) is the likely desktop path — `navigator.bluetooth.requestDevice()` would be called from `GlassesSDK.connect()` on desktop.
- Web Bluetooth: stable but experimental in Chrome desktop (macOS/Windows 10+); requires HTTPS; not supported in Safari/Firefox.
- Frame (Halo predecessor) has a Python SDK (`pip3 install frame-sdk`); Halo desktop SDK docs not yet published.
- CrowdView implication: `GlassesSDK.connect()` will branch by platform — Web Bluetooth on Chrome desktop, native BLE Capacitor plugin on iOS/Android. All other app code unaffected.

### [2026-03-26] CrowdView Corporate mode — organisation users — `#corporate #auth`
- Introduced a corporate tier sitting above individual users. An organisation (Organisation table) can have multiple member users. Corporate users are detected at runtime by `user.parentOrganizationId !== null` in the JWT payload.
- Org Admin Users (OAUs) are identified by `corporateAdminFl === 'Y'` in the JWT. OAUs have elevated permissions within their organisation.
- Login/signup flows updated: corporate users receive `parentOrganizationId` and `corporateAdminFl` in the JWT; individual users receive `null` for both.
- Organisations are bootstrapped by sysadmin directly in the DB (no self-service registration for organisations).

### [2026-03-26] Corporate Manage Users screen (OAU only) — `#corporate #admin`
- New screen `CorporateUsersScreen` at `/corporate/users`, accessible to OAUs only via `OAUGuard` route wrapper.
- OAUs can list all users in their organisation, add new users, edit user details, reset user passwords, and delete users.
- OAUs cannot delete themselves or remove their own admin role.
- New API routes: GET/POST/PUT/DELETE `/api/corporate/users`, POST `/api/corporate/users/:id/reset-password`.
- New middleware: `server/middleware/corporateAdmin.js` enforces OAU-only access on corporate management routes.

### [2026-03-26] Corporate label changes (friends→customers, header, navbar) — `#corporate #ux`
- For corporate users, the Friends list is relabelled as "Customers" throughout the UI (NavBar tab, ManageFriendsScreen header, FriendFormPopup title).
- HubScreen header label changes to "CrowdView Corporate" for corporate users.
- NavBar: corporate users receive a Logout tab in place of the User Menu tab (no ProfileScreen access). OAUs additionally receive a Users tab linking to `/corporate/users`.

### [2026-03-26] Org-wide face identification and streams — `#corporate #rekognition #streaming`
- Corporate users share a single customer (friend) database scoped by `Parent_Organization_Id`. All org members see and can manage the same customer records.
- `friendsScope()` helper in `server/routes/friends.js` returns the appropriate `User_Id` list (own ID only for individual users; all IDs sharing the same `Parent_Organization_Id` for corporate users).
- Rekognition: `orgPrefixes` array built from all org users' face collection prefixes; identification searches all of them.
- Live streams: `/api/stream/live` returns streams for all users sharing the same `Parent_Organization_Id`.
- Past streams: `/api/stream/past` scoped to `Parent_Organization_Id`.
- Past stream retention capped at 200 per organisation; enforced in the on-unpublish webhook handler.

---

## 2026-03-18

### [2026-03-18] HubScreen mobile overlay icon repositioning — `#hub #mobile #ui`
- Move Flip icon to bottom-left corner of the video overlay.
- Move Id icon to top-left corner; move Live icon horizontally to the right of Id (top-left horizontal pill).
- Move Stream icon to top-right corner; move Action/Cut icons horizontally to the left of Stream (top-right horizontal pill).
- Remove Camera icon entirely (desktop and mobile).
- Friend bubbles (live streams) become a vertical dropdown list aligned below the Stream icon (top-right).

---

## 2026-03-14

### [2026-03-15] Live face scan overlay on HubScreen — `#face-recognition #hub`
- Continuous face detection overlay on the live video feed on HubScreen.
- "Live" toggle button in left sidebar; pulses green when active.
- Samples one frame every 1.5 seconds; sends to /api/rekognition/identify.
- Draws bounding boxes + name labels directly on a canvas overlay over the video.
- Colour coding: green = known friend, orange = friend-of-friend, red = unknown.
- Auto-disables when camera stream stops.

### [2026-03-15] Mobile + wearable native wrapper — `#platform #mobile #capacitor`
- Decision: use Capacitor 6 to wrap the React/Vite app for iOS and Android.
- No UI rewrite — same React codebase runs inside WKWebView (iOS) and WebView (Android).
- Speech recognition on mobile: `@capacitor-community/speech-recognition` plugin using native SFSpeechRecognizer (iOS) / SpeechRecognizer (Android).
- This enables both stream audio and always-on voice commands on iOS and Android simultaneously.
- Same approach targeted for future wearable support.
- Deployment: Apple Developer Program + Google Play Console required.

### [2026-03-14] macOS mic / voice command architecture — `#audio #voice #platform`
- On macOS: stream audio wins — mic goes to video stream like Zoom/Teams; SpeechRecognition not used.
- On Windows 11: both stream audio and voice commands supported concurrently (WASAPI allows it).
- Voice commands ("scan" etc.) are a Windows/Android/wearable feature, not macOS.
- Auto-connect on HubScreen mount changed to `getUserMedia({video, audio})` on all platforms.
- `isMac` OS detection added in `client/src/utils/platform.js`; gates GlobalVoiceCommands and useVoiceCommands hook.

### [2026-03-14] Platform Roadmap — `#platform #mobile`
- Current PoC targets Chrome desktop only.
- Next phase: iOS (iPhone), Android (Chrome), Windows 11 (Chrome).
- Voice command architecture will need redesign for iOS (SpeechRecognition unreliable on WebKit).
- macOS mic conflict workarounds should be treated as temporary PoC solutions, not permanent architecture.

---

## 2026-03 (Session history reconstructed from git log and conversation transcript)

### [2026-03] Auth & Onboarding — `#auth`
- User wanted login, signup, and forgot-password flows on a single splash screen with mode switching (no page reload).
- User wanted JWT-based sessions persisted across browser tab reloads.
- User wanted password reset via email link.

### [2026-03] Auto-Connect Last Device — `#device #ux`
- User wanted the app to automatically reconnect the last-used video device on login, controlled by a per-user toggle ("Connect Last Used Device on Login").
- User wanted the connected source device to show as a badge on the Hub screen and as a checkmark in the SelectSource popup after auto-connect.
- User wanted auto-connect to not hang for 30+ seconds when mic permission is unavailable (4-second timeout introduced, later simplified to video-only).

### [2026-03] SelectSource Popup — `#device #audio`
- User wanted a popup to enumerate and select video sources, audio input sources, and audio output devices.
- User wanted connect/disconnect buttons for each category with a checkmark showing the currently connected device.
- User reported "Requested device not found" errors when connecting video camera — fixed through multiple iterations.
- User wanted microphone access to work via "Grant Microphone Access" button when permission not yet granted.
- User reported the Grant Microphone Access button did nothing — root cause was zombie getUserMedia requests blocking it.
- User reported audio sources not appearing after navigating away and back — fixed by pausing SpeechRecognition while popup is open.

### [2026-03] Voice Commands — `#voice`
- User wanted a global "scan" voice command that captures a frame from the live camera and navigates to the ID screen.
- User wanted per-screen voice commands on the ID screen (prev, next, show).
- User reported GlobalVoiceCommands causing "Not Allowed" error in an infinite loop — fixed by deferring start to first user interaction.
- User wanted voice commands to not conflict with mic access in SelectSource popup.

### [2026-03] Face Identification — `#id #rekognition`
- User wanted faces in a captured photo identified and displayed with coloured bounding boxes (green=known friend, orange=identified/friend-of-friend, red=unknown).
- User wanted face hover tooltips showing attributes (age, gender, emotion, accessories).
- User wanted click on a face to open friend form (add/edit), right-click on unknown face to assign to existing friend.
- User wanted sequential "Unknown 1", "Unknown 2" labels for unidentified faces.

### [2026-03] Library Save — `#library #media`
- User reported that photos captured via the voice "scan" command were not being saved to the library.
- User wanted photos saved to the library on fresh captures (Id button, Camera button, voice scan) but NOT when re-viewing an existing library photo on the ID screen.
- Fix: `saveToLibrary` flag passed in navigation state; IdScreen saves only when flag is true.

### [2026-03] ID Screen Navigation — `#id #ux`
- User reported the ID screen hanging for a long time after navigating away to Library and back.
- Root cause: two SpeechRecognition instances competing (GlobalVoiceCommands + useVoiceCommands on IdScreen).
- Fix: IdScreen pauses GlobalVoiceCommands on mount, restores on unmount.

### [2026-03] Streaming — `#streaming`
- User wanted to stream live video via WHIP protocol to a MediaMTX server.
- User wanted to watch live and past streams from friends.
- User wanted stream status badges and live friend list on the Hub screen.

### [2026-03] Friend Management — `#friends`
- User wanted a friends list with A-Z index, group filter, profile photos, notes, and group labels.
- User wanted to add friends by uploading a photo (which runs face identification).
- User wanted to link a friend to a CrowdView account by email for friends-of-friends identification.
- User wanted friend groups: Friend, Family, Friend of Friend, Friend of Family, Business.

### [2026-03] Requirements Tracking — `#meta`
- User provided a PDF defining a requirements tracking protocol and asked Claude to update CLAUDE.md and seed the four requirements documents from project history.

## 2026-04-02

### [2026-04-02] iOS live stream playback — `#ios #streaming #bug`
- Live stream tiles showed "Stream unavailable" or spun indefinitely on iOS Capacitor app.
- Root cause sequence: CORS error (HLS.js from capacitor:// to nginx /hls/), then MSE autoplay blocked silently (play() resolves but video freezes after first frame).
- Fix: Express proxy at /api/stream/hls/* with all upstream headers forwarded; HLS.js used for all platforms; iOS autoplay block handled by showing a tap-to-play overlay (skipping play() call entirely on Capacitor after MANIFEST_PARSED).

### [2026-04-02] Live Now tab — friends' streams not appearing on mobile — `#ios #streaming #bug`
- On mobile, only the logged-in user's own streams appeared; friends' streams did not show.
- Root cause: friend was not linked to their CrowdView account via Friend_User_Id. The stream query requires Friend_User_Id to join streams to friends.
- Resolution: by design — user must link friends via the Manage Friends screen. Confirmed link UI works correctly on mobile.

### [2026-04-02] HubScreen landscape orientation on iOS — `#ios #ux #layout`
- In landscape mode on iPhone, HubScreen switched to the desktop layout (sidebars, device pickers, bordered video) instead of maintaining the mobile overlay layout.
- Root cause: Tailwind md: breakpoint (768px) fires when phone landscape width exceeds 768px.
- Fix: detect Capacitor native platform (capacitor: protocol) and suppress all md: layout classes, locking to mobile overlay layout regardless of orientation.

---

## 2026-04-06

### [2026-04-06] Corporate Employees module — CRUD screen, photo management, attendance tracking — `#corporate #employees`
- OAU users gain an Employees screen at `/corporate/employees` accessible via a new NavBar tab (BadgeIcon).
- Screen has two tabs: Dashboard (attendance stats per employee — week/month/year detected days, drilldown to specific dates) and Employees (A-Z list with add/edit/delete and per-employee photo wallet).
- Employee photos are uploaded and deleted through the UI; each upload triggers async face indexing in CompreFace/Rekognition.
- Face collection naming convention for employee photos: `org{orgId}_emp{employeeId}_p{photoId}`.
- During live detection, employees are matched and shown in the right-panel face tiles with a black bounding box (#111827) and black left border (border-gray-900). No View button is shown on employee face tiles (View is reserved for friends/customers who have a friendId).
- Attendance is recorded automatically on each successful detection: one record per employee per day (INSERT ... ON DUPLICATE KEY UPDATE to avoid duplicate rows).
- The `Organization` table has a new `Employee_Fl CHAR(1) NOT NULL DEFAULT 'N'` field; not yet used to gate the UI.
- `BadgeIcon` (ID badge/clipboard SVG) added to `Icons.jsx` for the Employees NavBar tab.
