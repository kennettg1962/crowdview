# Process Flow Requirements

Living specification ordered by screen. Detailed enough to produce wireframes. Last updated: 2026-03-26.

---

## Screen Map

```
/ (SplashScreen)
├── /hub (HubScreen) ←→ SelectSourcePopup, StreamToPopup
│   ├── /id (IdScreen) ←→ FriendFormPopup, AddPhotoToFriendPopup
│   ├── /friends (ManageFriendsScreen) ←→ FriendFormPopup   [labelled "Customers" for corporate users]
│   │   └── /id (IdScreen) [photo upload path]
│   ├── /library (LibraryScreen) ←→ /id (IdScreen) [re-view path]
│   ├── /streams (StreamsScreen)
│   │   └── /streams/watch (StreamWatchScreen)
│   ├── /post (PostScreen) [stub]
│   └── /corporate/users (CorporateUsersScreen) [OAU only] ←→ CorporateUserForm popup
├── /profile (ProfileScreen)  [individual users only]
└── /reset-password?token= (ResetPasswordScreen)
```

---

## 1. SplashScreen (`/`)

### Initial State
- Full-screen gradient background (blue → indigo → purple)
- White card centered, max-width 384px
- Logo: large Friends icon (blue) above "CrowdView" heading, subtitle "Stream, Connect, Share"
- Default mode: Login

### Login Mode
**Fields:**
- Email (type=email, placeholder "Enter your email address", autofocus)
- Password (type=password, placeholder "Enter your password")

**Buttons / Links:**
- "Forgotten Password?" (text link, right-aligned below password) → switches to Forgot mode
- "Sign In" (primary button, full width) → submits login
- "New User? Create a profile here..." (text link, centered below) → switches to Signup mode

**Validation / Errors:**
- Inline error text (red) if email or password empty, or if API returns error
- Button shows "Signing in..." while loading, disabled

**On Success:**
- Stores JWT + user object in sessionStorage
- If `connectLastDevice === 'Y'` and `lastSourceDeviceId` is set: attempts to auto-connect last camera (video-only, no audio to avoid hang), enumerates devices to set source badge
- Navigates to `/hub`

---

### Signup Mode
**Fields:**
- Name (text, max 100 chars, placeholder "Enter your name", autofocus)
- Email Address (type=email, placeholder "Enter your email address")
- Password (type=password, placeholder "Minimum 6 characters")
- Repeat Password (type=password, placeholder "Re-enter your password")

**Buttons / Links:**
- "Sign Up" (primary button, full width) → submits signup
- "Already have an account? Sign in" (text link, centered below) → switches to Login mode

**Validation / Errors:**
- Name required; email must match regex; password ≥ 6 chars; passwords must match
- API errors shown inline

**On Success:** navigates to `/hub`

---

### Forgot Password Mode
**Header:** "Reset Password" heading + "Enter your email and we'll send you a reset link." subtext

**Fields:**
- Email Address (type=email, autofocus)

**Buttons / Links:**
- "Send Reset Link" (primary button) → hidden after success
- "← Back to Sign In" (text link) → switches to Login mode

**Success State:** Green box replaces button: "A password reset link has been sent to your email address. Please check your inbox."

---

### Transition Data: SplashScreen → HubScreen
```
sessionStorage: { cv_token: <JWT>, cv_user: { userId, email, name, connectLastDevice, lastSourceDeviceId } }
AppContext: isAuthenticated=true, user set
AppContext: mediaStream set (if auto-connect succeeds), currentSource set (device object)
```

---

## 2. HubScreen (`/hub`)

### Layout: 3-column
```
[Header: Friends icon | "CrowdView" | Library icon]
[Select Source btn] [Source badge] [Select Outlet btn] [Outlet badge]
+----------+-----------------------------+----------+
| Left 15% | Center 70%                  | Right 15%|
| Id btn   | Video container (16:9)      | Stream   |
| Action   |                             | [Live    |
| Cut      | (camera stream or           |  Friends]|
| Camera   |  placeholder icon+text)     |          |
+----------+-----------------------------+----------+
[NavBar: Home | Friends | Library | Streams | User Menu]
[TrueFooter]
```

### Header
- Left: "Friends" label + FriendsIcon → navigates to `/friends`
- Center: "CrowdView" (bold, large)
- Right: "Library" label + LibraryIcon → navigates to `/library`

### Controls Row (below header)
- "Select Source" button (slate, border) + SelectSourceIcon → opens SelectSourcePopup overlay
- Source name badge (blue): shown only when `currentSource` is set; displays device label
- "Select Outlet" button (slate, border) + StreamToIcon → opens StreamToPopup overlay
- Outlet name badge (blue): shown only when `currentOutlet` is set; displays outlet name

### Left Sidebar Buttons (top to bottom) — Desktop only
| Button | Icon | Enabled when | Action |
|--------|------|--------------|--------|
| Live | LiveScanIcon | `isStreaming` | Toggle continuous face-scan overlay; green/pulsing when active |
| Id | IdIcon | `isStreaming` | Capture frame → save to library → navigate to `/id` with `saveToLibrary:true` |
| Action | ActionIcon | `isStreaming` | Start video recording (MediaRecorder) |
| Cut | CutIcon | Recording active | Stop recording → save clip to library; replaces Action button while recording; animated red pulse |

### Mobile Overlay Icons (floating over full-screen video)

**Top-left — horizontal pill (Id + Live):**
| Button | Icon | Enabled when | Action |
|--------|------|--------------|--------|
| Id | IdIcon | `isStreaming` | Capture frame → navigate to `/id` |
| Live | LiveScanIcon | `isStreaming` | Toggle continuous face-scan overlay; green/pulsing when active |

**Top-right — horizontal pill (Action/Cut + Stream) with friend bubbles below:**
| Button | Icon | Enabled when | Action |
|--------|------|--------------|--------|
| Action | ActionIcon | `isStreaming` | Start video recording |
| Cut | CutIcon | Recording active | Stop recording; replaces Action, animated red pulse |
| Stream | StreamIcon | `isStreaming` | Start WHIP live stream |
| Stop | StopCircleIcon | Streaming out | Stop WHIP live stream; replaces Stream |
- Friend bubbles: vertical list of circular friend profile photos (red border) rendered below the top-right pill; each tap navigates to `/streams/watch`; shown only when live friend streams exist

**Bottom-left — Flip:**
| Button | Icon | Enabled when | Action |
|--------|------|--------------|--------|
| Flip | FlipCameraIcon | `isStreaming` | Cycle to next video input device |

### Center Video Area
- Black background container with 16:9 aspect ratio
- When no stream: centered placeholder (MovieCameraIcon, "Video Stream Container", "16:9 Aspect Ratio")
- When streaming: `<video autoPlay playsInline muted>` element; srcObject = mediaStream

### Right Sidebar
- "Stream" button (StreamIcon): enabled when `isStreaming && currentOutlet set`; disabled=opacity-30
- When streaming out: replaced by "Stop Stream" button (red/pink, StopCircleIcon, pulsing) + outlet name label
- Live Friends section (shown only when friends are streaming): small profile picture circles (red border), friend name truncated; click → navigate to `/streams/watch`

### Save Status Toast (bottom-center, floating)
- "Saving clip..." (blue)
- "Clip saved to library" (green, auto-dismisses after 2s)
- "Clip too large to save (50MB limit)" (red, auto-dismisses after 4s)
- "Save failed" (red, auto-dismisses after 4s)

### Camera Flash
- Full-screen white overlay, 0.4s fade animation on camera capture

### Auto-Connect on Mount
- On first mount: fetches user profile → checks `Connect_Last_Used_Device_After_Login_Fl` + `Last_Source_Device_Id` → if set, enumerates devices → connects video-only stream → sets `currentSource`

---

### Transition Data: HubScreen → IdScreen
```
navigate('/id', { state: { photoDataUrl: <data URL>, saveToLibrary: true } })
```

### Transition Data: HubScreen → SelectSourcePopup (overlay)
- No navigation; popup renders over HubScreen
- On close: popup unmounts, voicePaused restored

### Transition Data: HubScreen → StreamToPopup (overlay)
- No navigation; popup renders over HubScreen

---

## 3. SelectSourcePopup (Overlay from HubScreen)

### Layout
- Fixed full-screen dark backdrop (black/70% opacity)
- White/dark modal card, max-width 448px, scrollable body
- Header: "Select Source" title + X close button

### Sections (top to bottom)

**Video Sources**
- Label: "VIDEO SOURCES" (blue, uppercase, small)
- Scrollable list (max height 128px) of `videoinput` devices
  - Each row: device label (truncated) + checkmark if currently connected
  - Selected row: blue highlight
  - Unselected: dark gray, hover lighter
- "No devices found" empty state
- Connect button (blue, disabled if none selected) + Disconnect button (gray, disabled if none connected)

**Voice Sources**
- Label: "VOICE SOURCES" (blue, uppercase, small)
- If no `audioinput` devices enumerated: shows message "Microphone access required to list devices." + "Grant Microphone Access" button (blue, full width)
  - Grant button calls `getUserMedia({audio:true})`, stops tracks, re-enumerates
  - Error states: macOS-specific message for NotFoundError; Chrome permission message for NotAllowedError; generic for other errors
- If devices present: same connect/disconnect UI as Video Sources

**Audio Outputs**
- Label: "AUDIO OUTPUTS" (blue, uppercase, small)
- Same list/connect/disconnect UI for `audiooutput` devices

### Footer
- "Back" button (full width, gray) → closes popup

### Behaviour
- On mount: pauses GlobalVoiceCommands (`voicePaused=true`), calls `enumerateDevices()` (pure — no getUserMedia)
- On unmount: restores `voicePaused=false`
- Connected video initialised from `currentSource` context; connected audio from `currentAudioIn` context
- Connecting video: `getUserMedia({video:{deviceId:{exact}}})` with audio fallback to video-only; calls `startStream()`; saves `lastSourceDeviceId` to profile API
- Connecting audio: `getUserMedia({audio:{deviceId:{ideal}}})` (ideal not exact, to handle empty IDs); adds audio track to existing `mediaStream`; re-enumerates after success
- Disconnecting video: calls `stopStream()`, clears `currentSource`
- Disconnecting audio: stops audio tracks from `mediaStream`, clears `currentAudioIn`

---

## 4. StreamToPopup (Overlay from HubScreen)

### Layout
- Fixed full-screen dark backdrop
- Modal card, max-width ~400px
- Header: "Stream To" title + X close button

### Content
- Single outlet option: "CrowdView Live" (📡 icon)
- Select button → sets `currentOutlet`
- Cancel button → closes

### Transition Data: StreamToPopup → HubScreen
```
AppContext: currentOutlet = { id: 'crowdview', name: 'CrowdView Live', icon: '📡' }
```

---

## 5. IdScreen (`/id`)

### Entry Conditions
- Must receive `location.state.photoDataUrl` (data URL of captured image)
- Optional: `location.state.saveToLibrary` (bool) — true for fresh captures, false/absent for library re-views
- On mount: pauses GlobalVoiceCommands; on unmount: restores

### Layout
```
[AppHeader: MovieCameraIcon (→/hub) | "CrowdView" | FriendsIcon (→/friends)]
[Back btn] [Summary bar or loading/error] [Spacer]
[Photo with bounding box overlays — fills remaining height]
[NavBar]
[TrueFooter]
```

### Summary Bar (center of row below header)
- While loading: hidden
- On error: red pill — error message + "Retry" button
- No faces: gray pill — "No faces detected"
- Faces found: gray pill — "Identify Friends · N faces found · N friends · N identified · N unknown"

### Photo Area
- White-background container, height fills available space
- Photo: `<img>` tag, height=100%, width=auto
- Bounding box overlays (absolutely positioned % of photo dimensions)

### Bounding Box Overlay (per face)
- Border colour: green (#22c55e) = known, orange (#f97316) = identified, red (#ef4444) = unknown
- Border width: 2px
- Name label at bottom of box: friend name (known/identified) or "Unknown N" (sequential)
  - Background: green-700/80 (known), orange-700/80 (identified), red-700/80 (unknown)
- Click → opens FriendFormPopup (if known: edit mode; if unknown: add mode)
- Right-click (unknown faces only) → context menu: "Add photo to existing friend" → AddPhotoToFriendPopup

### Hover Tooltip (appears above/below box based on vertical position)
- Face name (coloured to match border)
- Group (if set)
- Age range
- Gender
- Emotion
- "Wearing mask" (if detected)
- "Eyeglasses" / "Sunglasses"
- "Beard"
- "Smiling"
- Note (if set)
- Bottom italic: "Click to view / edit" (known) | "Click to add · Right-click to assign to existing friend" (unknown) | "Click to view" (identified)

### Loading State
- Semi-transparent black overlay over photo
- Spinner (blue, 40px)
- "Identifying faces..." text

### Voice Commands (active on this screen, from useVoiceCommands hook)
- "prev" / "previous" → selects previous face
- "next" → selects next face
- "show" → opens FriendFormPopup for currently selected face

### Actions on Identification
- If `saveToLibrary=true`: fetches photo blob from data URL, POSTs to `/api/media` (fire-and-forget)
- POSTs `{imageData}` to `/api/rekognition/identify`

### Transition Data: IdScreen → FriendFormPopup
```
face object (friendId or null, friendName, boundingBox)
cropped face data URL (padded 12%)
```

---

## 6. FriendFormPopup (Overlay from IdScreen or ManageFriendsScreen)

### Modes
- **Add mode** (friend=null): create new friend, optionally with a captured face photo
- **Edit mode** (friend set): view/edit existing friend; photo wallet; link/unlink CrowdView account

### Layout
- Fixed full-screen dark backdrop
- Modal card, max-width ~448px, scrollable body
- Header: "Add Friend" or friend's name + X close button

### Fields
- Name (text, required)
- Note (textarea, optional)
- Group (dropdown: Friend, Family, Friend of Friend, Friend of Family, Business)

### Photo Wallet (edit mode)
- Grid of friend photos (from `/api/friends/:id/photos`)
- Each photo: thumbnail, delete button (X) on hover
- "Add Photo" button: file input → upload to `/api/friends/:id/photos`
- If a face crop was passed (from IdScreen): shown as "Captured face" with "Use this photo" button

### CrowdView Account Linking (edit mode)
- Shows link status: "Linked to [name] ([email])" or "Not linked"
- "Link Account" input (email) + Link button → PATCH `/api/friends/:id/link`
- "Unlink" button (if linked) → PATCH `/api/friends/:id/unlink`

### Buttons
- Save (primary) → POST or PUT `/api/friends/:id`
- Delete (red, edit mode only) → confirm → DELETE `/api/friends/:id`
- Cancel → closes without saving

### Voice Commands (screen=friends)
- "name [text]" → fills name field
- "note [text]" → fills note field
- "update" → submits form
- "cancel" → closes form

---

## 7. ManageFriendsScreen (`/friends`)

### Layout
```
[AppHeader: CameraIcon (back) | "CrowdView" | PlusIcon (add friend)]
[Group filter dropdown]
[Main: A-Z index sidebar (right) + Friends list (left)]
[NavBar]
[TrueFooter]
```

### Header
- Left: Camera icon → navigate back (to `/hub`)
- Center: "CrowdView"
- Right: Plus icon → triggers file picker (add friend via photo upload)

### Group Filter
- Dropdown: All, Friend, Family, Friend of Friend, Friend of Family, Business
- Filters the friends list; persists while on screen

### A-Z Index Sidebar (right side, vertical)
- Letters A–Z; clicking a letter scrolls the list to that section
- Letters with no friends shown dimmed or hidden

### Friends List
- Grouped by first letter of name, with letter section headers
- Each friend row:
  - Left: circular profile photo (60×60px) from `/api/friends/:id/photos/primary/data`; fallback: gray circle with 👤
  - "Linked" badge (blue pill) if `Friend_User_Id` is set
  - Center: Name (bold), Note (small, truncated), Group label (small, gray)
  - Right: red trash icon button → delete confirmation
- Click row (not trash) → opens FriendFormPopup in edit mode

### Empty State
- "No friends found" + "Add your first friend" link

### Add Friend Flow
- Plus icon clicked → hidden file input triggered
- User selects photo → reads as data URL → saves to `/api/media` → navigate to `/id` with `saveToLibrary:false` (already saved)
- IdScreen identifies faces → user clicks face → FriendFormPopup opens in add mode

### Delete Flow
- Trash button → confirmation dialog ("Are you sure you want to delete [name]?") → DELETE `/api/friends/:id`
- List refreshes after delete

---

## 8. ProfileScreen (`/profile`)

### Layout
```
[AppHeader: CameraIcon (→/hub) | "CrowdView" | FriendsIcon (→/friends)]
[Form card]
[NavBar]
[TrueFooter]
```

### Fields
| Field | Type | Notes |
|-------|------|-------|
| Email | Read-only display | Cannot be changed |
| Display Name | Text input, max 50 chars | Editable |
| New Password | Password input | Optional; leave blank to keep current |
| Confirm Password | Password input | Shown only when New Password has content |
| Connect Last Used Device on Login | Dropdown (Yes / No) | Controls auto-connect on login |

### Buttons
- Cancel → navigates back; if dirty (unsaved changes), shows browser confirm dialog
- Update → PUT `/api/users/profile` → success message; errors shown inline

### Dirty State
- Tracks whether any field has changed from loaded values
- Browser `beforeunload` warning if navigating away while dirty

---

## 9. LibraryScreen (`/library`)

### Layout
```
[AppHeader: CameraIcon | "CrowdView" | FriendsIcon]
[Row 1: Year filter pills (scrollable)]
[Row 2: Action buttons — Id | View | Export | Delete(N) — equal-width 4-column grid]
[Media grid — 6 columns]
[NavBar]
[TrueFooter]
```

### Year Filter Row (Row 1)
- Horizontally scrollable pill buttons: "All" + each distinct year present in media
- Active year: highlighted blue; filters grid to that year

### Action Row (Row 2)
- 4 equal-width buttons in a CSS grid (grid-cols-4); all buttons same height (h-9)
- Split into two rows to avoid overflow on narrow mobile screens

| Button | Enabled when | Action |
|--------|--------------|--------|
| Id | Single photo selected | Navigate to `/id` with `saveToLibrary:false` |
| View | Single item selected | Opens MediaViewer |
| Export | ≥1 item selected | File System Access API save dialog or blob download fallback |
| Delete (N) | ≥1 item selected | Confirm → DELETE each selected item; shows count in parens |

### Media Grid
- 6 columns; items grouped and displayed by month/year
- Month/year section headers (e.g., "March 2026")
- Each item:
  - Photo: thumbnail (img from `/api/media/:id/data`)
  - Video: thumbnail + play icon overlay
  - Selected state: blue border + checkmark overlay (top-right)
  - Single click → select/deselect (250ms debounce to avoid conflicts with double-click)
  - Double-click → open MediaViewer

### MediaViewer Popup
- Full-screen modal with dark backdrop
- Shows full photo or `<video controls>` player
- Counter: "N / M" (current / total selected)
- Left/right arrow buttons (disabled at first/last)
- X close button (top-right)
- Keyboard: Escape = close, ← → = navigate

---

## 10. StreamsScreen (`/streams`)

### Layout
```
[AppHeader: CameraIcon | "CrowdView" | FriendsIcon]
[Tab bar: "🔴 Live Now (N)" | "📼 Past Streams"]
[Stream card list]
[NavBar]
[TrueFooter]
```

### Tab Bar
- "🔴 Live Now (N)" — count badge showing number of live streams
- "📼 Past Streams"
- Active tab highlighted

### Stream Card
- Thumbnail placeholder (gray, broadcast icon)
- Streamer name
- Stream title
- Duration or "Started X minutes ago" (live tab)
- LiveBadge (red pulsing dot + "LIVE" text) — live tab only
- "Watch" button (blue) → navigate to `/streams/watch`

### Data Refresh
- Live streams: fetched on mount and every 30 seconds (`/api/stream/live`)
- Past streams: fetched on mount (`/api/stream/past`)

---

## 11. StreamWatchScreen (`/streams/watch`)

### Entry
- `location.state.stream`: stream object; `location.state.isLive`: boolean

### Layout
```
[AppHeader: BackIcon (→/streams) | "CrowdView" | (no right button)]
[Info bar: broadcast icon + streamer name + title + LiveBadge if live]
[Video player — fills remaining height]
[NavBar]
[TrueFooter]
```

### Video Player
- Live streams: HLS.js with `lowLatencyMode: true`, URL `{HLS_BASE}/live/{Stream_Key_Txt}/index.m3u8`
- Past streams (VOD): native `<video src>` set directly to the `.mp4` recording URL (HLS.js is NOT used for VOD — it only handles `.m3u8` manifests)
- VOD plays the **first segment only** from `stream.recordings[0]`. ⚠ Multi-segment recordings (long streams split by MediaMTX) are not yet supported — only the first `.mp4` file is played. Full multi-segment playback is a future requirement.

### States
- Loading: spinner
- Error: message + "Back to Streams" link

---

## 12. ResetPasswordScreen (`/reset-password`)

### Entry
- URL query param: `token=<reset_token>`

### Layout
- Centred card (same style as SplashScreen)
- "Reset Password" heading

### Fields
- New Password (type=password)
- Confirm New Password (type=password)

### Buttons
- "Reset Password" (primary, full width)
- "Back to Sign In" (text link)

### States
- Success: confirmation message → navigate to `/` after short delay
- Error: "Invalid or expired link" message

---

## 13. PostScreen (`/post`) — Stub

### Entry
- `location.state.mediaItems`: array of media items to post

### Layout
- 3-column: photo carousel | platform selector | tagged friends

### Carousel
- Photo/video display with prev/next arrows and counter

### Platform Selector
- Facebook, Instagram, YouTube, TikTok
- Each: icon, name, "Authorize" label (if not connected)
- Toggled selection (only authorized platforms selectable)

### Tagged Friends
- Runs face identification on all media items on mount
- Lists identified friends

### Actions
- "Confirm Post" → simulates posting (1.5s delay) → TTS confirmation → navigate to `/library`
- Platform authorization: stored in `localStorage` (stub, no real OAuth)

⚠ PostScreen is a stub. No real social API integration exists. Confirm whether this is in MVP scope or can be deferred.

---

## 14. NavBar (Global — appears on all authenticated screens)

### Layout
- Fixed bottom bar, full width
- Tabs equally spaced (5 for individual users; 5 for corporate non-OAU; 6 for OAU)

### Tabs — Individual users
| Tab | Icon | Path / Action |
|-----|------|--------------|
| Home | HomeIcon | `/hub` |
| Friends | FriendsIcon | `/friends` |
| Library | LibraryIcon | `/library` |
| Streams | StreamsIcon | `/streams` |
| User Menu | PersonIcon | Opens MenuSlideout |

- Active tab highlighted (based on current route)
- "User Menu" opens a slide-out menu (not a navigation route)

### MenuSlideout (individual users only)
- Slides in from left
- Items: Profile (→ `/profile`), About, Contact, Logout
- Logout clears session and navigates to `/`

### Tabs — Corporate users (non-OAU)
| Tab | Icon | Path / Action |
|-----|------|--------------|
| Home | HomeIcon | `/hub` |
| Customers | FriendsIcon | `/friends` |
| Library | LibraryIcon | `/library` |
| Streams | StreamsIcon | `/streams` |
| Logout | LogoutIcon | Calls `logout()` directly; navigates to `/` |

- No User Menu tab; no MenuSlideout; no ProfileScreen access
- "Friends" tab relabelled "Customers"

### Tabs — OAU (Org Admin User)
| Tab | Icon | Path / Action |
|-----|------|--------------|
| Home | HomeIcon | `/hub` |
| Customers | FriendsIcon | `/friends` |
| Library | LibraryIcon | `/library` |
| Streams | StreamsIcon | `/streams` |
| Users | UsersIcon | `/corporate/users` |
| Logout | LogoutIcon | Calls `logout()` directly; navigates to `/` |

- Same as corporate non-OAU plus an additional "Users" tab

---

## 15. CorporateUsersScreen (`/corporate/users`) — OAU only

### Access Guard
- `OAUGuard` wrapper in `App.jsx`; redirects non-OAU users to `/hub`

### Layout
```
[AppHeader: HubIcon (→/hub) | "CrowdView Corporate" | PlusIcon (add user)]
[A-Z indexed user list]
[NavBar (OAU tabs)]
[TrueFooter]
```

### Header
- Left: Hub icon → navigates to `/hub`
- Center: "CrowdView Corporate" (bold)
- Right: Plus icon → opens CorporateUserForm popup in add mode

### User List
- A-Z indexed, same visual structure as ManageFriendsScreen
- Sorted alphabetically by name; letter section headers
- Each user row:
  - Left: circular avatar placeholder (initials or generic icon)
  - Center: Name (bold), Email (small, gray)
  - Right: "Admin" badge (blue pill) if `Corporate_Admin_Fl = 'Y'`; red trash icon button → delete confirmation
- Tapping/clicking a row (not trash) → opens CorporateUserForm popup in edit mode

### Delete Flow
- Trash button → confirmation dialog ("Are you sure you want to remove [name] from the organisation?") → DELETE `/api/corporate/users/:id`
- If OAU attempts to delete themselves: button disabled or shows error "You cannot delete your own account"
- List refreshes after delete

### Empty State
- "No users in your organisation" + "Add your first user" link

---

## 16. CorporateUserForm Popup (Overlay from CorporateUsersScreen)

### Modes
- **Add mode** (no existing user): create a new org user
- **Edit mode** (existing user): update user details; reset password

### Layout
- Fixed full-screen dark backdrop
- Modal card, max-width ~448px, scrollable body
- Header: "Add User" (add mode) or user's name (edit mode) + X close button

### Fields — Add mode

| Field | Type | Notes |
|-------|------|-------|
| Email | email input | Required; must be unique across the system |
| Password | password input | Required; minimum 6 characters |
| Name | text input | Required; max 100 characters |
| Connect Last Device | toggle (Yes/No) | Sets `Connect_Last_Used_Device_After_Login_Fl`; default No |
| Organisation Admin | toggle (Yes/No) | Sets `Corporate_Admin_Fl`; default No |

### Fields — Edit mode

| Field | Type | Notes |
|-------|------|-------|
| Email | read-only display | Cannot be changed after creation |
| Name | text input | Editable |
| Connect Last Device | toggle (Yes/No) | Editable |
| Organisation Admin | toggle (Yes/No) | Editable; disabled and locked to 'Y' when editing own record (OAU cannot demote themselves) |

### Reset Password Section (edit mode only)
- Section heading: "Reset Password"
- New Password field (type=password, placeholder "Enter new password")
- "Reset Password" button (blue) → POST `/api/corporate/users/:id/reset-password`
- Success: inline green confirmation message; field cleared
- Error: inline red error message

### Buttons
- Save (primary) → POST `/api/corporate/users` (add) or PUT `/api/corporate/users/:id` (edit)
- Cancel → closes popup without saving

### Validation
- Email required and valid format (add mode only)
- Password required, ≥ 6 chars (add mode); Reset Password field ≥ 6 chars
- Name required
- API errors shown inline below the relevant field

### Constraints
- OAU cannot toggle their own Organisation Admin toggle to 'No' — toggle is disabled on own record
- OAU cannot see or trigger delete from within the form — delete is only available from the list row

---

## Screen Transition Summary

| From | Trigger | To | Data Passed |
|------|---------|-----|-------------|
| SplashScreen | Login/Signup success | HubScreen | Auth state in sessionStorage |
| HubScreen | Id button | IdScreen | `photoDataUrl`, `saveToLibrary:true` |
| HubScreen | Camera button | (no nav) | Saves to `/api/media` |
| HubScreen | Friends header link | ManageFriendsScreen | — |
| HubScreen | Library header link | LibraryScreen | — |
| HubScreen | Live friend click | StreamWatchScreen | `stream`, `isLive:true` |
| GlobalVoiceCommands | "scan" voice | IdScreen | `photoDataUrl`, `saveToLibrary:true` |
| IdScreen | Back button | Previous screen | — |
| IdScreen | MovieCamera icon | HubScreen | — |
| IdScreen | FriendsIcon | ManageFriendsScreen | — |
| LibraryScreen | Id button | IdScreen | `photoDataUrl`, `saveToLibrary:false` |
| ManageFriendsScreen | Plus → upload photo | IdScreen | `photoDataUrl`, `saveToLibrary:false` |
| StreamsScreen | Watch button | StreamWatchScreen | `stream`, `isLive:bool` |
| NavBar (OAU) | Users tab | CorporateUsersScreen | — |
| CorporateUsersScreen | Plus icon / row tap | CorporateUserForm (overlay) | user object (edit) or null (add) |
| CorporateUserForm | Save (add) | CorporateUsersScreen | List refresh |
| CorporateUsersScreen | Hub icon | HubScreen | — |
