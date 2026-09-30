import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalPage } from "@/components/LegalPage";
import { SITE, absoluteUrl } from "@/config/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Ezvor" },
      {
        name: "description",
        content: "What Ezvor stores, why, who processes it, and how to delete it.",
      },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/privacy") }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <p>
          {SITE.name} ({SITE.url.replace(/^https?:\/\//, "")}) is a free interview-practice
          platform. This page explains, in plain language, what data it handles. We don&apos;t sell
          your data or show ads.
        </p>
      </section>

      <section>
        <h2>Without an account</h2>
        <p>
          You can use {SITE.name} without signing in. Your solved problems, submissions, notes,
          bookmarks, review queue, settings and AI Advisor chats are then saved only in your
          browser&apos;s local storage on your device. Clearing your browser data, or using{" "}
          <Link to="/settings">Settings → Clear this device</Link>, removes them.
        </p>
      </section>

      <section>
        <h2>With an account</h2>
        <p>When you sign in (email, Google or GitHub) we store:</p>
        <ul>
          <li>Your email address, and the name and profile picture your provider shares.</li>
          <li>Profile details you choose to add (handle, headline, location, bio, links).</li>
          <li>
            Your practice activity: code you submit, verdicts, solved problems, notes, bookmarks,
            reviews and settings, so they sync across devices.
          </li>
          <li>Your AI Advisor conversations.</li>
          <li>Your career target and roadmap checklist, if you use the Readiness page.</li>
        </ul>
        <p>
          Your profile, solved problems and readiness are visible to others only if you turn on a
          public profile in Settings. Otherwise they are private to you.
        </p>
      </section>

      <section>
        <h2>Services that process data for us</h2>
        <ul>
          <li>
            <strong>Supabase</strong>: account sign-in and the database that stores the data above.
          </li>
          <li>
            <strong>Vercel</strong>: hosts the website and handles requests.
          </li>
          <li>
            <strong>Google and GitHub</strong>: only if you choose to sign in with them.
          </li>
          <li>
            <strong>AI providers</strong> (primarily Google Gemini): the problem, your code and your
            messages are sent when you use the AI Coach, AI Advisor or other AI features, to
            generate a reply.
          </li>
          <li>
            <strong>Code runners</strong> (Wandbox, Paiza): code that can&apos;t run in your browser
            (for example C++ and Java) is sent to these free compilers to execute. Python and
            JavaScript run in your browser.
          </li>
        </ul>
      </section>

      <section>
        <h2>Cookies and tracking</h2>
        <p>
          We use your browser&apos;s storage to keep you signed in and to save your progress. We
          don&apos;t use advertising or third-party tracking cookies.
        </p>
      </section>

      <section>
        <h2>Deleting your data</h2>
        <p>
          In <Link to="/settings">Settings</Link> you can export everything, delete your cloud data,
          or delete your account. You can also contact us to delete it for you.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions or requests: open an issue at{" "}
          <a href={`${SITE.github}/issues`} target="_blank" rel="noopener noreferrer">
            {SITE.github.replace(/^https:\/\//, "")}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
