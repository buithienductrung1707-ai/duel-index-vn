import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Tournament Decklists | Duel Index",
  description: "Decklist mới từ các giải Yu-Gi-Oh! lớn thuộc TCG và OCG.",
};

type TournamentDeck = {
  slug: string;
  title: string;
  event: string;
  placement: string;
  players: string;
  age: string;
  pilot: string;
  imageId: string | null;
  url: string;
  region: "TCG" | "OCG";
};

type RankedDeck = TournamentDeck & {
  usagePct: number;
  winPct: number;
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

async function getDecks(region: "TCG" | "OCG") {
  const category = region === "TCG" ? "tournament%20meta%20decks" : "tournament%20meta%20decks%20ocg";
  const response = await fetch(`https://ygoprodeck.com/category/format/${category}`, {
    next: { revalidate: 1800 },
    headers: { "User-Agent": "DuelIndex/1.0 tournament-deck-feed" },
  });
  if (!response.ok) return [] as TournamentDeck[];
  const html = await response.text();
  const pattern = /data-src="([^"]*cards_cropped\/([0-9]+)\.jpg)"[\s\S]*?<span class="rounded-pill deck-type-badge text-center">([\s\S]*?)<\/span>[\s\S]*?<a href="(\/deck\/[^"]+)"[^>]*deck_article-card-title[^>]*>([\s\S]*?)<\/a>[\s\S]*?<div class="deck_article-card-stats">([\s\S]*?)<\/div>/g;
  const decks: TournamentDeck[] = [];
  for (const match of html.matchAll(pattern)) {
    const stats = decodeText(match[6]);
    const detail = stats.match(/^(.*?)\s+\(([^)]+)\)\s+(.*?)\s+piloted by\s+(.+)$/i);
    decks.push({
      slug: match[4].replace("/deck/", ""),
      title: decodeText(match[5]),
      event: decodeText(match[3]),
      placement: detail?.[1] || stats.split("(")[0]?.trim() || "Top Cut",
      players: detail?.[2] || "Quy mô chưa rõ",
      age: detail?.[3] || "Mới cập nhật",
      pilot: detail?.[4] || "Chưa công bố",
      imageId: match[2] || null,
      url: `https://ygoprodeck.com${match[4]}`,
      region,
    });
  }
  return decks;
}

function isPremier(event: string) {
  return /(YCS|WCQ|WORLD|CHAMPIONSHIP|NATIONAL|REGIONAL)/i.test(event);
}

function placementRank(placement: string) {
  if (/(winner|champion)/i.test(placement)) return 1;
  const place = placement.match(/(?:^|\s)([0-9]{1,2})(?:st|nd|rd|th)?\s*(?:place)?/i);
  if (place) return Number(place[1]);
  const top = placement.match(/top\s*([0-9]{1,2})/i);
  return top ? Number(top[1]) : null;
}

function isTopTen(deck: TournamentDeck) {
  const rank = placementRank(deck.placement);
  return rank !== null && rank <= 10;
}

function rankByMeta(decks: TournamentDeck[]) {
  const qualified = decks.filter(isTopTen);
  const archetypes = new Map<string, { count: number; wins: number }>();
  for (const deck of qualified) {
    const key = deck.title.toLocaleLowerCase("en");
    const current = archetypes.get(key) || { count: 0, wins: 0 };
    current.count += 1;
    if (placementRank(deck.placement) === 1) current.wins += 1;
    archetypes.set(key, current);
  }
  return qualified
    .map((deck, sourceIndex) => {
      const stats = archetypes.get(deck.title.toLocaleLowerCase("en"))!;
      return {
        ...deck,
        sourceIndex,
        usagePct: Math.round((stats.count / qualified.length) * 100),
        winPct: Math.round((stats.wins / stats.count) * 100),
      };
    })
    .sort((a, b) => b.usagePct - a.usagePct || b.winPct - a.winPct || a.sourceIndex - b.sourceIndex)
    .slice(0, 10) as RankedDeck[];
}

function topArchetypes(decks: RankedDeck[]) {
  const seen = new Set<string>();
  return decks.filter((deck) => {
    const key = deck.title.toLocaleLowerCase("en");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

export default async function DecklistsPage() {
  const [tcgDecks, ocgDecks] = await Promise.all([getDecks("TCG"), getDecks("OCG")]);
  const tcgTop = rankByMeta(tcgDecks);
  const ocgTop = rankByMeta(ocgDecks);
  const decks = [...tcgTop, ...ocgTop];
  const premierCount = decks.filter((deck) => isPremier(deck.event)).length;
  const regions = [
    { id: "tcg", label: "TCG", title: "Top giải TCG", subtitle: "Yu-Gi-Oh! Trading Card Game · quốc tế", decks: tcgTop, leaders: topArchetypes(tcgTop) },
    { id: "ocg", label: "OCG", title: "Top giải OCG", subtitle: "Official Card Game · châu Á", decks: ocgTop, leaders: topArchetypes(ocgTop) },
  ];

  return (
    <main className="tournament-page">
      <header className="detail-bar">
        <Link href="/" className="back-button" aria-label="Quay lại trang chủ">←</Link>
        <Link className="detail-brand" href="/">DUEL <b>INDEX</b><small>TOURNAMENT ARCHIVE</small></Link>
        <span className="live-chip"><i /> LIVE</span>
      </header>

      <section className="tournament-hero">
        <div className="trophy-mark" aria-hidden="true">♜</div>
        <p className="overline"><span>●</span> COMPETITIVE INTELLIGENCE</p>
        <h1>Decklist từ<br />đấu trường lớn.</h1>
        <p>Theo dõi chiến thuật Top Cut từ YCS, WCQ, Championship và Regional của cả TCG lẫn OCG.</p>
        <div className="tournament-metrics">
          <span><b>{decks.length}</b><small>DECK TOP 10</small></span>
          <span><b>{premierCount}</b><small>PREMIER EVENT</small></span>
          <span><b>30m</b><small>CHU KỲ CẬP NHẬT</small></span>
        </div>
      </section>

      <section className="deck-feed">
        <div className="feed-heading">
          <div><small>ARCHIVE / TOURNAMENT</small><h2>Top 10 mới cập nhật</h2></div>
          <span>≤ TOP 10</span>
        </div>

        {decks.length === 0 ? (
          <div className="deck-feed-empty">
            <b>FEED TẠM GIÁN ĐOẠN</b>
            <p>Chưa tải được decklist mới. Bạn vẫn có thể mở nguồn Tournament Meta bên dưới.</p>
            <a href="https://ygoprodeck.com/category/format/tournament%20meta%20decks" target="_blank" rel="noopener noreferrer">MỞ NGUỒN ↗</a>
          </div>
        ) : (
          <div className="region-feeds">
            {regions.map((region) => (
              <section className={`deck-region-block ${region.id}`} id={region.id} key={region.id}>
                <div className="deck-region-heading">
                  <span className="region-monogram">{region.label}</span>
                  <div><small>FORMAT / {region.label}</small><h2>{region.title}</h2><p>{region.subtitle}</p></div>
                  <b>{region.decks.length}/10</b>
                </div>
                {region.leaders.length > 0 && (
                  <div className="meta-leaderboard">
                    {region.leaders.map((leader, index) => (
                      <div key={leader.title}>
                        <span>#{index + 1}</span>
                        <b>{leader.title}</b>
                        <small>USE {leader.usagePct}%</small>
                      </div>
                    ))}
                  </div>
                )}
                {region.decks.length === 0 ? (
                  <div className="region-empty">Chưa có deck đạt Top 10 trong đợt cập nhật hiện tại.</div>
                ) : (
                  <div className="tournament-grid">
                    {region.decks.map((deck, index) => (
                      <Link className="tournament-card" href={`/decklists/${deck.slug}`} key={`${deck.region}-${deck.url}`}>
                        <div className="deck-art">
                          {deck.imageId && <img src={`/api/card-image?id=${deck.imageId}`} alt="" loading="lazy" />}
                          <span className={`format-badge ${deck.region.toLowerCase()}`}>{deck.region}</span>
                          {isPremier(deck.event) && <span className="premier-badge">PREMIER</span>}
                          <b>TOP LIST · {String(index + 1).padStart(2, "0")}</b>
                        </div>
                        <div className="deck-card-body">
                          <small className="event-name">{deck.event}</small>
                          <h3>{deck.title}</h3>
                          <div className="deck-result"><strong>{deck.placement}</strong><span>{deck.players}</span></div>
                          <div className="deck-rate-row">
                            <span>
                              <small>USE RATE</small><b>{deck.usagePct}%</b>
                              <i><em style={{ width: `${deck.usagePct}%` }} /></i>
                            </span>
                            <span>
                              <small>WIN SHARE</small><b>{deck.winPct}%</b>
                              <i><em style={{ width: `${deck.winPct}%` }} /></i>
                            </span>
                          </div>
                          <div className="deck-pilot"><span><small>DUELIST</small><b>{deck.pilot}</b></span><span><small>UPDATED</small><b>{deck.age}</b></span></div>
                          <span className="open-deck">MỞ TRONG DUEL INDEX <b>→</b></span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        <p className="source-disclaimer"><b>Cách tính:</b> Use Rate là tỷ lệ archetype trong toàn bộ deck Top 10 hiện có của từng khu vực. Win Share là tỷ lệ deck Winner/Champion/hạng 1 trên số deck cùng archetype — không phải tỷ lệ thắng từng ván. Chỉ sử dụng dữ liệu Tournament Meta của YGOPRODeck.</p>
      </section>

      <nav className="mobile-nav" aria-label="Điều hướng di động">
        <Link href="/"><span>⌕</span>Tra cứu</Link>
        <Link href="/#cards"><span>▤</span>Thư viện</Link>
        <Link className="active" href="/decklists"><span>♜</span>Giải đấu</Link>
        <Link href="/banlist"><span>⊘</span>Banlist</Link>
      </nav>
    </main>
  );
}
