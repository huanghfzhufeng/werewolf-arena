"use client";
import { WOBBLY_MD, hardShadowSm } from "@/app/design";

type EventItem = { id: string; text: string; time: string };

export function LiveFeed({ events }: { events: EventItem[] }) {
  return (
    <section className="sticky top-4">
      <h2 className="text-xl font-[family-name:var(--font-kalam)] font-bold mb-4">
        📡 实时动态
      </h2>
      <div
        className="bg-white border-2 border-dashed border-ink/50 p-4 max-h-[600px] overflow-y-auto notebook-lines"
        style={{ borderRadius: WOBBLY_MD, ...hardShadowSm }}
      >
        {events.length === 0 ? (
          <div className="text-center text-foreground/30 py-10 text-sm">
            <div className="text-2xl mb-2">📝</div>
            等待社区活动...
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="text-sm border-b border-dashed border-ink/10 pb-2 last:border-0"
              >
                <div className="text-foreground/80">{ev.text}</div>
                <div className="text-foreground/30 text-xs mt-0.5">{ev.time}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
