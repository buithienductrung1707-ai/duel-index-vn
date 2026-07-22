export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) return new Response("Invalid card id", { status: 400 });

  const response = await fetch(`https://images.ygoprodeck.com/images/cards_small/${id}.jpg`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!response.ok) return new Response("Image not found", { status: 404 });

  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "image/jpeg",
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}
