import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Climate Compass handles information when you browse the service or choose to register for alerts.",
};

const sections = [
  {
    title: "Information you provide",
    text: "If you register for alerts or use an account feature, the service may collect the contact and profile details shown on that form. Browsing the public learning pages does not require an account.",
  },
  {
    title: "How information is used",
    text: "Information is used to operate the feature you requested, such as delivering alerts, maintaining your preferences, securing access, and improving service reliability.",
  },
  {
    title: "Service providers",
    text: "A deployment may use configured hosting, database, messaging, email, weather, or air-quality providers. Those providers process only the information needed for their service and are subject to their own terms.",
  },
  {
    title: "Retention and deletion",
    text: "A deployment should retain personal information only as long as needed for its stated purpose, legal obligations, or security. Registered users can use the delete-account route or contact the operator.",
  },
  {
    title: "Children and guardians",
    text: "Children should not submit personal contact details without appropriate adult permission. Organisations remain responsible for their own consent and safeguarding processes.",
  },
  {
    title: "Security and limitations",
    text: "Reasonable safeguards can reduce risk, but no online service can promise absolute security. Do not submit medical records, emergency information, or other sensitive details through public forms.",
  },
] as const;

export default function PrivacyPolicyPage() {
  return (
    <article className="page-shell max-w-4xl py-16 sm:py-24">
      <p className="eyebrow">Privacy</p>
      <h1 className="text-5xl font-extrabold tracking-[-0.04em]">Privacy policy</h1>
      <p className="mt-6 text-lg leading-8 text-muted">
        This plain-language notice explains the intended privacy approach for a
        Climate Compass deployment. The organisation operating a live
        deployment is responsible for publishing its current contact details,
        providers, retention periods, and legally required notices.
      </p>
      <p className="mt-4 text-sm font-bold text-ink-soft">
        Last reviewed: 4 August 2026
      </p>

      <div className="mt-12 grid gap-6">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-border bg-white p-6 sm:p-8"
          >
            <h2 className="text-2xl font-bold">{section.title}</h2>
            <p className="mt-3 leading-7 text-muted">{section.text}</p>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-2xl bg-sky-soft p-6 sm:p-8">
        <h2 className="text-2xl font-bold">Questions or requests</h2>
        <p className="mt-3 leading-7 text-muted">
          Use the contact information published by the operator of the Climate
          Compass deployment you are using. For account deletion, visit{" "}
          <a className="font-extrabold text-link underline" href="/delete-account">
            Delete account
          </a>
          .
        </p>
      </section>
    </article>
  );
}
