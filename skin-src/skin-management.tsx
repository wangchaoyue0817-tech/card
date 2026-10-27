"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bag,
  CaretDown,
  CheckCircle,
  Clock,
  Drop,
  Lightning,
  List,
  ShieldCheck,
  Sparkle,
  TrendUp,
  X,
} from "@phosphor-icons/react";
import {
  catalogCategories,
  catalogProducts,
  detectionHistory,
  personalizedProductIds,
  personalizedRecommendations,
  type CatalogFilter,
  type CatalogProduct,
  type SkinDetectionRecord,
} from "./skin-data";
import { CustomerSupport, ProductGuarantee } from "./product-experience";

type SkinManagementProps = {
  initialView?: "history" | "catalog";
  records: SkinDetectionRecord[];
  recordsLoading: boolean;
  recordsError: string;
  onReloadRecords: () => void;
  onPurchase: (product: CatalogProduct) => void;
  onBack: () => void;
  onStartTest: () => void;
  onOpenMenu: () => void;
  inactive?: boolean;
};

const dateLabel = (date: string) => date === new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" }) ? "今天" : `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;

function TrendChart({ onOpenReport, records }: { onOpenReport: (record: SkinDetectionRecord) => void; records: SkinDetectionRecord[] }) {
  const dayMs = 24 * 60 * 60 * 1000;
  const timelineAnchorTime = Date.parse(`${records[0].date}T00:00:00Z`);
  const trendWindowRecords = records.filter(record => (timelineAnchorTime - Date.parse(`${record.date}T00:00:00Z`)) / dayMs < 30);
  const orderedTrendRecords = [...trendWindowRecords].reverse();
  const trendChange = trendWindowRecords[0].score - trendWindowRecords.at(-1)!.score;
  const scoreMin = Math.min(65, ...records.map(item => item.score - 3));
  const scoreMax = Math.max(85, ...records.map(item => item.score + 3));
  const chartHeight = 142;
  const chartWidth = Math.max(500, orderedTrendRecords.length * 62);
  const chartPoints = orderedTrendRecords.map((record, index) => ({
    record, x: records.length === 1 ? chartWidth / 2 : 30 + index * ((chartWidth - 60) / Math.max(1, orderedTrendRecords.length - 1)),
    y: 16 + ((scoreMax - record.score) / (scoreMax - scoreMin)) * 88,
  }));
  const trendPolyline = chartPoints.map(point => `${point.x},${point.y}`).join(" ");
  const [activeId, setActiveId] = useState(records[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activePoint = chartPoints.find(item => item.record.id === activeId) ?? chartPoints.at(-1)!;

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, []);

  return (
    <section className="skin-panel trend-panel" aria-labelledby="skin-trend-title">
      <header className="skin-section-heading">
        <div><small>SKIN TIMELINE</small><h2 id="skin-trend-title">肤质变化</h2></div>
        <span className="trend-range">近 30 天 <CaretDown size={11} /></span>
      </header>
      <div className="trend-summary">
        <div><small>最新肤质分</small><strong>{trendWindowRecords[0].score}</strong><span>/100</span></div>
        <div><b><TrendUp size={14} weight="bold" /> {records.length === 1 ? "首次记录 · 建立肤况起点" : `较周期初 ${trendChange >= 0 ? "+" : ""}${trendChange}`}</b><small>近 30 天 {trendWindowRecords.length} 次检测</small></div>
      </div>
      <button className="trend-insight" type="button" onClick={() => onOpenReport(activePoint.record)}>
        <span><time>{activePoint.record.shortDate} {activePoint.record.time}</time><b>{activePoint.record.title}</b></span>
        <strong>{activePoint.record.score} 分 <ArrowRight size={13} /></strong>
      </button>
      <div className="trend-scroll" ref={scrollRef} aria-label="近30天肤质分变化，可横向滑动">
        <div className="trend-canvas" style={{ width: `${chartWidth}px`, height: `${chartHeight}px` }}>
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="肤质分随检测时间的变化折线图">
            <defs>
              <linearGradient id="trend-stroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5bd9ff"/><stop offset=".55" stopColor="#8872ff"/><stop offset="1" stopColor="#ffc968"/></linearGradient>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7967ff" stopOpacity=".32"/><stop offset="1" stopColor="#7967ff" stopOpacity="0"/></linearGradient>
            </defs>
            {[70, 75, 80].map(score => {
              const y = 16 + ((scoreMax - score) / (scoreMax - scoreMin)) * 88;
              return <g key={score}><line x1="18" x2={chartWidth - 18} y1={y} y2={y} className="trend-grid-line"/><text x="20" y={y - 5} className="trend-grid-label">{score}</text></g>;
            })}
            <polygon points={`${trendPolyline} ${chartWidth - 30},112 30,112`} fill="url(#trend-fill)" />
            <polyline points={trendPolyline} fill="none" stroke="url(#trend-stroke)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            {chartPoints.map((point, index) => (
              <g key={point.record.id} className={point.record.id === activeId ? "trend-point is-active" : "trend-point"} aria-hidden="true">
                <circle cx={point.x} cy={point.y} r="10" className="trend-point-halo" />
                <circle cx={point.x} cy={point.y} r="4.5" className="trend-point-core" />
                <text x={point.x} y="130" className="trend-date-label" textAnchor="middle">{index >= orderedTrendRecords.length - 3 ? point.record.time : point.record.shortDate}</text>
              </g>
            ))}
          </svg>
          {chartPoints.map(point => (
            <button
              className="trend-point-button"
              type="button"
              style={{ left: `${point.x - 20}px`, top: `${point.y - 20}px` }}
              aria-label={`${point.record.date} ${point.record.time}，${point.record.score}分，${point.record.title}`}
              aria-pressed={point.record.id === activeId}
              onClick={() => setActiveId(point.record.id)}
              key={`${point.record.id}-control`}
            />
          ))}
        </div>
      </div>
      <p className="trend-caption"><Clock size={12} /> 同一天多次检测分别记录，点选可查看具体时刻与报告。</p>
    </section>
  );
}

function HistoryCard({ record, onOpen, isFirstRecord }: { record: SkinDetectionRecord; onOpen: () => void; isFirstRecord: boolean }) {
  return (
    <button
      className="history-report-card"
      type="button"
      onClick={onOpen}
      data-report-id={record.id}
      aria-label={`${record.time}，${record.score}分，${record.title}，查看完整报告`}
    >
      <span className="history-score-visual">
        <img src={record.photo} alt="" aria-hidden="true" loading="lazy" />
        <span className="history-card-shade" />
        <span className="history-score"><b>{record.score}</b><small>分</small></span>
      </span>
      <span className="history-card-content">
        <span className="history-card-topline">
          <span className="history-card-time"><Clock size={12} /> {record.time}</span>
          <span className={`history-delta ${record.delta < 0 ? "is-down" : ""}`}>{isFirstRecord ? "首次检测" : <>{record.delta > 0 ? `+${record.delta}` : record.delta} <small>较上次</small></>}</span>
        </span>
        <span className="history-copy"><strong>{record.title}</strong><span>{record.keywords.slice(0, 2).map(keyword => <i key={keyword}>{keyword}</i>)}</span></span>
        <span className="history-open">查看报告</span>
      </span>
    </button>
  );
}

function HistoryOverview({ onOpenReport, records: ownRecords, loading, error, onReload }: { onOpenReport: (record: SkinDetectionRecord) => void; records: SkinDetectionRecord[]; loading: boolean; error: string; onReload: () => void }) {
  const [showSample, setShowSample] = useState(false);
  const records = showSample ? detectionHistory : ownRecords.map((item, index) => ({ ...item, delta: ownRecords[index + 1] ? item.score - ownRecords[index + 1].score : 0 }));
  const groups = useMemo(() => {
    const result = new Map<string, SkinDetectionRecord[]>();
    records.forEach(record => result.set(record.date, [...(result.get(record.date) ?? []), record]));
    return [...result.entries()];
  }, [records]);

  return (
    <div className="skin-tab-content history-tab-content" role="tabpanel" id="skin-history-panel" aria-labelledby="skin-history-tab">
      <div className="order-mode-bar"><span>{showSample ? "肤况趋势样例 · 非个人检测" : "本次访客的报告记录 · 分析结果为演示"}</span><button type="button" onClick={()=>setShowSample(!showSample)}>{showSample ? "返回我的记录" : "查看趋势样例"}</button></div>
      {error && <p className="order-error" role="alert">{error}<button type="button" onClick={onReload}>重试</button></p>}
      {records.length > 0 ? <TrendChart key={showSample ? "sample" : "own"} records={records} onOpenReport={onOpenReport}/> : <div className="order-empty"><Sparkle size={34}/><h2>{loading ? "正在加载肤质记录" : "从第一次检测，认识自己的肌肤"}</h2><p>完成报告后自动记入这里。<br/>积累两次及以上记录，即可比较肤况变化。</p></div>}
      <section className="history-list-section" aria-labelledby="history-list-title">
        <header className="skin-section-heading history-list-heading">
          <div><small>REPORT ARCHIVE</small><h2 id="history-list-title">检测历史</h2></div>
          <span>{records.length} 份报告</span>
        </header>
        {groups.map(([date, records]) => (
          <div className="history-date-group" key={date}>
            <h3>{dateLabel(date)} <span>{records.length > 1 ? `· ${records.length} 次` : ""}</span></h3>
            <div>{records.map(record => <HistoryCard key={record.id} record={record} isFirstRecord={record.id === records.at(-1)?.id} onOpen={() => onOpenReport(record)} />)}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

type ProductCardActions = {
  product: CatalogProduct;
  onOpen: () => void;
  onBuy: () => void;
};

function originalPrice(product: CatalogProduct) {
  return product.price + 10 + ((Number(product.id.slice(-3)) || 1) % 4) * 5;
}

function OfferPrice({ product, compact = false }: { product: CatalogProduct; compact?: boolean }) {
  return <span className={compact ? "product-offer-price is-compact" : "product-offer-price"}>
    <span><b><small>¥</small>{product.price}</b><del>¥{originalPrice(product)}</del></span>
  </span>;
}

function ProductRail({ children, className, label, destination, onEnter }: {
  children: ReactNode;
  className: string;
  label: string;
  destination: string;
  onEnter: () => void;
}) {
  return <div className={`${className} care-product-rail`} role="region" aria-label={label} tabIndex={0}>
    {children}
    <button className="care-rail-tail" type="button" onClick={onEnter}>
      <span><ArrowRight size={21} /></span>
      <strong>查看{destination}</strong>
      <small>更多好物，继续探索</small>
    </button>
  </div>;
}

function PreviewProduct({ product, onOpen }: { product: CatalogProduct; onOpen: () => void }) {
  return <button className="care-preview-product" type="button" onClick={onOpen} aria-label={`查看${product.name}详情`}>
    <span className="care-preview-photo"><img src={product.image} alt={product.name} loading="lazy" /></span>
    <span className="care-preview-copy"><strong>{product.name}</strong><span>{product.subtitle}</span><OfferPrice product={product} compact /></span>
  </button>;
}

function PersonalizedCard({ product, onOpen, onBuy }: ProductCardActions) {
  return (
    <article className="personalized-product-card">
      <span className="personalized-product-image"><img src={product.image} alt={product.name} loading="lazy" /></span>
      <div className="personalized-product-copy">
        <span className="personalized-product-meta"><b>{product.ingredients}</b></span>
        <strong>{product.name}</strong>
        <span className="personalized-product-reason">{product.subtitle}</span>
        <div className="personalized-product-bottom">
          <OfferPrice product={product} compact />
          <span className="personalized-product-actions">
            <button className="product-action-detail" type="button" onClick={onOpen} aria-label={`查看${product.name}详情`}>查看详情</button>
            <button className="product-action-buy" type="button" onClick={onBuy} aria-label={`立即购买${product.name}`}>立即购买</button>
          </span>
        </div>
      </div>
    </article>
  );
}

function CatalogCard({ product, onOpen }: Pick<ProductCardActions, "product" | "onOpen">) {
  return (
    <button className="catalog-card" type="button" onClick={onOpen} aria-label={`查看${product.name}详情，¥${product.price}`}>
      <span className="catalog-image-wrap">
        <img src={product.image} alt={product.name} loading="lazy" />
      </span>
      <span className="catalog-card-copy">
        <strong>{product.name}</strong>
        <span className="catalog-card-subtitle">{product.subtitle}</span>
        <span className="catalog-card-bottom"><OfferPrice product={product} compact /><small className="catalog-card-size">{product.size}</small></span>
      </span>
    </button>
  );
}

function ProductDetail({ product, onClose, onPurchase }: { product: CatalogProduct; onClose: () => void; onPurchase: () => void }) {
  const [mode, setMode] = useState<"detail" | "support">("detail");
  const sheetRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(sheetRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="catalog-detail-layer" role="dialog" aria-modal="true" aria-label={mode === "support" ? "人工客服" : `${product.name}商品详情`}>
      <button className="catalog-detail-scrim" type="button" aria-label="关闭商品详情" onClick={onClose} />
      <article className={`catalog-detail-sheet ${mode === "support" ? "is-support" : ""}`} ref={sheetRef}>
        <button className="catalog-detail-close" type="button" aria-label="关闭商品详情" onClick={onClose} ref={closeRef}><X size={18} /></button>
        {mode === "support" ? <><header className="catalog-support-header"><button type="button" aria-label="返回商品详情" onClick={() => setMode("detail")}><ArrowLeft size={20} /></button><h2>人工客服</h2></header><CustomerSupport productName={product.name} /></> : <><div className="catalog-detail-visual"><img src={product.image} alt={product.name} /><span><ShieldCheck size={14} weight="fill" /> 图灵官方核验</span></div>
        <div className="catalog-detail-copy">
          <small>商品详情</small>
          <h2>{product.name}</h2>
          <p className="catalog-detail-concern">{product.category === "香水" ? "适用场景" : "针对问题"}：{product.concern}</p><p>{product.subtitle}</p>
          <div className="catalog-detail-tags">{product.concerns.map(tag => <span key={tag}>{tag}</span>)}</div>
          <dl><div><dt>核心成分</dt><dd>{product.ingredients}</dd></div><div><dt>建议步骤</dt><dd>{product.step}</dd></div><div><dt>体验规格</dt><dd>{product.size}</dd></div></dl>
          <div className="catalog-detail-price"><span>{product.size} · 包邮</span><span><b>¥{product.price}</b><del>¥{originalPrice(product)}</del></span></div>
          {mode === "detail" && <><section className="catalog-recommendation-reason"><h3>产品推荐理由</h3><p>{product.reason}</p></section><section className="catalog-recommendation-reason"><h3>配方与使用</h3><p>{product.usage}</p></section><ProductGuarantee onSupport={() => setMode("support")} /></>}
          <button className="catalog-detail-cta" type="button" onClick={onPurchase}><Bag size={17} weight="fill" />立即购买</button>
          <p className="catalog-detail-note">演示商品仅用于原型体验；正式商品信息、价格与可售状态以后端配置为准。</p>
        </div></>}
      </article>
    </div>
  );
}

function CarePlan({ onOpenProduct, onBuyProduct, initialView = "overview", onExitCatalog }: { onOpenProduct: (product: CatalogProduct) => void; onBuyProduct: (product: CatalogProduct) => void; initialView?: "overview" | "catalog"; onExitCatalog?: () => void }) {
  const [category, setCategory] = useState<CatalogFilter>("全部");
  const [view, setView] = useState<"overview" | "personalized" | "catalog">(initialView);
  const rootRef = useRef<HTMLDivElement>(null);
  const catalogSectionRef = useRef<HTMLElement>(null);
  const decorateProduct = (product: CatalogProduct): CatalogProduct => personalizedProductIds.includes(product.id)
    ? { ...product, badge: "本次适配" }
    : product;
  const personalized = personalizedRecommendations.flatMap(recommendation => {
    const product = catalogProducts.find(item => item.id === recommendation.productId);
    return product ? [{ product: decorateProduct(product), recommendation }] : [];
  });
  const popularProductIds = ["demo-sku-009", "demo-sku-001", "demo-sku-025", "demo-sku-041"];
  const popular = popularProductIds.flatMap(productId => {
    const product = catalogProducts.find(item => item.id === productId);
    return product ? [decorateProduct(product)] : [];
  });
  const filtered = (category === "全部" ? catalogProducts : catalogProducts.filter(product => product.category === category)).map(decorateProduct);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      rootRef.current?.closest<HTMLElement>(".skin-management-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view]);

  const openView = (nextView: "personalized" | "catalog") => setView(nextView);
  const resetCatalogScroll = () => {
    const section = catalogSectionRef.current;
    const scroller = section?.closest<HTMLElement>(".skin-management-scroll");
    if (!section || !scroller) return;
    const targetTop = scroller.scrollTop + section.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTo({ top: Math.max(0, targetTop - 4), behavior: "smooth" });
  };

  return (
    <div className={`skin-tab-content plan-tab-content is-${view}`} role="tabpanel" id="skin-plan-panel" aria-labelledby="skin-plan-tab" ref={rootRef}>
      {view === "overview" && (
        <div className="care-plan-home">
          <section className="skin-panel care-preview-section care-preview-personalized" aria-labelledby="care-preview-personalized-title">
            <header className="care-preview-heading">
              <div><span className="care-preview-mark"><Sparkle size={13} weight="fill" /></span><h2 id="care-preview-personalized-title">更适合你的护理</h2></div>
              <span className="care-preview-index" aria-hidden="true">01</span>
            </header>
            <ProductRail
              className="personalized-list personalized-preview-list"
              label="更适合你的护理，可横向滑动，滑到末尾点击查看全部护理"
              destination="全部护理"
              onEnter={() => openView("personalized")}
            >
              {personalized.slice(0, 3).map(({ product }) => <PreviewProduct product={product} onOpen={() => onOpenProduct(product)} key={product.id} />)}
            </ProductRail>
          </section>

          <section className="skin-panel care-preview-section care-preview-popular" aria-labelledby="care-preview-popular-title">
            <header className="care-preview-heading">
              <div><span className="care-preview-mark is-popular"><Lightning size={13} weight="fill" /></span><h2 id="care-preview-popular-title">大家最近都在选</h2></div>
              <span className="care-preview-index" aria-hidden="true">02</span>
            </header>
            <ProductRail
              className="popular-preview-list"
              label="热门产品预览，可横向滑动，滑到末尾点击查看全部商品"
              destination="全部商品"
              onEnter={() => openView("catalog")}
            >
              {popular.map(product => <PreviewProduct product={product} onOpen={() => onOpenProduct(product)} key={product.id} />)}
            </ProductRail>
          </section>
        </div>
      )}

      {view === "personalized" && (
        <section className="skin-panel personalized-section" aria-labelledby="personalized-title">
          <button className="plan-subview-back" type="button" onClick={() => setView("overview")}><ArrowLeft size={14} /> 返回护理方案</button>
          <header className="skin-section-heading">
            <div><h2 id="personalized-title">更适合你的护理</h2></div>
            <span className="personalized-fresh"><Lightning size={12} weight="fill" /> 已更新</span>
          </header>
          <div className="personalized-list">{personalized.map(({ product }) => <PersonalizedCard product={product} onOpen={() => onOpenProduct(product)} onBuy={() => onBuyProduct(product)} key={product.id} />)}</div>
        </section>
      )}

      {view === "catalog" && (
        <section className="catalog-section" aria-labelledby="catalog-title" ref={catalogSectionRef}>
          <button className="plan-subview-back" type="button" onClick={() => onExitCatalog ? onExitCatalog() : setView("overview")}><ArrowLeft size={14} /> {onExitCatalog ? "返回检测报告" : "返回护理方案"}</button>
          <header className="skin-section-heading catalog-heading">
            <div><h2 id="catalog-title">全部护理好物</h2></div>
            <span>{catalogProducts.length} 款演示商品</span>
          </header>
          <nav className="catalog-tabs" aria-label="商品品类">
            {catalogCategories.map(item => <button type="button" className={category === item ? "is-active" : ""} aria-pressed={category === item} onClick={() => { setCategory(item); resetCatalogScroll(); }} key={item}>{item}</button>)}
          </nav>
          <p className="visually-hidden" aria-live="polite">{category}品类，共 {filtered.length} 款演示商品</p>
          <div className="catalog-grid">{filtered.map(product => <CatalogCard key={product.id} product={product} onOpen={() => onOpenProduct(product)} />)}</div>
        </section>
      )}
    </div>
  );
}

function HistoryReport({ record, onBack }: { record: SkinDetectionRecord; onBack: () => void }) {
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => backRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, []);
  const focusMetrics = [
    { label: "肌肤光泽", value: record.metrics.shine, tone: record.metrics.shine >= 80 ? "good" : "watch" },
    { label: "毛孔洁净", value: record.metrics.pores, tone: record.metrics.pores >= 80 ? "good" : "watch" },
    { label: "屏障稳定", value: record.metrics.barrier, tone: record.metrics.barrier >= 75 ? "good" : "watch" },
    { label: "眼周状态", value: record.metrics.eye, tone: record.metrics.eye >= 75 ? "good" : "watch" },
  ];
  return (
    <div className="history-report-view">
      <header className="skin-management-header report-snapshot-header">
        <button type="button" aria-label="返回检测历史" onClick={onBack} ref={backRef}><ArrowLeft size={19} /></button>
        <div><small>REPORT SNAPSHOT</small><strong>历史检测报告</strong></div>
        <span>{record.shortDate}</span>
      </header>
      <div className="history-report-scroll">
        <section className="history-report-hero">
          <div className="history-report-photo"><img src={record.photo} alt="示例人像的隐私模糊预览，不是用户上传照片" /><span>示例照片 · 隐私模糊</span></div>
          <div className="history-report-score"><small>{record.date} · {record.time}</small><div><strong>{record.score}</strong><span>/100</span></div><h1>{record.title}</h1><p>{record.keywords.join(" · ")}</p></div>
        </section>
        <section className="history-report-card focus-report-card">
          <header><span><Sparkle size={14} weight="fill" /> 关键表现</span><small>当次报告快照</small></header>
          <div>{focusMetrics.map(metric => <p key={metric.label} className={metric.tone}><span>{metric.label}</span><i><b style={{ width: `${metric.value}%` }} /></i><strong>{metric.value}</strong></p>)}</div>
        </section>
        <div className="history-result-grid">
          <section className="history-report-card tone-snapshot"><header><span>肤色结果</span><small>CHROMA</small></header><i style={{ background: record.toneColor, boxShadow: `0 0 18px ${record.toneColor}42` }}/><strong>{record.tone}</strong><p>底妆可优先从相近暖调色阶开始试色。</p></section>
          <section className="history-report-card oil-snapshot"><header><span>油光结果</span><small>SEBUM</small></header><Drop size={28} weight="duotone"/><strong>{record.oil}</strong><p>建议按部位调整清洁与保湿强度。</p></section>
        </div>
        <section className="history-report-card advice-snapshot"><header><span>护理建议</span><small>DAILY CARE</small></header><p>{record.advice}</p><div><span>01 温和清洁</span><span>02 修护补水</span><span>03 日间防晒</span></div></section>
        <p className="history-report-disclaimer">历史报告保留当次检测结果，不随后续检测与推荐规则更新。</p>
      </div>
    </div>
  );
}

export function SkinManagement({ onBack, onStartTest, onOpenMenu, inactive = false, initialView = "history", records, recordsLoading, recordsError, onReloadRecords, onPurchase }: SkinManagementProps) {
  const [tab, setTab] = useState<"history" | "plan">(initialView === "catalog" ? "plan" : "history");
  const [selectedRecord, setSelectedRecord] = useState<SkinDetectionRecord | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const managementScrollRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const historyScrollTopRef = useRef(0);
  const historyTriggerIdRef = useRef<string | null>(null);
  const productDetailOpen = Boolean(selectedProduct);

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => initialFocusRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, []);

  useEffect(() => {
    managementScrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  useEffect(() => {
    if (selectedRecord || !historyTriggerIdRef.current) return;
    const focusFrame = window.requestAnimationFrame(() => {
      managementScrollRef.current?.scrollTo({ top: historyScrollTopRef.current });
      managementScrollRef.current?.querySelector<HTMLElement>(`[data-report-id="${historyTriggerIdRef.current}"]`)?.focus();
      historyTriggerIdRef.current = null;
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [selectedRecord]);

  const openHistoryReport = (record: SkinDetectionRecord) => {
    historyScrollTopRef.current = managementScrollRef.current?.scrollTop ?? 0;
    historyTriggerIdRef.current = record.id;
    setSelectedRecord(record);
  };

  const openProductDetail = (product: CatalogProduct) => {
    setSelectedProduct(product);
  };

  const openProductPurchase = (product: CatalogProduct) => {
    setSelectedProduct(null);
    onPurchase(product);
  };

  if (selectedRecord) return <HistoryReport record={selectedRecord} onBack={() => setSelectedRecord(null)} />;

  return (
    <section className="skin-management-view" aria-label="皮肤管理" inert={inactive ? true : undefined} aria-hidden={inactive}>
      <header className="skin-management-header" inert={productDetailOpen ? true : undefined} aria-hidden={productDetailOpen}>
        <button type="button" aria-label="返回对话" onClick={onBack} ref={initialFocusRef}><ArrowLeft size={19} /></button>
        <div><small>SKIN INTELLIGENCE</small><strong>皮肤管理</strong></div>
        <button className="skin-header-scan" type="button" aria-label="打开功能导航" onClick={onOpenMenu}><List size={20} weight="bold" /></button>
      </header>
      <div className="skin-tab-switcher" role="tablist" aria-label="皮肤管理内容" inert={productDetailOpen ? true : undefined} aria-hidden={productDetailOpen}>
        <button id="skin-history-tab" className={tab === "history" ? "is-active" : ""} role="tab" aria-selected={tab === "history"} aria-controls="skin-history-panel" tabIndex={tab === "history" ? 0 : -1} type="button" onClick={() => setTab("history")} onKeyDown={event => { if (event.key === "ArrowRight") setTab("plan"); }}>皮肤检测历史</button>
        <button id="skin-plan-tab" className={tab === "plan" ? "is-active" : ""} role="tab" aria-selected={tab === "plan"} aria-controls="skin-plan-panel" tabIndex={tab === "plan" ? 0 : -1} type="button" onClick={() => setTab("plan")} onKeyDown={event => { if (event.key === "ArrowLeft") setTab("history"); }}>皮肤管理方案</button>
      </div>
      <div className={`skin-management-scroll ${tab === "plan" ? "is-plan" : ""}`} ref={managementScrollRef} inert={productDetailOpen ? true : undefined} aria-hidden={productDetailOpen}>{tab === "history" ? <HistoryOverview onOpenReport={openHistoryReport} records={records} loading={recordsLoading} error={recordsError} onReload={onReloadRecords}/> : <CarePlan onOpenProduct={openProductDetail} onBuyProduct={openProductPurchase} initialView={initialView === "catalog" ? "catalog" : "overview"} onExitCatalog={initialView === "catalog" ? onBack : undefined} />}</div>
      <div className="skin-management-cta-wrap" inert={productDetailOpen ? true : undefined} aria-hidden={productDetailOpen}>
        <button className="skin-management-cta" type="button" onClick={onStartTest}><Sparkle size={15} weight="fill" /><b>去测今日肤质</b><ArrowRight size={14} /></button>
      </div>
      {selectedProduct && <ProductDetail product={selectedProduct} onPurchase={()=>openProductPurchase(selectedProduct)} onClose={() => setSelectedProduct(null)} />}
    </section>
  );
}
