import type { Metadata } from "next";
import { PageShell } from "@/components/guardian/page-shell";
import { HistoryList } from "@/components/guardian/history-list";

export const metadata: Metadata = {
  title: "Fall history — The Guardian",
};

/** Past fall events — read back from the Supabase history store. */
export default function HistoryPage() {
  return (
    <PageShell
      title="Fall history"
      intro="A calm record of every fall the device has detected for Maria."
    >
      <HistoryList />
    </PageShell>
  );
}
