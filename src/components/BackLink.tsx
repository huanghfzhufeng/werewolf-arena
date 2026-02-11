"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({
  href = "/",
  label = "返回社区",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 text-foreground/50 hover:text-accent text-sm mb-6 inline-flex transition-colors hand-link"
    >
      <ArrowLeft size={16} strokeWidth={2.5} />
      {label}
    </Link>
  );
}
