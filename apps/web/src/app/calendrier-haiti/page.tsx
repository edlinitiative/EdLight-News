/**
 * /calendrier-haiti — Redirect to /calendrier (backwards-compatible).
 */
import { redirect } from "next/navigation";

export const revalidate = 900;

export default function CalendrierHaitiRedirect({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const langQ = searchParams.lang === "ht" ? "?lang=ht" : "";
  redirect(`/calendrier${langQ}`);
}
