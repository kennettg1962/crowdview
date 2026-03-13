# User Requirements Log

Append-only log of user requests, ordered chronologically. Each entry records what was asked, the date, and a category tag.

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
