"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Card = {
  id: number;
  name: string;
  type: string;
  description: string;
  race: string;
  attribute: string | null;
  level: number | null;
  atk: number | null;
  def: number | null;
  archetype: string | null;
  imageId: number;
  banStatus: string | null;
  price: string | null;
};

const FILTERS = ["Tất cả", "Monster", "Spell", "Trap"];

function cardTone(type: string) {
  if (type.includes("Spell")) return "spell";
  if (type.includes("Trap")) return "trap";
  if (type.includes("Fusion")) return "fusion";
  if (type.includes("Synchro")) return "synchro";
  if (type.includes("Xyz")) return "xyz";
  if (type.includes("Link")) return "link";
  return "monster";
}

function attributeSymbol(attribute: string | null) {
  const symbols: Record<string, string> = {
    DARK: "◐", LIGHT: "✦", FIRE: "△", WATER: "≋", EARTH: "◆", WIND: "◇", DIVINE: "✹",
  };
  return attribute ? symbols[attribute] || "●" : "✧";
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [filter, setFilter] = useState("Tất cả");
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCards = useCallback(async (search: string, selectedFilter: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (selectedFilter !== "Tất cả") params.set("kind", selectedFilter);
      const response = await fetch(`/api/cards?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không thể tải dữ liệu bài.");
      setCards(payload.cards);
    } catch (err) {
      setCards([]);
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCards(activeQuery, filter);
  }, [activeQuery, filter, loadCards]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveQuery(query);
  }

  return (
    <main>
      <header className="app-bar" id="top">
        <a className="brand" href="#top" aria-label="Duel Index – Trang chủ">
          <span className="brand-eye" aria-hidden="true"><i /></span>
          <span><b>DUEL</b> INDEX<small>CARD ARCHIVE</small></span>
        </a>
        <div className="lp-chip" aria-label="Life Points 8000"><small>LP</small> 8000</div>
      </header>

      <section className="hero">
        <div className="duel-ring" aria-hidden="true"><span /><i /></div>
        <p className="overline"><span>●</span> DUELIST DATABASE · ONLINE</p>
        <h1>Triệu hồi mọi<br />thông tin bạn cần.</h1>
        <p className="hero-copy">Kho dữ liệu bài dành cho Duelist Việt — nhanh, rõ và tối ưu cho điện thoại.</p>

        <form className="search-card" onSubmit={handleSubmit} role="search">
          <div className="search-label"><span>✦</span> CARD SEARCH</div>
          <div className="search-row">
            <label className="sr-only" htmlFor="card-search">Tên hoặc mã lá bài</label>
            <span className="search-glyph" aria-hidden="true">⌕</span>
            <input
              id="card-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tên bài hoặc Passcode..."
              autoComplete="off"
              enterKeyHint="search"
            />
            <button type="submit" aria-label="Tra cứu lá bài">GO</button>
          </div>
        </form>

        <div className="quick-searches" aria-label="Tìm kiếm gợi ý">
          {[
            ["Dark Magician", "Phù thủy"],
            ["Blue-Eyes", "Rồng trắng"],
            ["Ash Blossom", "Hand trap"],
          ].map(([term, label]) => (
            <button key={term} onClick={() => { setQuery(term); setActiveQuery(term); }}>
              <span>{label}</span>{term}
            </button>
          ))}
        </div>
      </section>

      <section className="results-section" id="cards">
        <div className="section-heading">
          <div>
            <p>ARCHIVE / 01</p>
            <h2>{activeQuery ? `Kết quả: “${activeQuery}”` : "Lá bài nổi bật"}</h2>
          </div>
          {!loading && !error && <span className="result-count">{cards.length} CARDS</span>}
        </div>

        <div className="filters" aria-label="Lọc loại bài">
          {FILTERS.map((item) => (
            <button
              key={item}
              className={filter === item ? "selected" : ""}
              onClick={() => setFilter(item)}
              aria-pressed={filter === item}
            >
              <span aria-hidden="true">{item === "Monster" ? "★" : item === "Spell" ? "✦" : item === "Trap" ? "◆" : "◎"}</span>
              {item}
            </button>
          ))}
        </div>

        {loading && (
          <div className="loading-stack" aria-label="Đang tải dữ liệu">
            {[0, 1, 2].map((item) => <div className="card-skeleton" key={item}><span /><i /></div>)}
          </div>
        )}
        {!loading && error && <div className="status-panel error"><b>CONNECTION LOST</b>{error}</div>}
        {!loading && !error && cards.length === 0 && (
          <div className="status-panel"><b>NO CARD FOUND</b>Không tìm thấy lá bài phù hợp.</div>
        )}

        <div className="card-grid" aria-live="polite">
          {!loading && cards.map((card, index) => (
            <Link
              className={`card-result ${cardTone(card.type)}`}
              href={`/cards/${card.id}`}
              key={card.id}
              aria-label={`Xem chi tiết lá bài ${card.name}`}
            >
              <div className="card-image-wrap">
                <img src={`/api/card-image?id=${card.imageId}`} alt={`Lá bài ${card.name}`} loading="lazy" />
                <span className="card-number">#{String(index + 1).padStart(2, "0")}</span>
                {card.banStatus && <span className="ban-badge">{card.banStatus}</span>}
              </div>
              <div className="card-content">
                <div className="card-topline">
                  <span className="attribute"><i>{attributeSymbol(card.attribute)}</i>{card.attribute || card.race}</span>
                  <span className="card-passcode">{card.id}</span>
                </div>
                <h3>{card.name}</h3>
                <div className="type-line"><span />{card.type}</div>
                {card.level !== null && (
                  <div className="level-row" aria-label={`Level ${card.level}`}>
                    {Array.from({ length: Math.min(card.level, 12) }).map((_, star) => <span key={star}>★</span>)}
                  </div>
                )}
                <p>{card.description}</p>
                <div className="stats">
                  {card.atk !== null && <span><small>ATK</small><b>{card.atk}</b></span>}
                  {card.def !== null && <span><small>DEF</small><b>{card.def}</b></span>}
                  {card.price && <span className="price"><small>MARKET</small><b>${card.price}</b></span>}
                </div>
              </div>
              <span className="detail-cue" aria-hidden="true">CHI TIẾT →</span>
            </Link>
          ))}
        </div>
      </section>

      <footer>
        <span>DATA POWERED BY YGOPRODECK</span>
        <span>FAN-MADE · NOT AFFILIATED WITH KONAMI</span>
      </footer>

      <nav className="mobile-nav" aria-label="Điều hướng di động">
        <a className="active" href="#top"><span>⌕</span>Tra cứu</a>
        <a href="#cards"><span>▤</span>Thư viện</a>
        <Link href="/decklists"><span>♜</span>Giải đấu</Link>
        <Link href="/banlist"><span>⊘</span>Banlist</Link>
      </nav>
    </main>
  );
}
