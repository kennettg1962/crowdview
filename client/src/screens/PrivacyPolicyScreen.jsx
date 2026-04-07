import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';

export default function PrivacyPolicyScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-700 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-gray-700">
          <BackIcon className="w-5 h-5" />
        </button>
        <h1 className="text-white font-bold text-lg">Privacy Policy</h1>
      </div>

      <main className="flex-1 flex justify-center px-4 py-6 pb-12">
        <div className="w-full max-w-2xl space-y-6 text-gray-300 text-sm leading-relaxed">

          <div className="bg-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-xs mb-4">Effective date: April 6, 2026 &nbsp;·&nbsp; Last updated: April 6, 2026</p>
            <p>
              CrowdView ("<strong className="text-white">we</strong>", "<strong className="text-white">us</strong>", or "<strong className="text-white">our</strong>") operates the CrowdView application and website at{' '}
              <span className="text-blue-400">crowdview.tv</span> (the "<strong className="text-white">Service</strong>"). This Privacy Policy explains what information we collect, how we use it, and your rights regarding that information.
            </p>
            <p className="mt-3">
              By using the Service you agree to the collection and use of information described in this policy. If you do not agree, please do not use the Service.
            </p>
          </div>

          <Section title="1. Information We Collect">
            <p>We collect only the minimum information necessary to operate the Service:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white">Account information</strong> — your email address and an optional display name, provided when you register.</li>
              <li><strong className="text-white">Password</strong> — stored as a one-way cryptographic hash; we cannot read your password.</li>
              <li><strong className="text-white">Face photographs</strong> — photos you upload for the purpose of face recognition within the app. These are stored securely and used exclusively as described below.</li>
              <li><strong className="text-white">Names associated with faces</strong> — labels you assign to recognised individuals (e.g. "John Smith"). These are stored solely to display recognition results to you.</li>
              <li><strong className="text-white">Usage activity</strong> — basic counters (detection scans per session, month, and year) used to power your personal and organisational dashboards. No content of scans is retained.</li>
              <li><strong className="text-white">Device and streaming data</strong> — camera source preferences and live-stream keys, stored locally in your browser and on our server to restore your session.</li>
            </ul>
            <p className="mt-3">We do <strong className="text-white">not</strong> collect payment information, precise device location, contacts, or any other personal data beyond the above.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>All data we collect is used solely to provide and improve the Service:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white">Face photographs and names</strong> are used exclusively for face recognition within the app — to identify people you have previously enrolled and display that result to you or your organisation. They are not used for any other purpose.</li>
              <li><strong className="text-white">Email address</strong> is used to log you in, send password-reset emails, and (for corporate accounts) to identify you within your organisation.</li>
              <li><strong className="text-white">Display name</strong> is shown within the app to identify you to other members of your organisation.</li>
              <li><strong className="text-white">Activity counters</strong> are used to populate attendance and detection dashboards visible only to you and authorised members of your organisation.</li>
            </ul>
          </Section>

          <Section title="3. What We Will Never Do With Your Data">
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>We will <strong className="text-white">never sell</strong> your face photographs, names, or any personal information to any third party.</li>
              <li>We will <strong className="text-white">never use your photos or names for advertising, marketing, or profiling</strong> of any kind.</li>
              <li>We will <strong className="text-white">never share your face data</strong> with companies, data brokers, research organisations, or government bodies except where required by law.</li>
              <li>We will <strong className="text-white">never use your data to train external AI or machine-learning models</strong> without your explicit consent.</li>
            </ul>
          </Section>

          <Section title="4. Face Recognition Technology">
            <p>
              Face recognition is the core function of the Service. Photographs you upload are processed by a face-recognition engine to extract a mathematical representation (a "face embedding") used to match faces in subsequent scans. The original photographs are stored on our servers; face embeddings are stored within the face-recognition system.
            </p>
            <p className="mt-2">
              All face data is associated with your account (or your organisation's account) and is never cross-referenced with data belonging to other unrelated users or organisations.
            </p>
            <p className="mt-2">
              You may delete any photograph or enrolled individual at any time from within the app. Deletion removes both the stored photograph and the corresponding face embedding from our systems.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Your data is retained for as long as your account remains active.</li>
              <li>If you delete a photo or an enrolled person, that data is removed immediately and permanently.</li>
              <li>If you delete your account (contact us at the address below), all associated personal data — including photographs, names, and face embeddings — will be deleted within 30 days.</li>
              <li>Aggregate usage counters (no personal content) may be retained in anonymised form for service analytics.</li>
            </ul>
          </Section>

          <Section title="6. Data Security">
            <p>
              We take the security of your data seriously. Face photographs are stored in an encrypted database accessible only by authenticated users. Access to the server and database is restricted by firewall rules and strong credentials. All data is transmitted over HTTPS.
            </p>
            <p className="mt-2">
              No method of transmission or storage is 100% secure. If you become aware of any security concern, please contact us immediately at the address below.
            </p>
          </Section>

          <Section title="7. Corporate Accounts">
            <p>
              If you use CrowdView through an organisation's corporate account, your email address, display name, and activity counters are visible to the administrators of that organisation. Face photographs and enrolled individuals added by users within the organisation may be visible to other authenticated users of the same organisation for the purpose of shared recognition. Your data remains isolated from all other organisations on the platform.
            </p>
          </Section>

          <Section title="8. Children's Privacy">
            <p>
              The Service is not directed at children under the age of 16. We do not knowingly collect personal information from children under 16. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.
            </p>
          </Section>

          <Section title="9. Your Rights">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white">Access</strong> the personal data we hold about you.</li>
              <li><strong className="text-white">Correct</strong> inaccurate data — you can update your name and email directly in the app.</li>
              <li><strong className="text-white">Delete</strong> your data — remove individual photos and enrolled persons from within the app, or request full account deletion by contacting us.</li>
              <li><strong className="text-white">Restrict or object</strong> to processing of your personal data.</li>
              <li><strong className="text-white">Data portability</strong> — request a copy of your data in a machine-readable format.</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact us at the address in Section 11.</p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at the top of this page. Continued use of the Service after changes are posted constitutes acceptance of the updated policy. We encourage you to review this page periodically.
            </p>
          </Section>

          <Section title="11. Contact Us">
            <p>If you have any questions, requests, or concerns about this Privacy Policy or the way we handle your data, please contact us:</p>
            <div className="mt-3 bg-gray-700 rounded-lg px-4 py-3 space-y-1">
              <p className="text-white font-medium">CrowdView</p>
              <p>Website: <span className="text-blue-400">crowdview.tv</span></p>
              <p>Email: <span className="text-blue-400">privacy@crowdview.tv</span></p>
            </div>
          </Section>

        </div>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-white font-semibold text-base mb-3">{title}</h2>
      {children}
    </div>
  );
}
