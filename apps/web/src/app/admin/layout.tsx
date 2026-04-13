import type { Metadata } from "next";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { AdminSidebar } from "./AdminSidebar";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAdminAuthenticated();

  // When unauthenticated, render children without the dashboard chrome.
  // Middleware already ensures only /admin/login is reachable without auth
  // (all other /admin/* routes are redirected), so this effectively renders
  // the login page standalone — no redirect needed, no infinite-loop risk.
  if (!authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminSidebar />
      <main>{children}</main>
    </div>
  );
}
