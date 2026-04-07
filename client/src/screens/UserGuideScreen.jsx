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

            <H3>Wearables (Smart Glasses)</H3>
            <P>Connect smart glasses to your phone or tablet and use the glasses camera as the CrowdView input source. The Hub Screen displays detection results on your device while the glasses provide a hands-free first-person view.</P>
            <div className="mt-2 space-y-1">
              {[
                'Hands-free face detection and identification',
                'Ideal for hospitality, events, and security staff on the floor',
                'Results displayed on paired device (phone or tablet)',
                'Switch sources instantly via the Source button',
              ].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
                  <span className="text-gray-300 text-sm">{f}</span>
                </div>
              ))}
            </div>

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
                    ['Voice Commands',        '✓', '✗', '✗'],
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
