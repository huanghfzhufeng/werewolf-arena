import { subscribe } from "@/engine/events";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial keepalive
      controller.enqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = subscribe(gameId, (event) => {
        const data = JSON.stringify(event);
        controller.enqueue(
          encoder.encode(`event: ${event.type}\ndata: ${data}\n\n`)
        );
      });

      // Keepalive every 30s
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 30000);

      // Cleanup when client disconnects
      _request.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(keepalive);
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
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
