"use client";
import { ROLE_LABELS } from "@/app/constants";

export function RoleBadge({ role }: { role: string }) {
  return (
    <span className="text-sm">
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}
