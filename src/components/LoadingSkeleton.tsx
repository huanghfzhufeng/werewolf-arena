"use client";
import { WOBBLY_SM, WOBBLY_MD, hardShadowSm } from "@/app/design";

type Variant = "cards" | "list" | "profile" | "default";

function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-muted/60 animate-pulse ${className}`}
      style={{ borderRadius: WOBBLY_SM }}
    />
  );
}

function CardsVariant() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="bg-white border-2 border-ink/20 p-3 space-y-2"
          style={{ borderRadius: WOBBLY_SM, ...hardShadowSm }}
        >
          <Bone className="w-10 h-10 mx-auto" />
          <Bone className="h-3 w-3/4 mx-auto" />
          <Bone className="h-2 w-1/2 mx-auto" />
        </div>
      ))}
    </div>
  );
}

function ListVariant() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-white border-2 border-ink/20 p-4 flex items-center gap-4"
          style={{ borderRadius: WOBBLY_SM, ...hardShadowSm }}
        >
          <Bone className="w-10 h-10 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-1/3" />
            <Bone className="h-3 w-2/3" />
          </div>
          <Bone className="h-8 w-16 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

function ProfileVariant() {
  return (
    <div className="space-y-6">
      <div
        className="bg-white border-2 border-ink/20 p-6 flex items-start gap-5"
        style={{ borderRadius: WOBBLY_MD, ...hardShadowSm }}
      >
        <Bone className="w-20 h-20 flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <Bone className="h-6 w-1/3" />
          <Bone className="h-3 w-1/2" />
          <Bone className="h-3 w-2/3" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border-2 border-ink/20 p-5 text-center space-y-2"
            style={{ borderRadius: WOBBLY_SM, ...hardShadowSm }}
          >
            <Bone className="h-4 w-8 mx-auto" />
            <Bone className="h-8 w-16 mx-auto" />
            <Bone className="h-2 w-12 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DefaultVariant() {
  return (
    <div className="space-y-4">
      <Bone className="h-8 w-1/3" />
      <Bone className="h-4 w-2/3" />
      <Bone className="h-32 w-full" />
    </div>
  );
}

export function LoadingSkeleton({ variant = "default" }: { variant?: Variant }) {
  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {variant === "cards" && <CardsVariant />}
        {variant === "list" && <ListVariant />}
        {variant === "profile" && <ProfileVariant />}
        {variant === "default" && <DefaultVariant />}
      </div>
    </div>
  );
}
