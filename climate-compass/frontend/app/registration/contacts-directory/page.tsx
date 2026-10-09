import type { Metadata } from "next";
import { ContactsDirectory } from "@/components/registration/contacts-directory";

export const metadata: Metadata = {
  title: "Registrant directory",
  description: "Passphrase-protected Climate Compass registrant directory.",
  robots: { index: false, follow: false },
};

export default function ContactsDirectoryPage() {
  return (
    <div className="page-shell section-space">
      <header className="mb-7 max-w-3xl">
        <p className="eyebrow">Restricted directory</p>
        <h1 className="text-4xl font-extrabold tracking-tight">
          Registrant directory
        </h1>
        <p className="mt-3 text-ink-soft">
          Enter the shared directory passphrase. Phone numbers remain masked
          unless you explicitly request full numbers.
        </p>
      </header>
      <ContactsDirectory />
    </div>
  );
}
