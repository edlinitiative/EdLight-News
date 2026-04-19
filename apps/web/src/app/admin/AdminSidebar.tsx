"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileEdit,
  BookOpen,
  ImagePlus,
  Instagram,
  Send,
  MessageCircle,
  Share2,
  AtSign,
  Twitter,
  Users,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/drafts", label: "Drafts", Icon: FileEdit },
  { href: "/admin/contributors", label: "Contributors", Icon: Users },
  { href: "/admin/histoire", label: "Histoire", Icon: BookOpen },
  { href: "/admin/histoire/images", label: "Images", Icon: ImagePlus },
  { href: "/admin/ig-queue", label: "IG Queue", Icon: Instagram },
  { href: "/admin/ig-publish", label: "IG Publish", Icon: Send },
  { href: "/admin/wa-queue", label: "WA Queue", Icon: MessageCircle },
  { href: "/admin/fb-queue", label: "FB Queue", Icon: Share2 },
  { href: "/admin/th-queue", label: "TH Queue", Icon: AtSign },
  { href: "/admin/x-queue", label: "X Queue", Icon: Twitter },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();

  // Hide sidebar on the login page
  if (pathname === "/admin/login") return null;

  return (
    <nav className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-stone-200 pb-3 dark:border-stone-800">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const isActive =
          href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={[
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900"
                : "text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-white",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
