"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Shaft" },
  { href: "/boards", label: "Boards" },
  { href: "/assay", label: "Assay" },
];

export function SiteNav({ handle }: { handle: string | null }) {
  const path = usePathname();
  return (
    <nav className="nav">
      <span className="nav-mark">The Proving Shaft</span>
      <div className="nav-links">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} data-active={path === link.href}>
            {link.label}
          </Link>
        ))}
        {handle ? <span className="nav-who">@{handle}</span> : null}
      </div>
    </nav>
  );
}
