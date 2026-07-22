import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type UpstreamCard = {
  id: number;
  name: string;
  type: string;
  desc: string;
  race: string;
  attribute?: string;
  level?: number;
  linkval?: number;
  linkmarkers?: string[];
  atk?: number;
  def?: number;
  archetype?: string;
  card_images?: Array<{ id: number }>;
  banlist_info?: { ban_tcg?: string; ban_ocg?: string; ban_goat?: string };
  card_prices?: Array<{
    tcgplayer_price?: string;
    cardmarket_price?: string;
    ebay_price?: string;
    amazon_price?: string;
    coolstuffinc_price?: string;
  }>;
  card_sets?: Array<{ set_name: string; set_code: string; set_rarity: string; set_price: string }>;
  misc_info?: Array<{ konami_id?: number; tcg_date?: string; ocg_date?: string; formats?: string[] }>;
};

const API_URL = "https://db.ygoprodeck.com/api/v7/cardinfo.php";

async function getCard(id: string) {
  if (!/^\d+$/.test(id)) return null;
  const response = await fetch(`${API_URL}?id=${id}&misc=yes`, { next: { revalidate: 3600 } });
  if (!response.ok) return null;
  const payload = (await response.json()) as { data?: UpstreamCard[] };
  return payload.data?.[0] || null;
}

async function getJapaneseName(konamiId?: number) {
  if (!konamiId) return null;
  try {
    const response = await fetch(
      `https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=2&cid=${konamiId}&request_locale=ja`,
      { next: { revalidate: 86400 } },
    );
    if (!response.ok) return null;
    const html = await response.text();
    return html.match(/<meta name="keywords" content="([^,"]+)/i)?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

async function getOfficialRulingInfo(konamiId?: number) {
  if (!konamiId) return null;
  const url = `https://www.db.yugioh-card.com/yugiohdb/faq_search.action?cid=${konamiId}&ope=4&request_locale=ja`;
  try {
    const response = await fetch(url, { next: { revalidate: 21600 } });
    if (!response.ok) return { url, count: null, updatedAt: null };
    const html = await response.text();
    const countMatch = html.match(/全\s*([0-9０-９]+)\s*件中/);
    const updateMatch = html.match(/補足情報[^0-9０-９]*([0-9０-９]{4}-[0-9０-９]{2}-[0-9０-９]{2})/);
    return {
      url,
      count: countMatch?.[1] || null,
      updatedAt: updateMatch?.[1] || null,
    };
  } catch {
    return { url, count: null, updatedAt: null };
  }
}

function vendorSearchUrl(vendor: string, name: string) {
  const query = encodeURIComponent(name);
  const urls: Record<string, string> = {
    TCGplayer: `https://www.tcgplayer.com/search/yugioh/product?q=${query}&view=grid`,
    Cardmarket: `https://www.cardmarket.com/en/YuGiOh/Products/Search?searchString=${query}`,
    eBay: `https://www.ebay.com/sch/i.html?_nkw=Yu-Gi-Oh%20${query}`,
    Amazon: `https://www.amazon.com/s?k=Yu-Gi-Oh%20${query}`,
    CoolStuffInc: `https://www.coolstuffinc.com/main_search.php?pa=searchOnName&q=${query}`,
  };
  return urls[vendor];
}

function formatSetPrice(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `$${amount.toFixed(2)}` : null;
}

function rarityTone(rarity: string) {
  const value = rarity.toLowerCase();
  if (value.includes("quarter century")) return "quarter";
  if (value.includes("starlight")) return "starlight";
  if (value.includes("platinum")) return "platinum";
  if (value.includes("collector")) return "collector";
  if (value.includes("ultimate")) return "ultimate";
  if (value.includes("secret")) return "secret";
  if (value.includes("ultra")) return "ultra";
  if (value.includes("super")) return "super";
  return "standard";
}

function attributeSymbol(attribute?: string) {
  const symbols: Record<string, string> = {
    DARK: "◐", LIGHT: "✦", FIRE: "△", WATER: "≋", EARTH: "◆", WIND: "◇", DIVINE: "✹",
  };
  return attribute ? symbols[attribute] || "●" : "✧";
}

function cardTone(type: string) {
  if (type.includes("Spell")) return "spell";
  if (type.includes("Trap")) return "trap";
  if (type.includes("Fusion")) return "fusion";
  if (type.includes("Synchro")) return "synchro";
  if (type.includes("Xyz")) return "xyz";
  if (type.includes("Link")) return "link";
  return "monster";
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const card = await getCard(id);
  if (!card) return { title: "Không tìm thấy lá bài | Duel Index" };
  return {
    title: `${card.name} | Duel Index`,
    description: card.desc.slice(0, 155),
  };
}

export default async function CardDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await getCard(id);
  if (!card) notFound();

  const imageId = card.card_images?.[0]?.id || card.id;
  const price = card.card_prices?.[0];
  const sets = Array.from(
    (card.card_sets || []).reduce((groups, set) => {
      const key = `${set.set_name}::${set.set_code}`;
      const group = groups.get(key) || {
        name: set.set_name,
        code: set.set_code,
        variants: [] as Array<{ rarity: string; price: string }>,
      };
      const isDuplicate = group.variants.some(
        (variant) => variant.rarity === set.set_rarity && variant.price === set.set_price,
      );
      if (!isDuplicate) group.variants.push({ rarity: set.set_rarity, price: set.set_price });
      groups.set(key, group);
      return groups;
    }, new Map<string, { name: string; code: string; variants: Array<{ rarity: string; price: string }> }>()).values(),
  ).slice(0, 8);
  const level = card.level ?? card.linkval;
  const misc = card.misc_info?.[0];
  const [japaneseName, rulingInfo] = await Promise.all([
    getJapaneseName(misc?.konami_id),
    getOfficialRulingInfo(misc?.konami_id),
  ]);
  const tcgPrices = [
    { vendor: "TCGplayer", value: price?.tcgplayer_price, currency: "$" },
    { vendor: "Cardmarket", value: price?.cardmarket_price, currency: "€" },
    { vendor: "eBay", value: price?.ebay_price, currency: "$" },
    { vendor: "Amazon", value: price?.amazon_price, currency: "$" },
    { vendor: "CoolStuffInc", value: price?.coolstuffinc_price, currency: "$" },
  ];
  const ocgQuery = japaneseName || card.name;
  const ocgSources = [
    {
      name: "BIGWEB",
      note: "Giá bán tại Nhật · theo set & độ hiếm",
      href: `https://www.bigweb.co.jp/ja/products/yugioh/list?name=${encodeURIComponent(ocgQuery)}`,
    },
    {
      name: "ドラゴンスター",
      note: "Dragon Star · hàng OCG Nhật",
      href: `https://dorasuta.jp/yugioh-jp/product-list?kw=${encodeURIComponent(ocgQuery)}`,
    },
  ];

  return (
    <main className={`detail-page ${cardTone(card.type)}`}>
      <header className="detail-bar">
        <Link href="/#cards" className="back-button" aria-label="Quay lại danh sách">←</Link>
        <Link className="detail-brand" href="/">DUEL <b>INDEX</b><small>CARD PROFILE</small></Link>
        <span className="detail-id">#{card.id}</span>
      </header>

      <article className="detail-shell">
        <section className="detail-visual" aria-label={`Hình ảnh lá bài ${card.name}`}>
          <div className="detail-orbit" aria-hidden="true" />
          <img src={`/api/card-image?id=${imageId}`} alt={`Lá bài ${card.name}`} />
          {card.banlist_info?.ban_tcg && <span className="detail-ban">TCG · {card.banlist_info.ban_tcg}</span>}
        </section>

        <section className="detail-info">
          <p className="detail-kicker">CARD DATABASE / {card.attribute || card.race}</p>
          <div className="detail-title-row">
            <h1>{card.name}</h1>
            <span className="detail-attribute" aria-label={card.attribute || card.race}>{attributeSymbol(card.attribute)}</span>
          </div>

          <div className="detail-tags">
            <span>{card.type}</span>
            <span>{card.race}</span>
            {card.archetype && <span>{card.archetype}</span>}
          </div>

          {(level !== undefined || card.atk !== undefined || card.def !== undefined) && (
            <div className="detail-stats">
              {level !== undefined && <div><small>{card.linkval ? "LINK" : "LEVEL"}</small><strong>{level}</strong></div>}
              {card.atk !== undefined && <div><small>ATK</small><strong>{card.atk}</strong></div>}
              {card.def !== undefined && <div><small>DEF</small><strong>{card.def}</strong></div>}
            </div>
          )}

          <section className="effect-panel">
            <p>EFFECT / DESCRIPTION</p>
            <div>{card.desc}</div>
          </section>

          <section className="ruling-panel">
            <div className="ruling-head">
              <span className="ruling-seal" aria-hidden="true">✓</span>
              <div><small>OFFICIAL RULING DATABASE</small><h2>Ruling &amp; FAQ</h2></div>
              <em>KONAMI</em>
            </div>

            <div className="ruling-primary">
              <div className="ruling-count">
                <strong>{rulingInfo?.count || "FAQ"}</strong>
                <span>{rulingInfo?.count ? "Q&A liên quan" : "Tra cứu chính thức"}</span>
              </div>
              <div className="ruling-summary">
                <b>OCG · Card-specific rulings</b>
                <p>Toàn bộ bổ sung cách xử lý và câu hỏi liên quan trực tiếp đến lá bài trên cơ sở dữ liệu chính thức.</p>
                {rulingInfo?.updatedAt && <small>CẬP NHẬT BỔ SUNG · {rulingInfo.updatedAt}</small>}
              </div>
            </div>

            <div className="ruling-links">
              <a
                href={rulingInfo?.url || "https://www.db.yugioh-card.com/yugiohdb/faq_search.action?request_locale=ja"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span><b>Q&amp;A chính thức OCG</b><small>Tiếng Nhật · cập nhật trực tiếp từ Konami</small></span>
                <strong>MỞ TẤT CẢ ↗</strong>
              </a>
              <a href="https://www.yugioh-card.com/en/rulebook/index.html" target="_blank" rel="noopener noreferrer">
                <span><b>TCG Official Rulebook</b><small>Luật nền tảng và bản cập nhật chính thức</small></span>
                <strong>XEM LUẬT ↗</strong>
              </a>
            </div>

            <p className="ruling-warning"><b>Lưu ý khu vực:</b> ruling OCG và TCG có thể khác nhau. Khi thi đấu, áp dụng tài liệu của khu vực và quyết định của Head Judge tại sự kiện.</p>
          </section>

          {card.linkmarkers && card.linkmarkers.length > 0 && (
            <section className="detail-row"><span>LINK MARKERS</span><b>{card.linkmarkers.join(" · ")}</b></section>
          )}

          <section className="price-terminal">
            <div className="price-heading">
              <div><span>MARKET INTEL</span><h2>Giá thị trường</h2></div>
              <small>LIVE REFERENCE</small>
            </div>

            <div className="market-region">
              <div className="region-title">
                <span className="region-badge tcg">TCG</span>
                <div><b>Thị trường quốc tế</b><small>Giá thấp nhất được ghi nhận giữa các phiên bản</small></div>
              </div>
              <div className="vendor-grid">
                {tcgPrices.map((item) => (
                  <a
                    href={vendorSearchUrl(item.vendor, card.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vendor-card"
                    key={item.vendor}
                    aria-label={`Xem ${card.name} trên ${item.vendor}`}
                  >
                    <span>{item.vendor}</span>
                    <strong>{item.value && item.value !== "0.00" ? `${item.currency}${item.value}` : "—"}</strong>
                    <small>XEM NGUỒN ↗</small>
                  </a>
                ))}
              </div>
              <p className="price-note">Dữ liệu tổng hợp từ YGOPRODeck; mỗi mức giá là giá thấp nhất giữa nhiều bản in và có thể chưa gồm phí vận chuyển.</p>
            </div>

            <div className="market-region ocg-region">
              <div className="region-title">
                <span className="region-badge ocg">OCG</span>
                <div><b>Thị trường Nhật Bản</b><small>{japaneseName || "Tra cứu theo tên lá bài"}</small></div>
              </div>
              <div className="ocg-sources">
                {ocgSources.map((source) => (
                  <a href={source.href} target="_blank" rel="noopener noreferrer" key={source.name}>
                    <span><b>{source.name}</b><small>{source.note}</small></span>
                    <strong>GIÁ JPY ↗</strong>
                  </a>
                ))}
              </div>
              <p className="price-note">Bigweb không cung cấp API giá công khai. Mở nguồn để chọn đúng mã set, độ hiếm và tình trạng; đây là các yếu tố làm giá OCG chênh lệch lớn.</p>
            </div>

            <div className="release-dates">
              <span><small>OCG PHÁT HÀNH</small><b>{misc?.ocg_date || "—"}</b></span>
              <span><small>TCG PHÁT HÀNH</small><b>{misc?.tcg_date || "—"}</b></span>
            </div>
          </section>

          {sets.length > 0 && (
            <section className="set-panel">
              <div className="panel-heading"><span>◈</span><div><small>RELEASE ARCHIVE</small><h2>Bộ phát hành</h2></div></div>
              <div className="set-list">
                {sets.map((set) => (
                  <div className="set-item" key={`${set.code}-${set.name}`}>
                    <div className="set-summary">
                      <span><b>{set.name}</b><small>{set.code}</small></span>
                      {set.variants.length > 1 && <em>{set.variants.length} phiên bản</em>}
                    </div>
                    <div className="set-variants">
                      {set.variants.map((variant, variantIndex) => {
                        const setPrice = formatSetPrice(variant.price);
                        const priceSearch = `${card.name} ${set.code} ${variant.rarity}`;
                        return (
                          <a
                            className={`foil-card ${rarityTone(variant.rarity)}`}
                            href={vendorSearchUrl("TCGplayer", priceSearch)}
                            target="_blank"
                            rel="noopener noreferrer"
                            key={`${variant.rarity}-${variant.price}`}
                            aria-label={`Tra giá ${variant.rarity} của ${card.name}`}
                          >
                            <i className="foil-glint" aria-hidden="true" />
                            <span className="foil-top"><em>FOIL {String(variantIndex + 1).padStart(2, "0")}</em><b>↗</b></span>
                            <strong>{variant.rarity}</strong>
                            <span className="foil-price">
                              <small>{setPrice ? "GIÁ THAM KHẢO" : "GIÁ THEO PHIÊN BẢN"}</small>
                              <b>{setPrice || "TRA GIÁ"}</b>
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>
      </article>

      <div className="detail-bottom-bar">
        <Link href="/#cards">← DANH SÁCH BÀI</Link>
        <span>PASSCODE · {card.id}</span>
      </div>
    </main>
  );
}
