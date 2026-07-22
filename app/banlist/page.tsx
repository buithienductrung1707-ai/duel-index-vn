import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Banlist OCG & TCG | Duel Index",
  description: "Danh sách Forbidden, Limited và Semi-Limited của Yu-Gi-Oh! OCG và TCG.",
};

type BanStatus = "Forbidden" | "Limited" | "Semi-Limited";
type BanCard = { id: number; name: string; type: string; imageId: number; status: BanStatus };
type UpstreamCard = {
  id: number;
  name: string;
  type: string;
  card_images?: Array<{ id: number }>;
  banlist_info?: { ban_tcg?: BanStatus; ban_ocg?: BanStatus };
};

async function getBanlist(region: "TCG" | "OCG") {
  const response = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?banlist=${region.toLowerCase()}`, {
    next: { revalidate: 3600 },
  });
  if (!response.ok) return [] as BanCard[];
  const payload = (await response.json()) as { data?: UpstreamCard[] };
  return (payload.data || [])
    .map((card) => {
      const status = region === "TCG" ? card.banlist_info?.ban_tcg : card.banlist_info?.ban_ocg;
      if (!status) return null;
      return { id: card.id, name: card.name, type: card.type, imageId: card.card_images?.[0]?.id || card.id, status };
    })
    .filter((card): card is BanCard => card !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function groupCards(cards: BanCard[], status: BanStatus) {
  return cards.filter((card) => card.status === status);
}

export default async function BanlistPage() {
  const [tcgCards, ocgCards] = await Promise.all([getBanlist("TCG"), getBanlist("OCG")]);
  const regions = [
    { id: "tcg", label: "TCG", title: "TCG Forbidden & Limited", subtitle: "Yu-Gi-Oh! Trading Card Game · quốc tế", cards: tcgCards },
    { id: "ocg", label: "OCG", title: "OCG Forbidden & Limited", subtitle: "Official Card Game · châu Á", cards: ocgCards },
  ];
  const statuses: Array<{ key: BanStatus; label: string; note: string }> = [
    { key: "Forbidden", label: "Forbidden", note: "Không được sử dụng trong Deck" },
    { key: "Limited", label: "Limited", note: "Tối đa 1 bản sao" },
    { key: "Semi-Limited", label: "Semi-Limited", note: "Tối đa 2 bản sao" },
  ];

  return (
    <main className="banlist-page">
      <header className="detail-bar">
        <Link href="/" className="back-button" aria-label="Quay lại trang chủ">←</Link>
        <Link className="detail-brand" href="/">DUEL <b>INDEX</b><small>LIMIT REGULATION</small></Link>
        <span className="live-chip"><i /> SYNC</span>
      </header>

      <section className="banlist-hero">
        <div className="banlist-sigil" aria-hidden="true">⊘</div>
        <p className="overline"><span>●</span> RESTRICTED CARD DATABASE</p>
        <h1>Banlist<br />OCG &amp; TCG.</h1>
        <p>Tra cứu trạng thái giới hạn theo đúng khu vực trước khi hoàn thiện Deck thi đấu.</p>
        <div className="banlist-totals">
          <span><small>TCG CARDS</small><b>{tcgCards.length}</b></span>
          <span><small>OCG CARDS</small><b>{ocgCards.length}</b></span>
          <span><small>DATA REFRESH</small><b>60m</b></span>
        </div>
      </section>

      <section className="banlist-shell">
        {regions.map((region) => (
          <section className={`ban-region ${region.id}`} id={region.id} key={region.id}>
            <div className="ban-region-heading">
              <span>{region.label}</span>
              <div><small>REGION / {region.label}</small><h2>{region.title}</h2><p>{region.subtitle}</p></div>
              <b>{region.cards.length}</b>
            </div>

            <div className="ban-status-summary">
              {statuses.map((status) => <span className={status.key.toLowerCase()} key={status.key}><small>{status.label}</small><b>{groupCards(region.cards, status.key).length}</b></span>)}
            </div>

            {statuses.map((status, index) => {
              const cards = groupCards(region.cards, status.key);
              return (
                <details className={`ban-status-group ${status.key.toLowerCase()}`} open={index === 0} key={status.key}>
                  <summary>
                    <span><i /> <b>{status.label}</b><small>{status.note}</small></span>
                    <em>{cards.length} CARDS</em>
                  </summary>
                  <div className="ban-card-grid">
                    {cards.map((card) => (
                      <Link className="ban-card" href={`/cards/${card.id}`} key={card.id} aria-label={`Xem ${card.name}`}>
                        <div><img src={`/api/card-image?id=${card.imageId}`} alt="" loading="lazy" /><span>{status.key === "Forbidden" ? "0" : status.key === "Limited" ? "1" : "2"}</span></div>
                        <b>{card.name}</b>
                        <small>{card.type}</small>
                      </Link>
                    ))}
                  </div>
                </details>
              );
            })}
          </section>
        ))}

        <p className="banlist-note">Nguồn dữ liệu duy nhất: YGOPRODeck. Duel Index đồng bộ trạng thái do nguồn cung cấp và không tự gán ngày hiệu lực. Hãy kiểm tra quy định của sự kiện trước khi thi đấu.</p>
      </section>

      <nav className="mobile-nav" aria-label="Điều hướng di động">
        <Link href="/"><span>⌕</span>Tra cứu</Link>
        <Link href="/#cards"><span>▤</span>Thư viện</Link>
        <Link href="/decklists"><span>♜</span>Giải đấu</Link>
        <Link className="active" href="/banlist"><span>⊘</span>Banlist</Link>
      </nav>
    </main>
  );
}
