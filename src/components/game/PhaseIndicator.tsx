"use client";
import { WOBBLY_PILL, hardShadowSm } from "@/app/design";
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
        className="inline-block px-8 py-3 border-[3px] text-lg font-[family-name:var(--font-kalam)] font-bold transition-all"
        style={{
          borderRadius: WOBBLY_PILL,
          borderColor: isNight ? "#2d5da1" : "#e6a817",
          backgroundColor: isNight ? "#e8eef6" : "#fff9e6",
          color: isNight ? "#2d5da1" : "#8b6914",
          ...hardShadowSm,
          transform: `rotate(${isNight ? "-1deg" : "0.5deg"})`,
        }}
      >
        {PHASE_LABELS[phase] ?? phase}
      </div>
    </div>
  );
}
