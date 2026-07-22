type UpstreamCard = {
  id: number;
  name: string;
  type: string;
  desc: string;
  race: string;
  attribute?: string;
  level?: number;
  atk?: number;
  def?: number;
  archetype?: string;
  card_images?: Array<{ id: number }>;
  banlist_info?: { ban_tcg?: string };
  card_prices?: Array<{ tcgplayer_price?: string }>;
};

const API_URL = "https://db.ygoprodeck.com/api/v7/cardinfo.php";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const kind = searchParams.get("kind")?.trim() || "";
  const upstream = new URL(API_URL);

  if (query) upstream.searchParams.set(/^\d+$/.test(query) ? "id" : "fname", query);
  else upstream.searchParams.set("staple", "yes");

  if (kind === "Monster") upstream.searchParams.set("type", "Effect Monster");
  if (kind === "Spell") upstream.searchParams.set("type", "Spell Card");
  if (kind === "Trap") upstream.searchParams.set("type", "Trap Card");
  upstream.searchParams.set("num", "12");
  upstream.searchParams.set("offset", "0");

  try {
    const response = await fetch(upstream, { next: { revalidate: 3600 } });
    if (response.status === 400) return Response.json({ cards: [] });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    const payload = await response.json() as { data?: UpstreamCard[] };
    const cards = (payload.data || []).map((card) => ({
      id: card.id,
      name: card.name,
      type: card.type,
      description: card.desc,
      race: card.race,
      attribute: card.attribute || null,
      level: card.level ?? null,
      atk: card.atk ?? null,
      def: card.def ?? null,
      archetype: card.archetype || null,
      imageId: card.card_images?.[0]?.id || card.id,
      banStatus: card.banlist_info?.ban_tcg || null,
      price: card.card_prices?.[0]?.tcgplayer_price || null,
    }));
    return Response.json({ cards }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return Response.json({ error: "Nguồn dữ liệu đang tạm thời không phản hồi." }, { status: 502 });
  }
}
