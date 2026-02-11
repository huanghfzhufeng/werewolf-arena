import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { generateAgentApiKey, createLogger } from "@/lib";
import { authenticateOwner } from "@/lib/auth";
import { validateWebhookUrl } from "@/lib/url-validator";
import { checkRegisterLimit } from "@/lib/rate-limiter";

const log = createLogger("API:v1:Register");

const ACTIVE_DAYS = 7;

export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "unknown";
    const rl = checkRegisterLimit(ip);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many registration requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const { name, bio, avatar, personality, tags, webhook_url, play_mode } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }
    if (!personality || !personality.trait || !personality.speakingStyle) {
      return NextResponse.json(
        { error: "personality.trait and personality.speakingStyle are required" },
        { status: 400 }
      );
    }

    // Validate webhook URL if provided
    if (webhook_url) {
      const urlCheck = validateWebhookUrl(webhook_url);
      if (!urlCheck.valid) {
        return NextResponse.json(
          { error: `Invalid webhook_url: ${urlCheck.reason}` },
          { status: 400 }
        );
      }
    }

    // Check name uniqueness
    const [existing] = await db.select().from(agents).where(eq(agents.name, name.trim()));
    if (existing) {
      return NextResponse.json(
        { error: "An agent with this name already exists" },
        { status: 409 }
      );
    }

    // If owner API key provided, link to owner
    let ownerId: string | null = null;
    const owner = await authenticateOwner(request);
    if (owner) {
      // Check owner's agent limit
      const ownerAgents = await db.select().from(agents).where(eq(agents.ownerId, owner.id));
      if (ownerAgents.length >= owner.maxAgents) {
        return NextResponse.json(
          { error: `Owner limit reached (${owner.maxAgents} agents max)` },
          { status: 403 }
        );
      }
      ownerId = owner.id;
    }

    const apiKey = generateAgentApiKey();
    const activeUntil = new Date(Date.now() + ACTIVE_DAYS * 24 * 60 * 60 * 1000);

    const personalityData = {
      character: name.trim(),
      series: "Custom",
      avatar: avatar || "🎭",
      trait: personality.trait,
      speakingStyle: personality.speakingStyle,
      catchphrase: personality.catchphrase || "",
    };

    const [agent] = await db.insert(agents).values({
      name: name.trim(),
      personality: personalityData,
      avatar: avatar || "🎭",
      status: "idle",
      isSystem: false,
      bio: bio || "",
      avatarUrl: null,
      tags: Array.isArray(tags) ? tags : [],
      apiKey,
      ownerId,
      webhookUrl: webhook_url || null,
      playMode: play_mode === "autonomous" ? "autonomous" : "hosted",
      activeUntil,
    }).returning();

    log.info(`Registered agent: ${agent.name} (${agent.id})`);

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        api_key: apiKey,
      },
      important: "⚠️ SAVE YOUR API KEY! It cannot be retrieved later.",
    });
  } catch (error) {
    log.error("Registration failed:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
