import type { Metadata } from "next";
import { AdminSidebar } from "./AdminSidebar";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminSidebar />
      <main>{children}</main>
    </div>
  );
}
