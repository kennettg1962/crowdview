# Business Requirements

Living specification. Entries are merged/rewritten as requirements evolve. Last updated: 2026-04-12.

---

## 1. Product Vision

CrowdView is a real-time crowd face-identification and live-streaming application. The core value proposition is: point your camera at a crowd, identify who is there, and share the moment live with your social network.

**Ultimate product endpoint**: a wearable device (AR glasses) with built-in camera, microphone, speakers, and lens display — enabling fully hands-free crowd identification, voice-commanded interaction, and live streaming with audio, all from a head-mounted device.

**Current phase**: Chrome desktop PoC (macOS primary, Windows 11 secondary).

---

## 2. User Goals

| ID | Goal |
|----|------|
| BG-01 | Identify known friends and contacts from a live or captured camera feed in real time. |
| BG-02 | Stream live video to friends and followers via the CrowdView platform. |
| BG-03 | Build and maintain a personal contacts database (friends list) with photos. |
| BG-04 | Store and review captured photos and video clips in a personal library. |
| BG-05 | Use voice commands hands-free while viewing a crowd. Voice commands are the primary interaction paradigm; the product is designed toward fully hands-free wearable operation. |
| BG-06 | Share captured moments to external social platforms (Facebook, Instagram, YouTube, TikTok). |

---

## 3. Business Rules

| ID | Rule |
|----|------|
| BR-01 | All data (friends, media, streams) is scoped to the authenticated user. A user may never access another user's data through the API. |
| BR-02 | Face identification uses a tiered trust model: the user's own friends match at ≥70% similarity; friends-of-friends (linked CrowdView accounts) match at ≥72% similarity. |
| BR-03 | Face status values are: `known` (friend in the user's own list), `identified` (friend-of-friend via linked account), `unknown` (no match). |
| BR-04 | A user may link a friend record to another CrowdView account by email. This enables friends-of-friends identification. A user cannot link a friend to their own account. |
| BR-05 | The media library retains only the 20 most recent items per user. Older items are automatically pruned on upload. |
| BR-06 | Video clips have a 50 MB upload size limit. |
| BR-07 | Fresh photo captures (Id button, Camera button, voice scan command) are saved to the user's library. Re-viewing an existing library photo on the ID screen does not create a duplicate. |
| BR-08 | The "Connect Last Used Device on Login" preference is per-user and stored server-side. When enabled, the app automatically attempts to reconnect the last-used video device on login. |
| BR-09 | Stream keys are unique per user (UUID). Only MediaMTX webhook endpoints bypass authentication; all other API endpoints require a valid JWT. |
| BR-10 | Live stream visibility: a user sees their own live stream and live streams from friends whose CrowdView accounts are linked. |
| BR-11 | Password reset links expire after a fixed period (implementation-defined; currently stored as `Password_Reset_Expires` in DB). |

---

## 4. Stakeholder Goals

| ID | Stakeholder | Goal |
|----|-------------|------|
| SG-01 | Owner/Developer | Ship a working MVP suitable for personal and small-group use. |
| SG-02 | Owner/Developer | All user data is private by default; no cross-user data leakage. |
| SG-03 | Owner/Developer | System must operate on a single VPS (crowdview.tv) with minimal infrastructure cost. |
| SG-04 | End User | The app must be usable hands-free via voice commands when the user's hands are occupied. |
| SG-05 | End User | Device reconnection on login must be fast (< 5 seconds for video). |

---

## 5. Platform Roadmap

### Priority Rule by Platform

| Platform | Stream Audio | Voice Commands | Delivery |
|----------|-------------|----------------|----------|
| macOS + Chrome (PoC) | Yes | No | Web (Chrome) — mic = stream audio only, same as Zoom/Teams |
| Windows 11 + Chrome (PoC) | Yes | Yes | Web (Chrome) — WASAPI allows both concurrently |
| iOS (next) | Yes | Yes | Capacitor native app — `SFSpeechRecognizer` plugin alongside `getUserMedia` |
| Android (next) | Yes | Yes | Capacitor native app — `SpeechRecognizer` plugin alongside `getUserMedia` |
| Wearables (future) | Yes | Yes | Capacitor native app — dedicated hardware mic, no conflict |

**Delivery strategy:** The React/Vite web app is the single codebase. Capacitor wraps it for iOS and Android without rewriting UI. Native speech recognition plugin replaces browser SpeechRecognition on mobile. The app detects its runtime context (`Capacitor.isNativePlatform()`) and switches behaviour accordingly.

**macOS:** Voice commands intentionally not supported. Mic = stream audio. This is by design, not a limitation.

### Wearable Target Platform — INMO Air 3

The identified target wearable device for the CrowdView AR experience is the **INMO Air 3** (MSRP ~$1,099, shipping late 2025).

| Spec | Detail |
|------|--------|
| Display | Sony Micro OLED, 1080p, 120Hz, 36° FOV, full colour waveguide |
| Camera | 16MP, 1080p video, 120° wide FOV |
| Processor | Qualcomm Snapdragon spatial compute, 8GB RAM, 128GB |
| Connectivity | WiFi 6, Bluetooth 5.4 — **no 5G** (requires hotspot on course) |
| OS | Android 14 (IMOS 3.0 spatial OS) |
| SDK | Unity (C#) + Android SDK — both on GitHub (github.com/INMOXR) |
| Weight | 78g |
| Battery | ~1hr active use |

**SDK capabilities confirmed for CrowdView use cases:**
- Camera frame access via `ARCameraManager.TryAcquireLatestCpuImage` → send to rekognition API
- AR Foundation face detection + 6DoF SLAM spatial anchors → persistent face overlays
- 4-mic array → voice commands
- Ring 3 controller → hand-based UI interaction

**Constraints:**
- Unity-only SDK — the existing React/Capacitor codebase cannot run natively. A Unity AR layer is required, calling the existing CrowdView Express API as the backend.
- No 5G — WiFi 6 only. On a golf course the user's phone acts as a WiFi hotspot; the glasses connect to it as a standard WiFi client. No deep pairing or companion SDK required — the phone is purely an internet bridge. This is the intended field connectivity model.
- ~1hr battery — suitable for a few holes; a companion battery pack required for a full round.

### Extended Use Case — Golf

The wearable platform opens a golf-specific vertical:
1. **Crowd/player identification** on the course (same face-ID core feature)
2. **Topographic green overlay** — slope and break lines anchored to the putting surface via SLAM
3. **Ball flight tracking** — Roboflow inference API (pre-trained golf ball model) for putts and chip shots at 30–60fps; full drive tracking requires 120fps+ (not viable on current wearable camera)

**Topographic data strategy:** Pre-existing LiDAR/GIS data (CT 3DEP via OpenTopography) preferred over on-device photogrammetry for accuracy. 1m resolution LiDAR insufficient for green-level detail; need ≤0.3m (1ft) point density or drone survey.

---

## 6. Compliance & Constraints

| ID | Constraint |
|----|------------|
| BC-01 | Microphone and camera access requires explicit browser permission (HTTPS required in production). macOS additionally requires system-level permission grants separate from browser permissions. |
| BC-02 | Face recognition data (Rekognition Face IDs) is stored in the DB and must be cleaned up when a friend photo is deleted. |
| BC-03 | Social platform tokens (Facebook, Instagram, YouTube, TikTok) are stored per user but the posting feature is currently a stub — no actual OAuth or API integration is implemented. ⚠ Confirm whether social posting is in scope for MVP. |
| BC-04 | The production site runs at `https://crowdview.tv` (and `www.`). Both must be whitelisted in CORS and Vite preview allowedHosts. |
| BC-05 | On macOS + Chrome, SpeechRecognition is not started — the mic is owned by `getUserMedia({audio})` for stream audio. Voice commands are a Windows/Android/wearable feature only. |

---

## 7. Corporate Mode

### Overview

CrowdView Corporate is a separate operational tier for business organisations. An organisation is a managed entity with one or more member users. All org members share a common customer database and stream history scoped by the organisation.

### Business Rules

| ID | Rule |
|----|------|
| BR-C01 | A corporate organisation is a named entity stored in the `Organization` table. An organisation can have any number of member users. |
| BR-C02 | All org members share a single customer (friend) database. Records are scoped by `Parent_Organization_Id`, not by individual `User_Id`. Any org member can create, edit, or delete customer records. |
| BR-C03 | Only an OAU (Org Admin User, identified by `Corporate_Admin_Fl = 'Y'`) can manage org users: create, edit, delete, and reset passwords. |
| BR-C04 | An OAU cannot delete their own account or remove their own admin role via the Corporate Users screen. At least one OAU must remain at all times. |
| BR-C05 | Non-admin corporate users cannot use self-service password reset. They must contact their OAU to have their password reset. |
| BR-C06 | OAUs can use self-service forgot-password (same flow as individual users). |
| BR-C07 | Past stream history for an organisation is capped at 200 records. When a new stream ends and the cap is exceeded, the oldest records are automatically deleted. |
| BR-C08 | Corporate users do not have access to ProfileScreen. Account settings (name, device preference, admin flag) are managed by the OAU via the Corporate Users screen. |
| BR-C09 | Live and past stream visibility for corporate users is scoped to all members of the same organisation (equivalent to every org member being a "friend" of every other). |
| BR-C10 | Face identification searches the CompreFace collections of all org members, not just the requesting user's own collection. |
| BR-C11 | Organisations are provisioned by sysadmin only. There is no self-service organisation sign-up flow. |
| BR-C12 | Employee records are scoped to the organisation (by `Organization_Id`). Any OAU in the organisation can create, edit, and delete employee records and manage employee photos. |
| BR-C13 | Employee attendance is recorded automatically on each face-detection run. One attendance record is stored per employee per calendar day; duplicate detections on the same day do not create additional records (INSERT ... ON DUPLICATE KEY). |
| BR-C14 | Employee face photos are indexed in CompreFace/Rekognition using the naming convention `org{orgId}_emp{employeeId}_p{photoId}`. Deleting an employee photo removes the corresponding face from the recognition collection. |
| BR-C15 | During live detection, detected employees are visually distinguished from friends/customers: employee bounding boxes are black (#111827) and the face tile in the right panel shows a black left border (border-gray-900). |
| BR-C16 | No "View" button is shown on employee face tiles. The View action is reserved for friends/customers (records with a `friendId`). |
| BR-C17 | The `Organization` table carries an `Employee_Fl CHAR(1) NOT NULL DEFAULT 'N'` field reserved for future use to gate access to the Employees module per organisation. It is not currently used to restrict the UI. |

---

## 8. Individual Subscription & Billing

### Overview

Individual (non-corporate) users are billed monthly by **live scanning time** — the cumulative minutes the camera actively performs face detection. Instant Id snaps (single-frame captures with no interval timer) are always free on all paid plans.

### Tiers

| Tier | Price | Live scanning | Notes |
|------|-------|---------------|-------|
| Trial | Free | 10 hrs (600 min) | 30-day trial; auto-downgrades to Lite behaviour at expiry |
| Lite | $2.99/mo | None (0 min) | Instant Id only |
| Personal | $5.99/mo | 10 hrs (600 min) | ~2–3 typical events per month |
| Plus | $19.99/mo | 120 hrs (7,200 min) | For frequent networkers |
| Power | $49.99/mo | Unlimited | Professionals & accessibility |

### Business Rules

| ID | Rule |
|----|------|
| BR-S01 | A trial is provisioned automatically for every new individual signup. Trial duration is 30 days from the time of registration. |
| BR-S02 | When the 30-day trial billing period ends, the subscription rolls to Lite behaviour (0 live minutes) unless the user has upgraded. |
| BR-S03 | A billing period is 30 calendar days from the period start date. At each period boundary the live-minute counter resets; the closed period is archived to Subscription_History. |
| BR-S04 | Corporate accounts are exempt from all individual subscription limits. Corporate users always have `canUseLive: true`. |
| BR-S05 | Live sessions are tracked via Live_Session_Log (start/end timestamps). Duration is rounded up to the nearest minute and added to Live_Minutes_Used_Int. |
| BR-S06 | Users may purchase top-up packs of 20 hrs (1,200 min) for $5 each. Top-up minutes carry over within the period but reset at period rollover. |
| BR-S07 | The Live button in HubScreen is disabled when `canUseLive` is false (no live minutes remaining and plan has no unlimited allocation). |
| BR-S08 | Instant Id (IdScreen) and snap detection calls are not metered against live minutes. They are logged to Detection_Call_Log for analytics only. |
| BR-S09 | All detection calls (live, id, snap) are logged to Detection_Call_Log with a type field for analytics. This is independent of billing. |
| BR-S10 | Payment processing for plan upgrades and top-ups is a stub (TODO: integrate Stripe). No real charges are made until implemented. |
