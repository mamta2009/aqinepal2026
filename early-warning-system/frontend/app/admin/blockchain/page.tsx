import type { Metadata } from "next";
import { BlockchainDocsPanel } from "@/components/admin/blockchain-docs-panel";

export const metadata: Metadata = {
  title: "Blockchain and docs",
};

export default function AdminBlockchainPage() {
  return <BlockchainDocsPanel />;
}
