import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentOwners } from "@/db/schema";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.login) return false;

      // Upsert into agentOwners table (reuse as user table)
      const githubId = String(profile.id);
      const [existing] = await db
        .select()
        .from(agentOwners)
        .where(eq(agentOwners.githubId, githubId));

      if (!existing) {
        await db.insert(agentOwners).values({
          displayName: (profile.name ?? profile.login) as string,
          email: (profile.email as string) ?? null,
          githubId,
          avatarUrl: (profile.avatar_url as string) ?? null,
          apiKey: `owner_${crypto.randomUUID().replace(/-/g, "")}`,
        });
      } else {
        // Update display name / avatar on each login
        await db
          .update(agentOwners)
          .set({
            displayName: (profile.name ?? profile.login) as string,
            avatarUrl: (profile.avatar_url as string) ?? null,
          })
          .where(eq(agentOwners.id, existing.id));
      }
      return true;
    },
    async session({ session }) {
      // Attach ownerId to session
      if (session.user?.email) {
        const [owner] = await db
          .select()
          .from(agentOwners)
          .where(eq(agentOwners.email, session.user.email));
        if (owner) {
          (session as unknown as Record<string, unknown>).ownerId = owner.id;
          session.user.image = owner.avatarUrl ?? session.user.image;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
