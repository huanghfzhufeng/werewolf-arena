"use client";
import { PHASE_LABELS } from "@/app/constants";

export function PhaseIndicator({
  phase,
  isNight,
}: {
  phase: string;
  isNight: boolean;
}) {
  return (
    <div className="text-center mb-6">
      <div
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold border transition-all"
        style={{
          borderColor: isNight ? "var(--villager)" : "var(--gold)",
          background: isNight ? "rgba(59,130,246,0.1)" : "rgba(234,179,8,0.1)",
          color: isNight ? "var(--villager)" : "var(--gold)",
        }}
      >
        {PHASE_LABELS[phase] ?? phase}
      </div>
    </div>
  );
}
