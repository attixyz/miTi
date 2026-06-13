"use client";

import Link from "next/link";
import { CalendarHeart, Globe, Code, Users, Share2 } from "lucide-react";
import { shareApp } from "@/lib/shareApp";

const GITHUB_REPO = "https://github.com/attixyz/miTi";
const NOSTR_PROTOCOL = "https://github.com/nostr-protocol/nostr";
const AGPL_LICENSE = "https://www.gnu.org/licenses/agpl-3.0.html";

type Author = { name: string; url?: string };

/** Mirrors the `authors` declared in `app/layout.tsx`. */
const AUTHORS: Author[] = [
  { name: "Atti", url: "https://github.com/attixyz" }, 
  { name: "Gil Lohner", url: "https://riginode.xyz" },
];

/**
 * Plain-language explainer for the app reached from the sidebar / "More" screen.
 * Static content only — no Nostr or network access.
 */
export function NovaAboutPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-on-surface">About</h1>

      <div className="flex flex-col gap-8">
        <Section icon={<CalendarHeart size={20} />} title="What is miTi?">
          <p>
            miTi is a simple app for finding and creating events. Browse meetups,
            workshops and gatherings on a map or in a list, RSVP to the ones you
            like, and publish your own in a few taps.
          </p>
          <p>
            Unlike a normal events site, miTi has no central database. Everything
            lives on <span className="font-medium text-on-surface">Nostr</span>, an
            open network. This means that your events aren&apos;t locked into one company and
            can be read by any other Nostr app.
          </p>
        </Section>

        <Section icon={<Globe size={20} />} title="What is Nostr?">
          <p>
            Nostr (&ldquo;Notes and Other Stuff Transmitted by Relays&rdquo;) is an
            open protocol for sharing information online without a central owner.
            Instead of one big server, lots of small servers called{" "}
            <span className="font-medium text-on-surface">relays</span> pass your
            messages around.
          </p>
          <p>
            You sign in with your own cryptographic key rather than an email and
            password, which means you carry your identity and your data with you
            across every app that speaks Nostr. miTi uses a part of Nostr designed
            for calendar events.
          </p>
          <p>
            Learn more about Nostr protocol on its{" "}
            <ExternalTextLink href={NOSTR_PROTOCOL}>
              GitHub repository
            </ExternalTextLink>
            .
          </p>
        </Section>

        <Section icon={<Code size={20} />} title="Source code">
          <p>
            miTi is open source. You can read the code, report issues or
            contribute on its{" "}
            <ExternalTextLink href={GITHUB_REPO}>GitHub repository</ExternalTextLink>.
          </p>
          <p>
            It is released under the{" "}
            <ExternalTextLink href={AGPL_LICENSE}>
              GNU Affero General Public License v3.0
            </ExternalTextLink>{" "}
            (AGPL-3.0) — a copyleft license that keeps miTi free and open:
            anyone who runs a modified version, even as a hosted service, must
            share their changes under the same terms.
          </p>
        </Section>

        <Section icon={<Users size={20} />} title="Authors">
          <p>Made with care by:</p>
          <ul className="flex flex-col gap-2">
            {AUTHORS.map((author) => (
              <li key={author.name}>
                {author.url ? (
                  <ExternalTextLink href={author.url}>{author.name}</ExternalTextLink>
                ) : (
                  <span className="font-medium text-on-surface">{author.name}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={<Share2 size={20} />} title="Recommend miTi">
          <p>
            Enjoying miTi? The best way to help is to share it. Send a link to a
            friend who organises or goes to events: the more people on the
            network, the more there is to discover.
          </p>
          <button
            type="button"
            onClick={() => void shareApp()}
            className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-opacity hover:opacity-90"
          >
            <Share2 size={16} />
            Recommend this app
          </button>
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-on-surface">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-high text-on-surface-variant">
          {icon}
        </span>
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-on-surface-variant">
        {children}
      </div>
    </section>
  );
}

function ExternalTextLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}
