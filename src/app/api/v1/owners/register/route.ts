import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentOwners } from "@/db/schema";
import { generateOwnerApiKey, createLogger } from "@/lib";
import { checkOwnerRegisterLimit } from "@/lib/rate-limiter";

const log = createLogger("API:v1:OwnerRegister");

export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "unknown";
    const rl = checkOwnerRegisterLimit(ip);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many registration requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const { display_name, email } = body;

    if (!display_name || typeof display_name !== "string" || display_name.trim().length === 0) {
      return NextResponse.json({ error: "display_name is required" }, { status: 400 });
    }

    // Check email uniqueness if provided
    if (email) {
      const [existingOwner] = await db.select().from(agentOwners).where(eq(agentOwners.email, email));
      if (existingOwner) {
        return NextResponse.json({ error: "An owner with this email already exists" }, { status: 409 });
      }
    }

    const apiKey = generateOwnerApiKey();

    const [owner] = await db.insert(agentOwners).values({
      displayName: display_name.trim(),
      email: email || null,
      apiKey,
    }).returning();

    log.info(`Registered owner: ${owner.displayName} (${owner.id})`);

    return NextResponse.json({
      owner_id: owner.id,
      api_key: apiKey,
      important: "⚠️ SAVE YOUR API KEY! You will need it to manage your agents.",
    });
  } catch (error) {
    log.error("Owner registration failed:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
