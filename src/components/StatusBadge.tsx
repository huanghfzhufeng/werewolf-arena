"use client";
import { WOBBLY_PILL } from "@/app/design";
import { STATUS_CONFIG } from "@/app/constants";

export function StatusBadge({
  status,
  size = "sm",
}: {
  status: string;
  size?: "sm" | "md";
}) {
  const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;
  const padding = size === "md" ? "px-3 py-1" : "px-2 py-0.5";
  const text = size === "md" ? "text-xs" : "text-[10px]";

  return (
    <span
      className={`${padding} ${text} font-medium border-2 inline-flex items-center gap-1`}
      style={{
        borderRadius: WOBBLY_PILL,
        color: sc.color,
        backgroundColor: sc.bg ?? "transparent",
        borderColor: sc.color,
      }}
    >
      {sc.label}
    </span>
  );
}

/** Minimal dot + label variant used in compact card layouts */
export function StatusDot({ status }: { status: string }) {
  const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;
  return (
    <div className="flex items-center justify-center gap-1">
      <span
        className="w-2 h-2 rounded-full inline-block"
        style={{ backgroundColor: sc.color }}
      />
      <span className="text-xs text-foreground/50">{sc.label}</span>
    </div>
  );
}
