import { Platform, Share } from "react-native";

/**
 * Mirrors `downloadData()` in `frontend/index.html` — client-side stub CSV
 * with city + timestamp placeholders for PM2.5 / risk / alert.
 */
export async function exportDashboardCsv(city: string): Promise<void> {
  const dateIso = new Date().toISOString();
  const dateStamp = dateIso.split("T")[0];
  const csv = `City,Date,PM2.5,Risk Score,Alert Level\n${city},${dateIso},--,--,--`;
  const filename = `early-warning-${dateStamp}.csv`;

  if (Platform.OS === "web" && typeof document !== "undefined") {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  await Share.share({
    title: filename,
    message: csv,
  });
}
