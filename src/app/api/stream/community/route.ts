import { subscribeCommunity } from "@/community/community-events";
import { startCommunityEngine, isEngineRunning } from "@/community/community-engine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Ensure engine is running
  if (!isEngineRunning()) {
    await startCommunityEngine();
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = subscribeCommunity((event) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          unsubscribe();
        }
      });

      // Send heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 30_000);

      // Cleanup when client disconnects
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
