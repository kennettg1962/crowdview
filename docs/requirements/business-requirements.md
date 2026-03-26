# Business Requirements

Living specification. Entries are merged/rewritten as requirements evolve. Last updated: 2026-03-26.

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
