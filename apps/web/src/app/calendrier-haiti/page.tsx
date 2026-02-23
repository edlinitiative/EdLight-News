/**
 * /calendrier-haiti — Redirect to /calendrier (backwards-compatible).
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CalendrierHaitiRedirect({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const langQ = searchParams.lang === "ht" ? "?lang=ht" : "";
  redirect(`/calendrier${langQ}`);
}
