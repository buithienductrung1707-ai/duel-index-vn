import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

type DeckCard = { id: string; name: string; type: string; quantity: number };
type DeckData = {
  title: string;
  event: string;
  placement: string;
  pilot: string;
  date: string;
  tcgPrice: string | null;
  cardmarketPrice: string | null;
  sourceUrl: string;
  main: DeckCard[];
  extra: DeckCard[];
  side: DeckCard[];
};

function decodeText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCards(html: string, sectionId: string) {
  const sectionPattern = new RegExp(
    `<div class="deck-output" id="${sectionId}">([\\s\\S]*?)(?=<div class="deck-output" id=|<section class="deck-breakdown|<!-- End Deck View)`,
  );
  const section = html.match(sectionPattern)?.[1] || "";
  const cardPattern = /data-card="([0-9]+)"\s+data-cardname="([^"]+)"\s+data-cardtype="([^"]+)"/g;
  const cards = new Map<string, DeckCard>();
  for (const match of section.matchAll(cardPattern)) {
    const existing = cards.get(match[1]);
    if (existing) existing.quantity += 1;
    else cards.set(match[1], { id: match[1], name: decodeText(match[2]), type: decodeText(match[3]), quantity: 1 });
  }
  return Array.from(cards.values());
}

const getDeck = cache(async (slug: string): Promise<DeckData | null> => {
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;
  const sourceUrl = `https://ygoprodeck.com/deck/${slug}`;
  const response = await fetch(sourceUrl, {
    next: { revalidate: 1800 },
    headers: { "User-Agent": "DuelIndex/1.0 tournament-deck-view" },
  });
  if (!response.ok || response.url.includes("not-found")) return null;
  const html = await response.text();
  const title = decodeText(html.match(/<meta property="og:title" content="([^"]+)/i)?.[1] || slug).replace(/\s*-\s*YGOPRODeck$/i, "");
  const tournament = html.match(/fa-trophy[^>]*><\/i>\s*<b>([^<]+)<\/b>\s*of\s*<b><a[^>]*>([^<]+)<\/a>/i);
  const pilot = html.match(/piloted by\s*<b><a[^>]*>([^<]+)<\/a>/i);
  const date = html.match(/fa-calendar[^>]*><\/i>\s*([^<]+)/i);
  const tcgPrice = html.match(/title="Deck Price \(TCGplayer\)"[^>]*>\s*([^<]+)/i);
  const marketPrice = html.match(/title="Deck Price \(Cardmarket\)"[^>]*>\s*([^<]+)/i);
  const main = parseCards(html, "main_deck");
  const extra = parseCards(html, "extra_deck");
  const side = parseCards(html, "side_deck");
  if (main.length === 0) return null;
  return {
    title,
    event: decodeText(tournament?.[2] || "Tournament Deck"),
    placement: decodeText(tournament?.[1] || "Top Cut"),
    pilot: decodeText(pilot?.[1] || "Chưa công bố"),
    date: decodeText(date?.[1] || "Chưa rõ ngày"),
    tcgPrice: tcgPrice ? decodeText(tcgPrice[1]) : null,
    cardmarketPrice: marketPrice ? decodeText(marketPrice[1]) : null,
    sourceUrl,
    main,
    extra,
    side,
  };
});

function totalCards(cards: DeckCard[]) {
  return cards.reduce((total, card) => total + card.quantity, 0);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const deck = await getDeck(slug);
  return deck
    ? { title: `${deck.title} | Duel Index`, description: `${deck.placement} tại ${deck.event}, sử dụng bởi ${deck.pilot}.` }
    : { title: "Không tìm thấy Decklist | Duel Index" };
}

export default async function InternalDeckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deck = await getDeck(slug);
  if (!deck) notFound();
  const sections = [
    { id: "main", label: "MAIN DECK", title: "Main Deck", cards: deck.main },
    { id: "extra", label: "EXTRA DECK", title: "Extra Deck", cards: deck.extra },
    { id: "side", label: "SIDE DECK", title: "Side Deck", cards: deck.side },
  ].filter((section) => section.cards.length > 0);

  return (
    <main className="deck-detail-page">
      <header className="detail-bar">
        <Link href="/decklists" className="back-button" aria-label="Quay lại decklists">←</Link>
        <Link className="detail-brand" href="/">DUEL <b>INDEX</b><small>DECK ANALYSIS</small></Link>
        <span className="detail-id">TOP DECK</span>
      </header>

      <section className="deck-profile-hero">
        <p className="overline"><span>●</span> TOURNAMENT DECK PROFILE</p>
        <h1>{deck.title}</h1>
        <div className="profile-event"><span>{deck.placement}</span><b>{deck.event}</b></div>
        <div className="profile-meta">
          <span><small>DUELIST</small><b>{deck.pilot}</b></span>
          <span><small>EVENT DATE</small><b>{deck.date}</b></span>
          <span><small>TOTAL CARDS</small><b>{totalCards(deck.main) + totalCards(deck.extra) + totalCards(deck.side)}</b></span>
        </div>
      </section>

      <section className="deck-analysis-shell">
        <div className="deck-count-strip">
          {sections.map((section) => <span key={section.id}><small>{section.label}</small><b>{totalCards(section.cards)}</b></span>)}
          {(deck.tcgPrice || deck.cardmarketPrice) && <span><small>EST. VALUE</small><b>{deck.tcgPrice || deck.cardmarketPrice}</b></span>}
        </div>

        {sections.map((section) => (
          <section className={`internal-deck-section ${section.id}`} key={section.id}>
            <div className="internal-section-head">
              <span>{section.id === "main" ? "Ⅰ" : section.id === "extra" ? "Ⅱ" : "Ⅲ"}</span>
              <div><small>{section.label}</small><h2>{section.title}</h2></div>
              <b>{totalCards(section.cards)} CARDS</b>
            </div>
            <div className="internal-card-grid">
              {section.cards.map((card) => (
                <Link className="deck-card-tile" href={`/cards/${card.id}`} key={card.id} aria-label={`Xem lá bài ${card.name}`}>
                  <div className="deck-card-image"><img src={`/api/card-image?id=${card.id}`} alt="" loading="lazy" /><span>×{card.quantity}</span></div>
                  <div><b>{card.name}</b><small>{card.type}</small></div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <div className="data-source-panel">
          <span>DATA SOURCE</span>
          <p>Thông tin decklist được lấy từ YGOPRODeck và trình bày lại bằng giao diện riêng của Duel Index.</p>
          <a href={deck.sourceUrl} target="_blank" rel="noopener noreferrer">XEM DỮ LIỆU GỐC ↗</a>
        </div>
      </section>

      <div className="detail-bottom-bar"><Link href="/decklists">← TOP DECKLISTS</Link><span>{deck.placement} · {deck.event}</span></div>
    </main>
  );
}
