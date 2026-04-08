import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';

const SECTIONS = [
  { id: 'setup-pc',        label: 'Setting up a PC / Laptop' },
  { id: 'live-detection',  label: 'Live Face Detection' },
  { id: 'front-desk',      label: 'Setting Up a Front Desk' },
  { id: 'second-desk',     label: 'Adding a Second Front Desk' },
  { id: 'streams',         label: 'Back Office via Streams' },
  { id: 'mobile',          label: 'Wearables & Mobile' },
  { id: 'shared',          label: 'Customers Across Users' },
  { id: 'tokens',          label: 'Token Usage' },
];

export default function QuickStartScreen() {
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
            <p className="text-white font-bold text-base leading-tight">Quick Start Guide</p>
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
            <h1 className="text-white font-bold text-xl mb-2">Welcome to CrowdView</h1>
            <p className="text-gray-300 text-sm leading-relaxed">
              CrowdView is a real-time face recognition platform for businesses. This guide will have you up and running in minutes — detecting, identifying, and tracking customers from any camera-equipped device.
            </p>
          </div>

          {/* How to Quick Start */}
          <div className="bg-gray-800 rounded-xl p-5 space-y-3">
            <h2 className="text-white font-semibold text-base">How to quick start</h2>
            <ol className="space-y-2">
              {[
                'Sign up for a free trial using the free trial link on our website crowdview.tv.',
                'Set up your front desk location (PC and outward-facing camera) and add a front desk user.',
                'Seed the customer database with names and photos (optional).',
                'Log in at your front desk using your front desk user account.',
                'Use the Id icon or Live icon on the hub screen to identify customers as they approach the front desk.',
                'For each unknown customer, click on the face photo that appears on the hub, add their name and status tier (optional), and Save.',
                "That's it! Next time they are seen by a camera in our system they will be identified.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
                  <span className="text-blue-400 font-semibold flex-shrink-0 w-4">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="pt-1 space-y-2 border-t border-gray-700">
              {[
                'If you want to link our system to yours (e.g. to bring up customer schedules) contact us and we\'ll get it done.',
                'If you want to track employees, go to the Employees tab and add a name and photo for each employee — they will be identified each time they are viewed by a camera.',
                'If you want a back-office person to also view the front desk feed, add a back-office user and sign in with that account at another PC or laptop.',
              ].map((note, i) => (
                <p key={i} className="text-gray-400 text-sm leading-relaxed">{note}</p>
              ))}
            </div>
            <p className="text-gray-500 text-sm">Check out the guide below for more information.</p>
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

          {/* ── 1 ── */}
          <Section id="setup-pc" number="1" title="Setting Up a PC or Laptop with a Webcam">
            <P>CrowdView runs entirely in your browser — no software to install. You need Chrome (recommended), a webcam, and an internet connection.</P>
            <Steps>
              <Step n="1">Open <strong>crowdview.tv</strong> in Chrome and sign up for an account (or log in if you already have one).</Step>
              <Step n="2">You will land on the <strong>Hub Screen</strong> — the main camera and detection screen. When prompted, click <strong>Allow</strong> to grant camera access.</Step>
              <Step n="3">Your webcam feed appears automatically. If you have more than one camera connected, use the <strong>Source</strong> button (camera icon) to pick the right one.</Step>
              <Step n="4">Position your webcam so it has a clear, well-lit view of the area you want to monitor — a doorway, reception desk, or counter works well.</Step>
              <Step n="5">You are ready to go. The camera feed is live and CrowdView is ready to detect faces.</Step>
            </Steps>
            <Tip>Chrome on Windows and macOS gives the best experience. Make sure your browser is up to date for reliable camera access.</Tip>
          </Section>

          {/* ── 2 ── */}
          <Section id="live-detection" number="2" title="Live Face Detection">
            <P>Live detection continuously scans the camera feed and identifies faces in real time — no button pressing needed once it is running.</P>
            <Steps>
              <Step n="1">From the Hub Screen, tap the <strong>Live</strong> button (eye icon). The button turns green to show it is active.</Step>
              <Step n="2">Coloured bounding boxes appear around detected faces in the video feed. The colour tells you the status at a glance:</Step>
            </Steps>
            <div className="mt-3 space-y-2">
              {[
                ['bg-green-500',  'Green (or tier colour)', 'Known customer — recognised from your database'],
                ['bg-white',      'White',                  'Employee — recognised from your staff list'],
                ['bg-orange-500', 'Orange',                 'Friend of a friend — recognised via a linked account'],
                ['bg-red-500',    'Red',                    'Unknown — not yet in your database'],
              ].map(([dot, label, desc]) => (
                <div key={label} className="flex items-start gap-3">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${dot}`} />
                  <div>
                    <span className="text-white text-sm font-medium">{label}</span>
                    <span className="text-gray-400 text-sm"> — {desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Steps>
                <Step n="3">Recognised faces appear as tiles in the results panel with the person's name, tier, and any notes you have stored.</Step>
                <Step n="4">Tap a tile or tap a bounding box to view or edit that customer's record.</Step>
                <Step n="5">Tap the <strong>Live</strong> button again to stop scanning.</Step>
              </Steps>
            </div>
            <Tip>Live detection runs approximately 2 scans per second. Ensure good, even lighting for best accuracy — avoid strong backlighting behind subjects.</Tip>
          </Section>

          {/* ── 3 ── */}
          <Section id="front-desk" number="3" title="Setting Up a Front Desk">
            <P>A front desk is any device with CrowdView running in Live mode, camera pointed at a door or entry point. No special hardware is required beyond a webcam and a browser.</P>
            <Steps>
              <Step n="1">Set up your device at the entry point with the webcam facing the door or approach area.</Step>
              <Step n="2">Log in to CrowdView and navigate to the <strong>Hub Screen</strong>.</Step>
              <Step n="3">Enable <strong>Live</strong> mode. The system will now identify everyone who passes in front of the camera.</Step>
              <Step n="4">Build up your customer database by using the <strong>+</strong> button or the <strong>Group Photo</strong> (people icon) to add customers from existing photos.</Step>
              <Step n="5">Once customers are enrolled, they will be identified automatically every time they approach — attendance is recorded and visible in the Dashboard.</Step>
            </Steps>
            <Tip>The first time a customer is seen, they will show as Unknown (red). Add them as a customer from the Hub Screen by tapping their bounding box — they will be recognised on every future visit.</Tip>
          </Section>

          {/* ── 4 ── */}
          <Section id="second-desk" number="4" title="What If I Want a Second Front Desk?">
            <P>Corporate accounts support any number of simultaneous front desks. All desks share the same customer database automatically — a customer added at one desk is immediately recognisable at all others.</P>
            <Steps>
              <Step n="1">A <strong>Corporate Admin</strong> opens the <strong>Users</strong> screen (from the navigation bar or side menu).</Step>
              <Step n="2">Tap <strong>Add User</strong> and enter the name, email address, and a temporary password for the new front desk operator.</Step>
              <Step n="3">Log in on the second device using the new credentials and navigate to the Hub Screen.</Step>
              <Step n="4">Both desks now share the same customer list and attendance records. Detections from either desk appear in the corporate Dashboard.</Step>
            </Steps>
            <Tip>There is no limit on the number of users or devices in a corporate organisation. Each user's live detection activity is tracked separately in the Dashboard so you can see which desk is busiest.</Tip>
          </Section>

          {/* ── 5 ── */}
          <Section id="streams" number="5" title="Adding Back Office Support via Streams">
            <P>Not everyone needs to be at the front desk. CrowdView's Streams feature lets back office staff monitor the live feed with face overlays from anywhere — without needing a camera of their own.</P>
            <Steps>
              <Step n="1">The front desk operator taps the <strong>Stream</strong> button on the Hub Screen to start broadcasting their camera feed.</Step>
              <Step n="2">Back office staff open the <strong>Streams</strong> screen (broadcast icon in the navigation bar).</Step>
              <Step n="3">Active streams from users in the organisation are listed. Tap a stream to open the live view.</Step>
              <Step n="4">The live view shows the video feed with the same coloured bounding boxes and face labels as the front desk — updated in real time.</Step>
              <Step n="5">Tap any face in the stream view for more details about that customer.</Step>
            </Steps>
            <Tip>Streams are ideal for a manager who needs situational awareness without being physically present — or for a VIP room host who needs advance notice of who is arriving.</Tip>
          </Section>

          {/* ── 6 ── */}
          <Section id="mobile" number="6" title="Wearables and Mobile Support">
            <P>CrowdView works on phones and smart glasses as well as desktop browsers, giving staff the freedom to move around while still detecting and identifying customers.</P>
            <H3>Mobile (iPhone &amp; Android)</H3>
            <Steps>
              <Step n="1">Download the CrowdView app from the App Store (iOS) or Google Play (Android).</Step>
              <Step n="2">Log in with your existing account. The full feature set is available — Hub, Customers, Streams, Library, and Dashboard.</Step>
              <Step n="3">Use your phone's camera as a handheld scanner — walk the floor at an event, greet arriving guests, or cover multiple entry points.</Step>
            </Steps>
            <H3>Smart Glasses (Wearables)</H3>
            <Steps>
              <Step n="1">Connect your smart glasses to the same network as your device.</Step>
              <Step n="2">On the Hub Screen, tap the <strong>Source</strong> button and select your glasses from the device list.</Step>
              <Step n="3">The Hub Screen now uses the glasses camera feed. Live detection works identically — results appear on your phone or tablet screen.</Step>
              <Step n="4">To switch back to the phone camera, tap Source and select the phone camera.</Step>
            </Steps>
            <Tip>Wearables are ideal for hospitality staff — a waiter or host can greet a VIP customer by name without looking at a screen, creating a seamless personalised experience.</Tip>
          </Section>

          {/* ── 7 ── */}
          <Section id="shared" number="7" title="Customers Across Users — How Sharing Works">
            <P>Understanding who can see which customers is important for both corporate teams and individual users who collaborate.</P>
            <H3>Corporate Organisations</H3>
            <P>All users in a corporate organisation automatically share one customer database. There is no setup required — every user can see and identify every customer added by any other user in the organisation.</P>
            <H3>Individual Users — Linking Accounts</H3>
            <P>Individual (non-corporate) users can share recognition with another CrowdView user by linking accounts:</P>
            <Steps>
              <Step n="1">Open a customer record and scroll to the <strong>CrowdView Account</strong> field.</Step>
              <Step n="2">Enter the other user's CrowdView email address and tap <strong>Link</strong>.</Step>
              <Step n="3">The link is now <strong>bi-directional</strong> — both users gain access to each other's customer lists for detection purposes.</Step>
              <Step n="4">When either user scans and detects a face from the other's list, it shows as <strong>Friend of [Name]</strong> in orange.</Step>
            </Steps>
            <Tip>Linking is mutual — you only need to link once. The other user does not need to do anything for both sides to benefit.</Tip>
          </Section>

          {/* ── 8 ── */}
          <Section id="tokens" number="8" title="Understanding Token Usage">
            <P>CrowdView uses a token system for face detection calls. Keeping an eye on usage helps you plan your subscription and avoid unexpected overages.</P>
            <div className="mt-3 space-y-3">
              <div className="bg-gray-700 rounded-lg p-4 flex items-start gap-4">
                <div className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded flex-shrink-0">LIVE</div>
                <div>
                  <p className="text-white text-sm font-medium">~2 calls per second</p>
                  <p className="text-gray-400 text-sm">Each second of Live Scan mode uses approximately 2 detection API calls. Disable Live Scan when the camera is unattended to conserve tokens.</p>
                </div>
              </div>
              <div className="bg-gray-700 rounded-lg p-4 flex items-start gap-4">
                <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded flex-shrink-0">ID</div>
                <div>
                  <p className="text-white text-sm font-medium">1 call per scan</p>
                  <p className="text-gray-400 text-sm">Tapping the ID button (single photo scan) uses exactly 1 detection call regardless of how many faces are in the frame.</p>
                </div>
              </div>
            </div>
            <H3>Monitoring Usage</H3>
            <Steps>
              <Step n="1">Corporate admins open the <strong>Dashboard</strong> screen to see per-user detection counts for the current session, month, and year.</Step>
              <Step n="2">Individual users can see their own counts in the same Dashboard view.</Step>
              <Step n="3">Turn off Live Scan during quiet periods — detection stops immediately and no further tokens are consumed.</Step>
            </Steps>
          </Section>

          <div className="text-center pb-4">
            <p className="text-gray-500 text-xs">Need more detail? See the full <a href="/guide" className="text-blue-400 hover:text-blue-300 underline">User Guide</a>.</p>
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
