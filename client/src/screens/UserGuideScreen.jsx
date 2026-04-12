import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';

const SECTIONS = [
  { id: 'hub',       label: 'The Hub Screen' },
  { id: 'customers', label: 'Customers' },
  { id: 'users',     label: 'Users' },
  { id: 'streams',   label: 'Streams' },
  { id: 'library',   label: 'Library' },
  { id: 'employees', label: 'Employees' },
  { id: 'platforms', label: 'Web vs Mobile vs Wearables' },
  { id: 'glasses',   label: 'INMO Air 3 AR Glasses' },
];

export default function UserGuideScreen() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-slate-700 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-gray-700">
            <BackIcon className="w-5 h-5" />
          </button>
          <div>
            <p className="text-white font-bold text-base leading-tight">User Guide</p>
            <p className="text-gray-400 text-xs">CrowdView · crowdview.tv</p>
          </div>
        </div>
        <button onClick={() => setMenuOpen(o => !o)} className="text-gray-400 hover:text-white text-xs border border-gray-600 px-2.5 py-1 rounded-lg">
          Contents
        </button>
      </div>

      {/* Contents dropdown */}
      {menuOpen && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
          {SECTIONS.map((s, i) => (
            <button key={s.id} onClick={() => scrollTo(s.id)}
              className="block w-full text-left text-gray-300 hover:text-white text-sm py-1.5 border-b border-gray-700 last:border-0">
              <span className="text-gray-500 mr-2">{i + 1}.</span>{s.label}
            </button>
          ))}
        </div>
      )}

      <main className="flex-1 flex justify-center px-4 py-6 pb-16">
        <div className="w-full max-w-2xl space-y-8">

          {/* Intro */}
          <div className="bg-blue-900/40 border border-blue-700/50 rounded-xl p-5">
            <h1 className="text-white font-bold text-xl mb-2">CrowdView User Guide</h1>
            <p className="text-gray-300 text-sm leading-relaxed">
              A complete reference for every screen and feature in CrowdView. Use the Contents button above to jump to any section, or read through from top to bottom.
            </p>
          </div>

          {/* Contents */}
          <div className="bg-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">In this guide</p>
            <ol className="space-y-1">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <button onClick={() => scrollTo(s.id)} className="text-blue-400 hover:text-blue-300 text-sm text-left">
                    {i + 1}. {s.label}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {/* ── 1 ── Hub Screen */}
          <Section id="hub" number="1" title="The Hub Screen">
            <P>The Hub Screen is the heart of CrowdView — it combines a live camera feed, real-time face detection, and instant customer lookup in a single view.</P>

            <H3>Camera Feed</H3>
            <P>When you open the Hub Screen, your device camera connects automatically. The feed fills the upper portion of the screen. If camera access is denied, a prompt explains how to grant it in your browser settings.</P>

            <H3>Toolbar Buttons</H3>
            <div className="mt-2 space-y-2">
              {[
                ['ID',     'Single-scan button. Captures one frame and identifies all faces in it. Uses 1 detection token.'],
                ['Live',   'Continuous scan mode. Identifies faces approximately 2 times per second until you tap again. Each scan uses 1 token. Button turns green when active.'],
                ['Source', 'Switch between connected cameras — webcam, phone camera, or smart glasses feed.'],
                ['Stream', 'Broadcast your camera feed so back-office users can watch in real time via the Streams screen.'],
                ['+',      'Add a new customer record manually, without a photo.'],
                ['Group',  'Upload a group photo. CrowdView detects all faces and guides you through naming the unknown ones.'],
              ].map(([btn, desc]) => (
                <div key={btn} className="flex items-start gap-3">
                  <div className="bg-gray-700 text-blue-300 text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 mt-0.5 min-w-[3rem] text-center">{btn}</div>
                  <p className="text-gray-300 text-sm">{desc}</p>
                </div>
              ))}
            </div>

            <H3>Detection Results</H3>
            <P>Each identified face appears as a tile below the camera feed. Tiles show the person's name, tier badge (corporate), and any stored note. Bounding boxes overlay the face in the video with a colour indicating status:</P>
            <div className="mt-2 space-y-1.5">
              {[
                ['bg-green-500',  'Green / tier colour', 'Known customer'],
                ['bg-white',      'White',               'Employee'],
                ['bg-orange-500', 'Orange',              'Friend of a linked account'],
                ['bg-red-500',    'Red',                 'Unknown — not in database'],
              ].map(([dot, label, desc]) => (
                <div key={label} className="flex items-start gap-2.5">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${dot}`} />
                  <span className="text-white text-sm font-medium">{label}</span>
                  <span className="text-gray-400 text-sm">— {desc}</span>
                </div>
              ))}
            </div>

            <H3>Interacting with Results</H3>
            <Steps>
              <Step n="1">Tap a face tile or tap a bounding box on the video to open that customer's full record.</Step>
              <Step n="2">From the record you can edit details, add notes, change tier, or add more photos.</Step>
              <Step n="3">For unknown faces, a prompt asks whether you want to add them as a new customer.</Step>
            </Steps>
            <Tip>Keep Live mode on only when you are actively monitoring. Turning it off between rushes saves tokens significantly.</Tip>
          </Section>

          {/* ── 2 ── Customers */}
          <Section id="customers" number="2" title="Customers">
            <P>The Customers screen (tap the people icon in the navigation bar) is where all customer records are stored, searched, and managed.</P>

            <H3>Customer List</H3>
            <P>Customers are listed alphabetically. Each row shows the person's name, tier badge (if assigned), group, and a thumbnail of their most recently used photo. A search bar at the top filters the list instantly as you type.</P>

            <H3>Adding a Customer</H3>
            <Steps>
              <Step n="1">Tap the <strong>+</strong> button to open the customer form.</Step>
              <Step n="2">Enter a name (required). Optionally add a note, group label, and — for corporate accounts — assign a customer tier.</Step>
              <Step n="3">Tap <strong>Save</strong>. The new customer appears in the list.</Step>
              <Step n="4">Open the customer record and tap <strong>Add Photo</strong> to upload one or more face photos. More photos improves recognition accuracy.</Step>
            </Steps>

            <H3>Editing a Customer</H3>
            <Steps>
              <Step n="1">Tap any customer row to open the record.</Step>
              <Step n="2">Edit any field directly and tap <strong>Save</strong>.</Step>
              <Step n="3">To add or remove photos, use the <strong>Add Photo</strong> button or the delete (×) icon on individual photos.</Step>
            </Steps>

            <H3>Linking Accounts (Individual Users)</H3>
            <P>Individual (non-corporate) users can share recognition with another CrowdView user by linking accounts. Open a customer record, scroll to <strong>CrowdView Account</strong>, enter the other user's email, and tap <strong>Link</strong>. The link is bi-directional — both parties gain access to each other's full customer list for detection purposes immediately.</P>

            <H3>Customer Tiers (Corporate)</H3>
            <P>Corporate organisations can assign every customer to a tier — for example Standard, Gold, VIP, or a custom tier you define. The tier name and colour appear as a badge on customer rows, Dashboard rows, and as the bounding box colour during live detection. Tiers are managed via the gear icon on the Customers screen (admin only).</P>

            <H3>Groups</H3>
            <P>The Group field is a free-text tag you can use to organise customers into any category you like — "Regular", "Table 12", "Conference A". Groups appear as labels on customer rows and can be used to filter the list.</P>

            <Tip>Adding at least 3–5 photos per customer — taken in different lighting conditions and angles — significantly improves recognition rates.</Tip>
          </Section>

          {/* ── 3 ── Users */}
          <Section id="users" number="3" title="Users">
            <P>The Users screen is available to Corporate Admins and controls who can access your organisation's CrowdView account.</P>

            <H3>User Roles</H3>
            <div className="mt-2 space-y-2">
              {[
                ['Admin',    'Full access: manage users, employees, tiers, and view all dashboard data.'],
                ['Operator', 'Can detect and identify customers, add and edit customer records. Cannot manage users or settings.'],
              ].map(([role, desc]) => (
                <div key={role} className="flex items-start gap-3">
                  <div className="bg-blue-700 text-white text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 mt-0.5">{role}</div>
                  <p className="text-gray-300 text-sm">{desc}</p>
                </div>
              ))}
            </div>

            <H3>Adding a User</H3>
            <Steps>
              <Step n="1">Open the <strong>Users</strong> screen from the navigation bar or side menu.</Step>
              <Step n="2">Tap <strong>Add User</strong> and enter the name, email address, and a temporary password.</Step>
              <Step n="3">The new user can log in immediately and will be automatically scoped to your organisation's customer database.</Step>
            </Steps>

            <H3>Editing and Removing Users</H3>
            <Steps>
              <Step n="1">Tap any user row to edit their name, email, or password.</Step>
              <Step n="2">Tap <strong>Delete</strong> to remove the user. Their detection history is retained in the Dashboard.</Step>
            </Steps>

            <H3>Dashboard Statistics per User</H3>
            <P>The Dashboard shows per-user detection counts (session, month, year) so you can see which operator is busiest or spot unusual usage patterns.</P>

            <Tip>There is no limit on the number of users in a corporate organisation. Create a dedicated user for each physical front desk or device for the cleanest Dashboard reporting.</Tip>
          </Section>

          {/* ── 4 ── Streams */}
          <Section id="streams" number="4" title="Streams">
            <P>Streams let back-office staff or remote monitors watch a live camera feed with face-overlay data in real time — without having a camera themselves.</P>

            <H3>Starting a Stream (Front Desk / Camera Operator)</H3>
            <Steps>
              <Step n="1">On the Hub Screen, tap the <strong>Stream</strong> button (broadcast icon).</Step>
              <Step n="2">A popup shows the available stream targets — select the outlet (channel) you want to broadcast to.</Step>
              <Step n="3">Your camera feed is now live. The Stream button turns active to indicate broadcasting.</Step>
              <Step n="4">Tap the Stream button again and select <strong>Stop</strong> to end the broadcast.</Step>
            </Steps>

            <H3>Watching a Stream (Back Office / Remote)</H3>
            <Steps>
              <Step n="1">Open the <strong>Streams</strong> screen (broadcast icon in the navigation bar).</Step>
              <Step n="2">Active streams from users in your organisation are listed. Tap any stream to open the live view.</Step>
              <Step n="3">The view shows the video feed with the same coloured bounding boxes and customer labels as the sending device — updated in real time.</Step>
              <Step n="4">Tap any face in the stream view to see full customer details.</Step>
            </Steps>

            <H3>Stream Latency</H3>
            <P>Stream latency is typically 2–5 seconds over a good network connection. Streams are delivered via HLS — all major browsers and devices are supported.</P>

            <Tip>Streams are especially useful for venue managers, VIP hosts, or security personnel who need situational awareness from a central location without attending every entry point themselves.</Tip>
          </Section>

          {/* ── 5 ── Library */}
          <Section id="library" number="5" title="Library">
            <P>The Library screen stores a timestamped log of every photo captured during an ID action on the Hub Screen. It is a searchable, browsable history of all recognition events.</P>

            <H3>Browsing the Library</H3>
            <P>Photos are grouped by month and year. Each entry shows the capture date, time, and a thumbnail. Tap a photo to view it full screen.</P>

            <H3>Filtering</H3>
            <Steps>
              <Step n="1">Use the <strong>Year</strong> and <strong>Month</strong> filter buttons (desktop/tablet) to jump to a specific period.</Step>
              <Step n="2">On mobile, swipe or scroll through the timeline.</Step>
            </Steps>

            <H3>Exporting a Photo</H3>
            <Steps>
              <Step n="1">Tap a photo to open the full-screen viewer.</Step>
              <Step n="2">Tap the <strong>Export</strong> button to download the photo to your device.</Step>
            </Steps>

            <H3>Deleting Photos</H3>
            <Steps>
              <Step n="1">In the library list, tap the <strong>Delete</strong> icon on a photo row to remove it.</Step>
              <Step n="2">Deleting a library photo does not affect the customer record or their enrolled face photos.</Step>
            </Steps>

            <H3>Photo Quality</H3>
            <P>Library photos are saved at the full resolution of your camera — typically 1920×1080 or better on modern devices. Make sure your browser has granted the highest available camera resolution for the best capture quality.</P>

            <Tip>The Library is available to each individual user. Corporate admins can see their own captures; they do not see captures made by other users in the organisation.</Tip>
          </Section>

          {/* ── 6 ── Employees */}
          <Section id="employees" number="6" title="Employees">
            <P>The Employees feature is available to Corporate organisations and lets you enrol your own staff so CrowdView can distinguish them from customers during live detection.</P>

            <H3>Why Employees?</H3>
            <P>Without employee records, staff walking in front of a front-desk camera would appear as unknown (red) faces. Enrolling employees lets CrowdView label them as <strong>Employee: [Name]</strong> with a white bounding box, keeping your detection results clean.</P>

            <H3>Adding an Employee</H3>
            <Steps>
              <Step n="1">Open the <strong>Employees</strong> section (accessible via the side menu or Users screen, Admin only).</Step>
              <Step n="2">Tap <strong>Add Employee</strong> and enter the employee's name.</Step>
              <Step n="3">Add one or more face photos using the <strong>Add Photo</strong> button.</Step>
              <Step n="4">Save. The employee is immediately enrolled and will be recognised at all front desks in the organisation.</Step>
            </Steps>

            <H3>Employee Attendance</H3>
            <P>CrowdView records one attendance entry per employee per day when they are detected. The Dashboard shows a per-employee attendance log so you can track shift presence without a separate system.</P>

            <H3>Removing an Employee</H3>
            <Steps>
              <Step n="1">Open the employee record and tap <strong>Delete</strong>.</Step>
              <Step n="2">Their face data is removed from the recognition collection immediately. Their historical attendance records are retained in the Dashboard.</Step>
            </Steps>

            <Tip>Employees are stored at the organisation level, not per user — a single employee record covers all desks and all users in the organisation.</Tip>
          </Section>

          {/* ── 7 ── Platforms */}
          <Section id="platforms" number="7" title="Web vs Mobile vs Wearables">
            <P>CrowdView is designed to work across multiple device types. Here is a comparison of what is available on each platform.</P>

            <H3>Web (Chrome on Desktop / Laptop)</H3>
            <P>The full CrowdView experience. Recommended for fixed front desk installations where the device is positioned at a door or counter and left running.</P>
            <div className="mt-2 space-y-1">
              {[
                'Full Live scan and ID scan',
                'Stream broadcast and watch',
                'Customer, User, Employee management',
                'Library and Dashboard',
                'Group photo import',
                'Voice commands (Chrome only)',
              ].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
                  <span className="text-gray-300 text-sm">{f}</span>
                </div>
              ))}
            </div>

            <H3>Mobile (iPhone &amp; Android App)</H3>
            <P>The CrowdView mobile app provides the full feature set in a portable form factor. Use your phone as a handheld scanner at events, in a venue, or wherever you need to move around.</P>
            <div className="mt-2 space-y-1">
              {[
                'Full Live scan and ID scan using phone camera',
                'Stream broadcast and watch',
                'Customer management on the go',
                'Library and Dashboard',
                'Portrait or landscape orientation',
              ].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
                  <span className="text-gray-300 text-sm">{f}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 space-y-1">
              {[
                'Voice commands not supported on iOS (WebKit limitation)',
              ].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                  <span className="text-gray-400 text-sm">{f}</span>
                </div>
              ))}
            </div>

            <H3>Wearables (INMO Air 3 AR Glasses)</H3>
            <P>The CrowdView AR app runs directly on the INMO Air 3 glasses. Launch it from the <strong>AR</strong> button on the Hub Screen of your Android phone — your session transfers automatically. The glasses camera scans the crowd and overlays coloured bounding boxes and names directly in your field of view, completely hands-free.</P>
            <div className="mt-2 space-y-1">
              {[
                'Full face detection and identification overlaid in AR',
                'Entirely hands-free — full voice command set',
                'Add and update contacts by voice without touching a screen',
                'Pause and resume overlay on demand',
                'Cycle through detected faces by voice',
                'Compatible with INMO Air 3 only',
              ].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
                  <span className="text-gray-300 text-sm">{f}</span>
                </div>
              ))}
            </div>
            <P className="mt-2">See the <button onClick={() => scrollTo('glasses')} className="text-blue-400 hover:text-blue-300 underline">INMO Air 3 AR Glasses</button> section below for the full voice command reference.</P>

            <H3>Platform Feature Summary</H3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-700">
                    <th className="text-left pb-2 font-medium">Feature</th>
                    <th className="text-center pb-2 font-medium">Web</th>
                    <th className="text-center pb-2 font-medium">Mobile</th>
                    <th className="text-center pb-2 font-medium">Glasses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {[
                    ['Live Detection',        '✓', '✓', '✓'],
                    ['ID Scan',               '✓', '✓', '✓'],
                    ['Stream Broadcast',      '✓', '✓', '✗'],
                    ['Stream Watch',          '✓', '✓', '✗'],
                    ['Customer Management',   '✓', '✓', '✗'],
                    ['Employee Management',   '✓', '✗', '✗'],
                    ['Library',               '✓', '✓', '✗'],
                    ['Dashboard',             '✓', '✓', '✗'],
                    ['Voice Commands',        '✓', '✗', '✓'],
                    ['Group Photo Import',    '✓', '✓', '✗'],
                  ].map(([feat, web, mob, glass]) => (
                    <tr key={feat}>
                      <td className="py-2 text-gray-300">{feat}</td>
                      <td className={`py-2 text-center font-medium ${web === '✓' ? 'text-green-400' : 'text-gray-600'}`}>{web}</td>
                      <td className={`py-2 text-center font-medium ${mob === '✓' ? 'text-green-400' : 'text-gray-600'}`}>{mob}</td>
                      <td className={`py-2 text-center font-medium ${glass === '✓' ? 'text-green-400' : 'text-gray-600'}`}>{glass}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Tip>For the best image quality and recognition accuracy, use a device with a high-resolution camera (12 MP or better) and ensure good, even lighting — avoid positioning cameras directly facing bright windows or light sources.</Tip>
          </Section>

          {/* ── 8 ── INMO Air 3 AR Glasses */}
          <Section id="glasses" number="8" title="INMO Air 3 AR Glasses">
            <P>The CrowdView AR app runs natively on the INMO Air 3 glasses and is controlled entirely by voice — no touchscreen required. It is a separate app from the main CrowdView phone app and must be installed on the glasses separately.</P>

            <H3>Getting Started</H3>
            <Steps>
              <Step n="1">Install the CrowdViewAR app on your INMO Air 3 glasses.</Step>
              <Step n="2">Open the CrowdView app on your paired Android phone and log in.</Step>
              <Step n="3">On the Hub Screen, tap the blue <strong>AR</strong> button (glasses icon, top-left panel).</Step>
              <Step n="4">Your session transfers automatically to the glasses — no separate login needed.</Step>
              <Step n="5">Point the glasses camera at a crowd. Face detection begins immediately.</Step>
            </Steps>

            <H3>What You See</H3>
            <P>Detected faces are outlined with coloured bounding boxes overlaid directly on your field of view. Each box is labelled with the person's name (or "Unknown" if not recognised). Box colour follows the same convention as the phone app:</P>
            <div className="mt-2 space-y-1.5">
              {[
                ['bg-green-500',  'Green',  'Known contact'],
                ['bg-orange-400', 'Orange', 'Identified via linked account'],
                ['bg-white',      'White',  'Employee (corporate)'],
                ['bg-red-500',    'Red',    'Unknown — not in database'],
              ].map(([dot, label, desc]) => (
                <div key={label} className="flex items-start gap-2.5">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${dot}`} />
                  <span className="text-white text-sm font-medium w-20 flex-shrink-0">{label}</span>
                  <span className="text-gray-400 text-sm">— {desc}</span>
                </div>
              ))}
            </div>
            <P>The selected face (after saying <strong>next</strong> or <strong>prev</strong>) is highlighted with a thicker outline, a subtle colour fill, and a ▶ prefix on its label.</P>

            <H3>Voice Commands — Scanning</H3>
            <div className="mt-2 space-y-2">
              {[
                ['scan',            'Capture the current frame and identify all faces in it.'],
                ['pause',           'Hide the overlay and stop sending frames to the server. Says "Paused."'],
                ['resume / unpause','Restore the overlay and resume scanning. Re-draws the last known faces instantly. Says "Resuming."'],
                ['stop',            'Full stop — clears all overlays and face memory.'],
              ].map(([cmd, desc]) => (
                <div key={cmd} className="flex items-start gap-3">
                  <code className="bg-gray-700 text-blue-300 text-xs font-mono px-2 py-0.5 rounded flex-shrink-0 mt-0.5 whitespace-nowrap">{cmd}</code>
                  <p className="text-gray-300 text-sm">{desc}</p>
                </div>
              ))}
            </div>

            <H3>Voice Commands — Cycling Faces</H3>
            <P>After a scan you can step through each detected face one at a time. The glasses speak the name and status of each face as you land on it.</P>
            <div className="mt-2 space-y-2">
              {[
                ['next',       'Move to the next detected face. Speaks its name and status.'],
                ['prev / previous', 'Move back to the previous face.'],
                ['clear',      'Deselect the current face.'],
              ].map(([cmd, desc]) => (
                <div key={cmd} className="flex items-start gap-3">
                  <code className="bg-gray-700 text-blue-300 text-xs font-mono px-2 py-0.5 rounded flex-shrink-0 mt-0.5 whitespace-nowrap">{cmd}</code>
                  <p className="text-gray-300 text-sm">{desc}</p>
                </div>
              ))}
            </div>

            <H3>Voice Commands — Adding a Contact</H3>
            <P>Two ways to add an unknown face as a new contact:</P>
            <div className="mt-2 space-y-2 mb-3">
              {[
                ['add',                      'If a face is selected (via next/prev), starts the add flow for that face directly.'],
                ['add unknown N',            'Starts the add flow for unknown face number N (1-based). Works without a selection.'],
                ['add unknown N, Name, Group, save', 'Single-shot: adds the face in one command without a multi-turn conversation.'],
              ].map(([cmd, desc]) => (
                <div key={cmd} className="flex items-start gap-3">
                  <code className="bg-gray-700 text-blue-300 text-xs font-mono px-2 py-0.5 rounded flex-shrink-0 mt-0.5 whitespace-nowrap">{cmd}</code>
                  <p className="text-gray-300 text-sm">{desc}</p>
                </div>
              ))}
            </div>
            <P>Multi-turn add flow (after saying <strong>add</strong> or <strong>add unknown N</strong>):</P>
            <Steps>
              <Step n="1">Glasses ask: <em>"What's their name?"</em> — say the name.</Step>
              <Step n="2">Glasses ask: <em>"What group?"</em> — say the group (e.g. "Family", "Work").</Step>
              <Step n="3">Glasses confirm: <em>"Save [Name] to [Group]?"</em> — say <strong>save</strong> or <strong>yes</strong> to confirm, <strong>cancel</strong> or <strong>no</strong> to abort.</Step>
            </Steps>

            <H3>Voice Commands — Updating a Contact</H3>
            <div className="mt-2 space-y-2">
              {[
                ['update Name, group NewGroup, save', 'Change the group for a known contact.'],
                ['update Name, note New note text, save', 'Update the note for a known contact.'],
              ].map(([cmd, desc]) => (
                <div key={cmd} className="flex items-start gap-3">
                  <code className="bg-gray-700 text-blue-300 text-xs font-mono px-2 py-0.5 rounded flex-shrink-0 mt-0.5 whitespace-nowrap">{cmd}</code>
                  <p className="text-gray-300 text-sm">{desc}</p>
                </div>
              ))}
            </div>

            <H3>Corporate Mode</H3>
            <P>If you are logged in as a corporate user the AR app detects this automatically. Voice prompts adjust accordingly — the glasses will say <em>"What's the customer's name?"</em> and <em>"What department?"</em> instead of the individual-mode equivalents. Employee faces are outlined in white and cannot be added as contacts.</P>

            <H3>Connectivity</H3>
            <P>The glasses connect to the CrowdView server over WiFi 6. On a golf course or any location without a dedicated WiFi network, use your phone as a mobile hotspot — the glasses connect to it as a standard WiFi client with no additional configuration.</P>

            <Tip>Say <strong>next</strong> after a scan to quickly hear who is in front of you before deciding whether to add anyone — it's faster than reading the overlay labels at a glance.</Tip>
          </Section>

          <div className="text-center pb-4">
            <p className="text-gray-500 text-xs">New to CrowdView? Start with the <a href="/quickstart" className="text-blue-400 hover:text-blue-300 underline">Quick Start Guide</a>.</p>
          </div>

        </div>
      </main>
    </div>
  );
}

function Section({ id, number, title, children }) {
  return (
    <div id={id} className="bg-gray-800 rounded-xl p-6 scroll-mt-16">
      <div className="flex items-start gap-3 mb-4">
        <div className="bg-blue-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{number}</div>
        <h2 className="text-white font-semibold text-base leading-snug">{title}</h2>
      </div>
      <div className="text-gray-300 text-sm leading-relaxed space-y-3">
        {children}
      </div>
    </div>
  );
}
function H3({ children }) { return <p className="text-white font-medium mt-4 mb-1">{children}</p>; }
function P({ children }) { return <p>{children}</p>; }
function Steps({ children }) { return <ol className="space-y-2">{children}</ol>; }
function Step({ n, children }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="text-blue-400 font-semibold flex-shrink-0 w-4">{n}.</span>
      <span>{children}</span>
    </li>
  );
}
function Tip({ children }) {
  return (
    <div className="mt-3 bg-amber-900/30 border border-amber-700/40 rounded-lg px-4 py-3">
      <span className="text-amber-400 text-xs font-semibold">TIP  </span>
      <span className="text-amber-100/80 text-sm">{children}</span>
    </div>
  );
}
