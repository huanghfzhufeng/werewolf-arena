"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({
  href = "/",
  label = "返回",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary text-sm mb-6 transition-colors"
    >
      <ArrowLeft size={16} />
      {label}
    </Link>
  );
}
