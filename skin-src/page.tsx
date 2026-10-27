"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ShieldCheck } from "@phosphor-icons/react";
import { OrderCenter, OrderCheckout, PaymentSuccess, ReportSavedEntry } from "./order-center";
import { useExperience } from "./use-experience";
import type { OrderProduct, ShopOrder, ShippingAddress } from "./order-model";
import { AppSidebar } from "./app-sidebar";
import { SkinManagement } from "./skin-management";
import { catalogProducts } from "./skin-data";
import { CustomerSupport, ProductGuarantee, PRODUCT_SAMPLE_IMAGE } from "./product-experience";

type FlowState = "idle" | "checking" | "scanning" | "report" | "error";
type AppView = "chat" | "skin" | "orders" | "payment";

const metrics = [
  { name: "细纹", score: 5.1, region: "眼周", advice: "补水打底，夜间循序加入胜肽或低浓度视黄醇。" },
  { name: "泛红", score: 5.6, region: "双颊", advice: "减少刺激性叠加，优先修护屏障并做好防晒。" },
  { name: "眼袋", score: 6.2, region: "眼下", advice: "规律作息，搭配咖啡因类眼部产品轻柔按摩。" },
  { name: "鱼尾纹", score: 6.8, region: "外眼角", advice: "加强眼周保湿，避免拉扯并坚持防晒。" },
  { name: "皮肤松弛", score: 7.2, region: "下颌", advice: "保持防晒与抗氧化护理，配合温和按摩。" },
  { name: "皱纹", score: 7.4, region: "额头", advice: "维持保湿，逐步建立温和抗老护理节奏。" },
  { name: "痘痘", score: 7.8, region: "下巴", advice: "避免频繁触碰，局部使用水杨酸并观察耐受。" },
  { name: "肤色不均匀", score: 8.1, region: "全脸", advice: "坚持防晒，可搭配烟酰胺或VC衍生物。" },
  { name: "毛孔可见度", score: 8.7, region: "鼻翼", advice: "温和清洁与补水并重，避免过度去角质。" },
  { name: "黑头", score: 8.9, region: "鼻部", advice: "维持当前清洁频率，每周温和疏通一次即可。" },
  { name: "肌肤光泽度", score: 9.1, region: "双颊", advice: "光泽状态优秀，继续保持保湿与规律作息。" },
];

type ScoreLevel = "high" | "mid" | "low";

const scoreLevelColors: Record<ScoreLevel, string> = {
  high: "#63d9ff",
  mid: "#a99cff",
  low: "#ffb86b",
};

const sortedMetricScores = metrics.map(item => item.score).sort((a, b) => a - b);
const lowScoreCutoff = sortedMetricScores[Math.min(2, sortedMetricScores.length - 1)];
const highScoreCutoff = sortedMetricScores[Math.max(0, sortedMetricScores.length - 3)];
const getScoreLevel = (score: number): ScoreLevel => score >= highScoreCutoff ? "high" : score <= lowScoreCutoff ? "low" : "mid";
const radarDisplayName = (name: string) => ({ "肤色不均匀": "肤色不均", "毛孔可见度": "毛孔可见", "肌肤光泽度": "肌肤光泽" }[name] ?? name);
const advantageDisplayName = (name: string) => ({ "肌肤光泽度": "光泽度", "黑头": "鼻部洁净", "毛孔可见度": "毛孔细腻" }[name] ?? name);
const topMetrics = [...metrics].sort((a, b) => b.score - a.score).slice(0, 3);
const OIL_FACE_ASSET = "/skin-oil-face-map-v5.png";
const VERIFICATION_CREST_ASSET = "/turing-verification-crest.png";
const COMMERCE_AUTOPLAY_MS = 5000;
const COMMERCE_MANUAL_HOLD_MS = 8000;

type SkinTone = {
  id: string;
  label: string;
  color: string;
};

const toneRows = [
  { group: "基础肤色", family: "一白", tones: [{ id: "pink-1", label: "粉一白", color: "#efd9d2" }, { id: "yellow-1", label: "黄一白", color: "#f3d8b6" }, { id: "neutral-1", label: "中一白", color: "#efd0bd" }, { id: "olive-1", label: "橄榄一白", color: "#efe7cf" }] },
  { group: "基础肤色", family: "二白", tones: [{ id: "pink-2", label: "粉二白", color: "#e6c1bb" }, { id: "yellow-2", label: "黄二白", color: "#edc79a" }, { id: "neutral-2", label: "中二白", color: "#e6b9a6" }, { id: "olive-2", label: "橄榄二白", color: "#e0d4b0" }] },
  { group: "基础肤色", family: "三白", tones: [{ id: "pink-3", label: "粉三白", color: "#d3a495" }, { id: "yellow-3", label: "黄三白", color: "#e4b071" }, { id: "neutral-3", label: "中三白", color: "#d59f86" }, { id: "olive-3", label: "橄榄三白", color: "#c8b37d" }] },
  { group: "偏红底调", family: "冷暖", tones: [{ id: "red-cool-1", label: "偏红冷一白", color: "#e7d7cf" }, { id: "red-cool-2", label: "偏红冷二白", color: "#ded0bb" }, { id: "red-warm-1", label: "偏红暖一白", color: "#e3bda8" }, { id: "red-warm-2", label: "偏红暖二白", color: "#c7a78b" }] },
  { group: "中性底调", family: "冷暖", tones: [{ id: "neutral-cool-1", label: "中性冷一白", color: "#e4ded2" }, { id: "neutral-cool-2", label: "中性冷二白", color: "#cdb4a2" }, { id: "neutral-warm-1", label: "中性暖一白", color: "#e6d7ab" }, { id: "neutral-warm-2", label: "中性暖二白", color: "#d7b897" }] },
  { group: "偏绿底调", family: "冷暖", tones: [{ id: "green-cool-1", label: "偏绿冷一白", color: "#e7d9c7" }, { id: "green-cool-2", label: "偏绿冷二白", color: "#d8bda8" }, { id: "green-warm-1", label: "偏绿暖一白", color: "#d8d0ad" }, { id: "green-warm-2", label: "偏绿暖二白", color: "#c5b894" }] },
] as const;
const selectedToneId = "yellow-2";
const tonePalette = toneRows.reduce<SkinTone[]>((tones, row) => [...tones, ...row.tones], []);
const selectedTone = tonePalette.find(tone => tone.id === selectedToneId) ?? toneRows[0].tones[1];

type ProductId = "ceramide" | "caffeine" | "niacinamide" | "peptide";

type CommerceProduct = {
  id: ProductId;
  ingredient: string;
  concern: string;
  name: string;
  size: string;
  price: number;
  match: number;
  image: string;
  benefit: string;
  reason: string;
  usage: string;
  highlights: string[];
};


const commerceProducts: CommerceProduct[] = [
  {
    id: "ceramide",
    ingredient: "神经酰胺",
    concern: "泛红 · 屏障波动",
    name: "神经酰胺屏障修护面霜",
    size: "15g 体验装",
    price: 59,
    match: 97,
    image: PRODUCT_SAMPLE_IMAGE,
    benefit: "补充肌肤所需脂质，改善干燥紧绷观感。",
    reason: "双颊泛红评分偏低，当前更适合先做温和修护，再叠加其他功效。",
    usage: "晚间洁面和精华后，取适量均匀涂于面部与颈部，轻柔按压至贴合；双颊干燥处可少量叠加，首次使用先做局部试用。",
    highlights: ["神经酰胺复配", "轻盈不厚重", "优先修护步骤"],
  },
  {
    id: "caffeine",
    ingredient: "咖啡因",
    concern: "眼袋 · 眼周疲态",
    name: "咖啡因焕活眼部精华",
    size: "10ml 体验装",
    price: 69,
    match: 94,
    image: PRODUCT_SAMPLE_IMAGE,
    benefit: "润泽细腻眼周，帮助改善浮肿与倦态观感。",
    reason: "眼袋与细纹是本次优先关注项，轻薄眼部精华更便于循序使用。",
    usage: "早晚洁面后取少量点于眼周，用无名指沿眼眶轻轻按压至吸收，避免拉扯与入眼；妆前使用待充分贴合后再上妆。",
    highlights: ["咖啡因精粹", "眼周轻薄质地", "早晚均可使用"],
  },
  {
    id: "niacinamide",
    ingredient: "烟酰胺",
    concern: "肤色不均 · 暗沉",
    name: "低浓度烟酰胺焕亮精华",
    size: "15ml 体验装",
    price: 79,
    match: 91,
    image: PRODUCT_SAMPLE_IMAGE,
    benefit: "帮助改善肤色不均，让肌肤更显匀净通透。",
    reason: "肤色整体有光泽但均匀度仍有提升空间，低浓度版本更适合作为温和进阶。",
    usage: "晚间洁面后取少量均匀涂于面部，避开眼周，再搭配保湿面霜；建议先每周使用两至三次，根据肌肤感受逐渐调整频率。",
    highlights: ["低浓度烟酰胺", "温和焕亮", "循序建立耐受"],
  },
  {
    id: "peptide",
    ingredient: "胜肽",
    concern: "细纹干纹 · 松弛感",
    name: "多肽弹润紧致精华",
    size: "15ml 体验装",
    price: 89,
    match: 89,
    image: PRODUCT_SAMPLE_IMAGE,
    benefit: "补水弹润肌肤，帮助改善干纹与松弛观感。",
    reason: "细纹是本次最低分项，建议在屏障稳定后作为第二阶段的温和抗老选择。",
    usage: "肌肤状态稳定后于晚间洁面后使用，取两至三滴轻按面部与颈部，再搭配面霜锁水；初次使用先局部试用，避免多种功效叠加。",
    highlights: ["多肽复配", "弹润保湿", "第二阶段进阶"],
  },
];

const getCommerceProduct = (id: ProductId) => commerceProducts.find(product => product.id === id) ?? commerceProducts[0];

const commercePromotions: Record<ProductId, { label: string; originalPrice: number }> = {
  ceramide: { label: "新人尝鲜", originalPrice: 79 },
  caffeine: { label: "今日热卖", originalPrice: 89 },
  niacinamide: { label: "限时特惠", originalPrice: 109 },
  peptide: { label: "会员专享", originalPrice: 119 },
};

const callouts = [
  { label: "皱纹", score: "7.4", pointX: "50%", pointY: "22%", elbowX: "30%", elbowY: "7%", diagonal: "93px", angle: "-142deg", side: "left" },
  { label: "细纹", score: "5.1", pointX: "44%", pointY: "42%", elbowX: "30%", elbowY: "21%", diagonal: "95px", angle: "-123deg", side: "left" },
  { label: "眼袋", score: "6.2", pointX: "45%", pointY: "48%", elbowX: "30%", elbowY: "35%", diagonal: "74px", angle: "-138deg", side: "left" },
  { label: "黑头", score: "8.9", pointX: "50%", pointY: "54%", elbowX: "30%", elbowY: "49%", diagonal: "76px", angle: "-166deg", side: "left" },
  { label: "肤色不均", score: "8.1", pointX: "43%", pointY: "59%", elbowX: "30%", elbowY: "63%", diagonal: "50px", angle: "162deg", side: "left" },
  { label: "痘痘", score: "7.8", pointX: "51%", pointY: "74%", elbowX: "30%", elbowY: "77%", diagonal: "78px", angle: "172deg", side: "left" },
  { label: "松弛", score: "7.2", pointX: "61%", pointY: "70%", elbowX: "70%", elbowY: "73%", diagonal: "35px", angle: "19deg", side: "right" },
  { label: "光泽度", score: "9.1", pointX: "58%", pointY: "62%", elbowX: "70%", elbowY: "87%", diagonal: "105px", angle: "65deg", side: "right" },
  { label: "泛红", score: "5.6", pointX: "63%", pointY: "58%", elbowX: "70%", elbowY: "59%", diagonal: "26px", angle: "8deg", side: "right" },
  { label: "毛孔", score: "8.7", pointX: "55%", pointY: "52%", elbowX: "70%", elbowY: "45%", diagonal: "61px", angle: "-26deg", side: "right" },
  { label: "鱼尾纹", score: "6.8", pointX: "61%", pointY: "41%", elbowX: "70%", elbowY: "31%", diagonal: "50px", angle: "-49deg", side: "right" },
];

const LANDMARK_STEP_SECONDS = .16;
const LANDMARK_SEQUENCE_MS = 1820;

function Reveal({ children, className = "", delay = 0, ariaHidden = false }: { children: React.ReactNode; className?: string; delay?: number; ariaHidden?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: .12, rootMargin: "0px 0px -24px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${visible ? "is-visible" : ""} ${className}`} style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties} aria-hidden={ariaHidden || undefined}>{children}</div>;
}

function RadarChart({ size = 270 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    const cx = size / 2, cy = size / 2, radius = size * (size < 200 ? .29 : .32);
    const values = metrics.map(item => item.score);
    const labels = metrics.map(item => radarDisplayName(item.name));
    const points = (r: number) => values.map((_, i) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / values.length;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
    });
    const polygon = (pts: readonly (readonly [number, number])[]) => {
      ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    };
    for (let step = 1; step <= 5; step++) {
      polygon(points(radius * step / 5));
      ctx.strokeStyle = step === 5 ? "rgba(151,132,255,.4)" : "rgba(151,132,255,.13)";
      ctx.lineWidth = 1; ctx.stroke();
    }
    points(radius).forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.strokeStyle = "rgba(151,132,255,.12)"; ctx.stroke(); });
    const valuePts = values.map((v, i) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / values.length;
      return [cx + Math.cos(a) * radius * v / 10, cy + Math.sin(a) * radius * v / 10] as const;
    });
    const grad = ctx.createLinearGradient(0, 0, size, size); grad.addColorStop(0, "rgba(169,156,255,.44)"); grad.addColorStop(.55, "rgba(92,111,255,.48)"); grad.addColorStop(1, "rgba(66,201,255,.34)");
    polygon(valuePts); ctx.fillStyle = grad; ctx.fill(); ctx.strokeStyle = "#9382ff"; ctx.lineWidth = 2; ctx.stroke();
    valuePts.forEach(([x,y], i) => {
      const color = scoreLevelColors[getScoreLevel(values[i])];
      ctx.beginPath(); ctx.arc(x,y,size < 200 ? 2.2 : 3.5,0,Math.PI*2);ctx.fillStyle=color;ctx.shadowBlur=10;ctx.shadowColor=color;ctx.fill();
    });
    ctx.shadowBlur = 0; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    points(radius + size * (size < 200 ? .14 : .125)).forEach(([x,y],i)=>{
      const nameFont = `${size < 200 ? 5.4 : 7.2}px system-ui`;
      const scoreFont = `700 ${size < 200 ? 6.2 : 8.2}px system-ui`;
      ctx.font = nameFont;
      const halfWidth = Math.max(ctx.measureText(labels[i]).width / 2, 9);
      const safeX = Math.min(size - halfWidth - 3, Math.max(halfWidth + 3, x));
      const safeY = Math.min(size - 12, Math.max(12, y));
      ctx.fillStyle = "#a7adc8";
      ctx.fillText(labels[i], safeX, safeY - (size < 200 ? 3.2 : 4.2));
      ctx.font = scoreFont;
      ctx.fillStyle = scoreLevelColors[getScoreLevel(values[i])];
      ctx.fillText(values[i].toFixed(1), safeX, safeY + (size < 200 ? 3.7 : 5.2));
    });
  }, [size]);
  return <canvas ref={canvasRef} aria-label="11维肌肤雷达图" />;
}

function FaceVisual({ photoUrl, scanning = false, annotated = false }: { photoUrl: string; scanning?: boolean; annotated?: boolean }) {
  return (
    <div className={`face-visual ${scanning ? "is-scanning" : ""} ${annotated ? "is-annotated" : ""}`}>
      <img src={photoUrl} alt="用户上传的正脸照片，隐私模糊显示" />
      <div className="privacy-mesh" />
      <div className="face-oval" />
      {Array.from({ length: 18 }).map((_, i) => <i className="landmark" key={i} style={{ "--i": i } as React.CSSProperties} />)}
      {scanning && <><div className="scan-frame"><i/><i/><i/><i/></div><div className="scan-beam"><b/><span/></div><div className="scan-readout"><span>DEPTH MAP</span><b>LIVE</b></div><div className="scan-coordinates">X 024.8&nbsp;&nbsp;Y 118.2<br/>SKIN MATRIX / 68 PTS</div><div className="micro-particles">· ✦ · · ✧ · · ✦</div></>}
      {annotated && <div className="callout-layer">{callouts.map((item, i) => (
        <div className={`callout ${item.side}`} key={`${item.side}-${item.label}`} style={{ "--point-x": item.pointX, "--point-y": item.pointY, "--elbow-x": item.elbowX, "--elbow-y": item.elbowY, "--diagonal": item.diagonal, "--angle": item.angle, "--sequence-delay": `${i * LANDMARK_STEP_SECONDS}s` } as React.CSSProperties}>
          <b /><i className="leader-diagonal"/><s className="leader-rail"/><span><u className={Number(item.score) < 6.5 ? "watch" : "good"}/><strong>{item.label}</strong><em>{item.score}</em></span>
        </div>
      ))}</div>}
      <span className="privacy-tag">◈ 隐私保护已开启</span>
    </div>
  );
}

function MetricCard({ item, rank, variant = "row", ariaHidden = false }: { item: typeof metrics[number]; rank?: number; variant?: "row" | "highlight"; ariaHidden?: boolean }) {
  const tone = item.score < 6.5 ? "low" : item.score >= 8.5 ? "high" : "mid";
  return (
    <Reveal className={`metric-reveal ${tone} ${variant}`} delay={(rank ?? 1) * 90} ariaHidden={ariaHidden}><article className={`metric-card ${tone} ${variant}`}>
      <div className="metric-head">
        <div className="metric-icon"><span>{rank ? String(rank).padStart(2,"0") : "✦"}</span></div>
        <div><small>{item.region} · 状态评分</small><h4>{item.name}</h4></div>
        <strong>{item.score.toFixed(1)}</strong>
      </div>
      <div className="score-track"><i style={{ "--target": `${item.score * 10}%` } as React.CSSProperties} /></div>
      <div className="metric-advice"><span>护理建议</span><p>{item.advice}</p></div>
    </article></Reveal>
  );
}

function IngredientCommerceBridge({ onJumpProduct, commerceReady }: { onJumpProduct: (id: ProductId) => void; commerceReady: boolean }) {
  return <section className="ingredient-commerce-bridge" aria-labelledby="ingredient-match-title">
    <header>
      <div><small>基于本次检测</small><h3 id="ingredient-match-title">你的肌肤护理配方</h3><p>4 类成分，按肤况优先级匹配</p></div>
    </header>
    <div className="ingredient-match-list">{commerceProducts.map((product, index) => <button className={`ingredient-match-item stage-${index+1}`} type="button" disabled={!commerceReady} onClick={() => onJumpProduct(product.id)} aria-label={commerceReady ? `查看${product.ingredient}对应产品，针对${product.concern}` : `${product.name}将在报告完成后开放`} key={product.id}>
      <span className="ingredient-match-topline"><b className="ingredient-step">STEP{index + 1}</b></span>
      <span className="ingredient-match-copy"><span className="ingredient-match-title"><b>{product.ingredient}</b><em>{product.concern}</em></span><span className="ingredient-match-benefit">{product.benefit}</span></span>
      <span className="ingredient-match-action">{commerceReady ? "查看匹配产品" : "生成中"}<span aria-hidden="true">↗</span></span>
    </button>)}</div>
    <p className="ingredient-commerce-note">先从最需要的一款开始。首次使用请局部试用；敏感肌、孕期或有明确过敏史者，请先咨询专业人士。</p>
  </section>;
}

function Overview({ onJumpProduct, commerceReady, step }: { onJumpProduct: (id: ProductId) => void; commerceReady: boolean; step: number }) {
  return <div className="tab-panel overview-panel">
    <div className="score-hero">
      <div className="orbit"><div className="score-ring"><small>综合肤质分</small><strong>76</strong><em>/100</em></div></div>
      <div className="score-copy"><span className="title-kicker">✦ 今日肤况印象</span><h2>清透微光肌</h2><p>整体清透有光，眼周与屏障需要一点温柔修护。</p></div>
    </div>
    <div className="skin-dashboard">
      <article className="insight-card type-card"><header><span>01</span><div><small>肤质类型</small><b>肌肤倾向仪表</b></div><i>◒</i></header><div className="skin-type-gauge" aria-label="肤质类型：混合偏干，偏干倾向 68%"><div className="gauge-arc"><i/></div><div className="gauge-copy"><small>肤质倾向</small><strong>混合偏干</strong><em>DRY LEAN · 68%</em></div><div className="gauge-ends"><span>水油平衡</span><span>偏干倾向</span></div></div><p>T 区平衡 · 双颊水分略低</p></article>
      <article className="insight-card status-card"><header><span>02</span><div><small>状态关键词</small><b>此刻的肌肤状态</b></div><i>⌁</i></header><div className="keyword-cloud"><b>轻敏</b><span>缺水</span><em>易泛红</em><small>眼周疲态</small><i>屏障波动</i><u>需休息</u></div></article>
      <article className="insight-card advantage-card"><header><span>03</span><div><small>肌肤优势</small><b>优势一目了然</b></div><i>✦</i></header><div className="advantage-list" aria-label="本次检测得分最高的三项">{topMetrics.map(item=><p key={item.name}><span>{advantageDisplayName(item.name)}</span><i><u style={{width:`${item.score*10}%`}}/></i><strong>{item.score.toFixed(1)}</strong></p>)}</div></article>
      <article className="insight-card radar-card"><header><span>04</span><div><small>全维表现</small><b>11 维雷达图</b></div><i>◇</i></header><div className="overview-radar"><RadarChart size={150}/></div></article>
      {step>=3&&<SkinToneModule/>}
      {step>=4&&<OilBalanceModule/>}
    </div>
    {step>=4&&<><div className="summary-box"><span>AI 总体结论</span><p>整体肤况处于良好区间，毛孔洁净度与肌肤光泽表现突出。当前应优先关注细纹、泛红和眼袋，建议减少功效型产品叠加，用 2–4 周建立“修护屏障—温和抗老—规律防晒”的护理节奏。</p></div>
    <IngredientCommerceBridge onJumpProduct={onJumpProduct} commerceReady={commerceReady}/></>}
  </div>;
}

function BuildIndicator({ label, index }: { label: string; index: number }) {
  return <div className="build-indicator"><div className="build-core"><i/><span><small>AI REPORT ENGINE · 0{index}</small><b>{label}</b></span><em>生成中</em></div><div className="build-scan"><i/><i/><i/></div></div>;
}

function SkinToneModule() {
  return <article className="insight-card overview-wide-card tone-module">
    <header><span>05</span><div><small>肤色定位</small><b>肤色光谱</b></div><i>◇</i></header>
    <div className="tone-result-panel">
      <div><small>本次检测定位</small><strong>暖黄调 · 黄二白</strong><p>自然明度、轻暖黄底调；底妆可优先试暖黄调二白色阶。</p></div>
      <span className="tone-confidence"><b>87%</b><small>匹配置信度</small></span>
    </div>
    <div className="tone-matrix-board">
      <div className="tone-matrix-head"><span>24 色肤色参照</span><em>明度 × 底调双重定位</em></div>
      <div className="tone-matrix" role="grid" aria-label="24级肤色对照矩阵，当前定位黄二白" aria-rowcount={6} aria-colcount={4}>{toneRows.map((row,rowIndex)=><div className={`tone-matrix-row ${rowIndex===3 ? "starts-subtone" : ""}`} role="row" key={`${row.group}-${row.family}`} aria-label={`${row.group} ${row.family}`}>{row.tones.map(tone=><span className={`tone-cell ${tone.id===selectedToneId ? "is-selected" : ""}`} role="gridcell" aria-selected={tone.id===selectedToneId} aria-label={tone.label} title={tone.label} key={tone.id}><i style={{background:tone.color}}/><small>{tone.label}</small>{tone.id===selectedToneId&&<b aria-hidden="true">✓ 当前</b>}</span>)}</div>)}</div>
    </div>
    <div className="tone-quality-row"><span><i/>光线校正完成</span><span>有效面部采样 68 点</span><span>相邻参考：中性暖二白</span></div>
  </article>;
}

const oilZones = [
  { id: "forehead", label: "前额", value: 48, status: "平衡" },
  { id: "tzone", label: "鼻部 T 区", value: 78, status: "偏油" },
  { id: "cheeks", label: "双颊", value: 32, status: "平衡" },
  { id: "chin", label: "下巴", value: 55, status: "平衡" },
] as const;

const getOilLevel = (value: number) => value <= 30 ? "dry" : value <= 70 ? "balanced" : "oily";
const getOilZoneValue = (id: typeof oilZones[number]["id"]) => oilZones.find(zone => zone.id === id)?.value ?? 0;

function OilBalanceModule() {
  return <article className="insight-card overview-wide-card oil-module">
    <header><span>06</span><div><small>分区检测</small><b>分区油光地图</b></div><i>⌁</i></header>
    <p className="oil-module-intro">油脂指数表示当前出油强度：31–70 为平衡区间，数值越高越偏油。</p>
    <div className="oil-compact-card">
      <div className="oil-face-compact"><div className="oil-face-canvas">
        <img src={OIL_FACE_ASSET} alt="线性正面人脸示意，以贴合面部轮廓的色块标示前额、鼻部T区、双颊和下巴" width={1086} height={1448}/>
        <div className="oil-zone-labels" aria-hidden="true">{oilZones.map(zone=><span className={zone.id} key={zone.id}><i/>{zone.label}</span>)}</div>
      </div></div>
      <div className="oil-profile">
        <div className="oil-conclusion"><span>整体状态</span><strong>整体平衡 <em>鼻部 T 区偏油</em></strong></div>
        <div className="oil-zone-bars" role="group" aria-label="各面部分区油脂指数">{oilZones.map(zone=>{const position=`${Math.max(9,Math.min(91,zone.value))}%`;return <div className={`oil-zone-row ${getOilLevel(zone.value)}`} key={zone.id}><div className="oil-zone-meta"><span>{zone.label}</span><em>{zone.status}</em></div><div className="oil-zone-meter" role="meter" aria-label={`${zone.label}油脂指数`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={zone.value} aria-valuetext={`${zone.value}%，${zone.status}`}><i><u style={{"--oil-position":position} as React.CSSProperties}/></i><b style={{"--oil-position":position} as React.CSSProperties}>{zone.value}%</b></div></div>})}</div>
        <div className="oil-range-key" aria-label="油脂指数范围：0到30偏干，31到70平衡，71到100偏油"><span>0–30<br/><b>偏干</b></span><span>31–70<br/><b>平衡</b></span><span>71–100<br/><b>偏油</b></span></div>
      </div>
    </div>
    <p className="oil-module-note"><span>✦</span> 本次整体平衡，鼻部 T 区出油更明显；清洁时无需全脸加码，分区护理更合适。</p>
  </article>;
}

function Details() {
  const [expanded, setExpanded] = useState(false);
  return <div className={`details-panel compact-details ${expanded ? "is-expanded" : "is-preview"}`}>
    <div className="details-preview-window" id="metric-detail-list">
      <Reveal className="metric-group all-metrics-group"><div className="other-metric-grid">{metrics.map((m,i)=><MetricCard item={m} rank={i+1} ariaHidden={!expanded && i >= 6} key={m.name}/>)}</div></Reveal>
      {!expanded&&<div className="details-preview-fade" aria-hidden="true"/>}
    </div>
    <button className="details-expand-button" type="button" aria-expanded={expanded} aria-controls="metric-detail-list" onClick={()=>setExpanded(value=>!value)}>
      <span>{expanded ? "收起分项检测" : "展开全部 11 项"}</span><i aria-hidden="true">{expanded ? "↑" : "↓"}</i>
    </button>
  </div>;
}

function ProductShelf({ activeId, onSelect, onDetail, onBuy, onExplore, sectionRef, suspended }: { activeId: ProductId; onSelect: (id: ProductId) => void; onDetail: (id: ProductId) => void; onBuy: (id: ProductId) => void; onExplore: () => void; sectionRef: React.RefObject<HTMLElement | null>; suspended: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [pageHidden, setPageHidden] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);
  const [manualHold, setManualHold] = useState(false);
  const manualHoldTimerRef = useRef<number | null>(null);
  const activeIndex = Math.max(0, commerceProducts.findIndex(product => product.id === activeId));
  const product = commerceProducts[activeIndex];
  const promotion = commercePromotions[product.id];
  const effectivePaused = prefersReducedMotion;
  const autoRotationEnabled = false;
  const isAutoPlaying = autoRotationEnabled && !effectivePaused && !hovered && !focusWithin && !pageHidden && !suspended && !manualHold;
  const holdAfterManual = () => {
    setManualHold(true);
    if (manualHoldTimerRef.current) window.clearTimeout(manualHoldTimerRef.current);
    manualHoldTimerRef.current = window.setTimeout(() => setManualHold(false), COMMERCE_MANUAL_HOLD_MS);
  };
  const selectManual = (id: ProductId) => { holdAfterManual(); onSelect(id); };
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setPrefersReducedMotion(media.matches);
    syncMotion();
    media.addEventListener("change", syncMotion);
    return () => media.removeEventListener("change", syncMotion);
  }, []);
  useEffect(() => {
    const syncVisibility = () => setPageHidden(document.visibilityState !== "visible");
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);
  useEffect(() => () => { if (manualHoldTimerRef.current) window.clearTimeout(manualHoldTimerRef.current); }, []);
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = window.setTimeout(() => onSelect(commerceProducts[(activeIndex + 1) % commerceProducts.length].id), COMMERCE_AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isAutoPlaying, onSelect]);
  return <section id="recommended-products" className="commerce-shelf" ref={sectionRef} aria-labelledby="commerce-shelf-title" aria-roledescription="carousel" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocusWithin(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);}} onPointerDown={event=>{if(event.pointerType==="touch") holdAfterManual();}}>
    <header className="commerce-shelf-head"><div><small>专属产品推荐</small><h3 id="commerce-shelf-title">为你匹配的 4 款产品</h3></div></header>
    <div className="commerce-carousel" aria-live={isAutoPlaying ? "off" : "polite"}>
      <article className={`commerce-product-card product-${product.id}`} key={product.id}>
        <div className="commerce-product-media"><img src={product.image} alt={`${product.name}商品示例照片`} width={1254} height={1254}/></div>
        <div className="commerce-product-copy">
          <div className="commerce-product-kicker"><span>{product.ingredient}</span></div>
          <h4>{product.name}</h4>
          <p className="commerce-product-concern"><span>针对</span>{product.concern}</p><p className="commerce-product-reason">{product.benefit}</p>
        </div>
        <div className="commerce-product-summary">
          <div className="commerce-product-price-group"><div className="commerce-product-price">
            <strong><small>¥</small>{product.price}</strong>
            <span className="commerce-product-offer"><del>¥{promotion.originalPrice}</del></span>
          </div><p className="commerce-product-spec">{product.size} · 包邮</p></div>
          <div className="commerce-product-verification"><ShieldCheck size={14} weight="duotone" aria-hidden="true"/>图灵官方核验</div>
        </div>
        <div className="commerce-product-actions"><button className="commerce-secondary" type="button" aria-label={`查看${product.name}详情`} onClick={() => { holdAfterManual(); onDetail(product.id); }}>查看详情</button><button className="commerce-primary" type="button" aria-label={`立即购买${product.name}`} onClick={() => { holdAfterManual(); onBuy(product.id); }}>立即购买</button></div>
      </article>
    </div>
    <div className="commerce-pagination"><div className="commerce-dots" role="group" aria-label="推荐商品切换">{commerceProducts.map((item, index) => <button type="button" key={item.id} onClick={() => selectManual(item.id)} className={item.id === activeId ? "active" : ""} aria-label={`查看第${index + 1}款：${item.name}`} aria-current={item.id === activeId ? "true" : undefined}/>)}</div></div>
    <button id="explore-all-products" className="commerce-discovery" type="button" onClick={onExplore}>
      <span className="commerce-discovery-photo" aria-hidden="true"><img src={PRODUCT_SAMPLE_IMAGE} alt="" loading="lazy" /></span>
      <span className="commerce-discovery-copy"><strong>好物不止这 4 款</strong><small>探索全部 {catalogProducts.length} 款护肤品</small></span>
      <span className="commerce-discovery-arrow"><ArrowUpRight size={20} aria-hidden="true" /></span>
    </button>
  </section>;
}

type CommerceView = null | "detail" | "support";

function CommerceSheet({ view, product, onClose, onBack, onCheckout, onSupport }: { view: Exclude<CommerceView, null>; product: CommerceProduct; onClose: () => void; onBack: () => void; onCheckout: () => void; onSupport: () => void }) {
  const sheetRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => titleRef.current?.focus());
    const sheet = sheetRef.current;
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(sheet?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []).filter(element => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    sheet?.addEventListener("keydown", trapFocus);
    return () => {
      window.cancelAnimationFrame(frame);
      sheet?.removeEventListener("keydown", trapFocus);
    };
  }, [view]);
  const title = view === "detail" ? "商品详情" : "人工客服";
  return <dialog open className="commerce-overlay" aria-modal="true" aria-labelledby="commerce-sheet-title">
    <button className="commerce-overlay-dismiss" type="button" tabIndex={-1} onClick={onClose} aria-hidden="true"/>
    <section ref={sheetRef} className={`commerce-sheet commerce-sheet-${view}`}>
      <div className="commerce-sheet-handle"/>
      <header className="commerce-sheet-bar"><div className="commerce-sheet-heading">{(view === "support") && <button className="commerce-sheet-back" type="button" onClick={onBack} aria-label="返回上一页">‹</button>}<div><small>TURING CARE</small><h2 id="commerce-sheet-title" ref={titleRef} tabIndex={-1}>{title}</h2></div></div><button type="button" onClick={onClose} aria-label={`关闭${title}`}>×</button></header>
      {view === "detail" && <div className="commerce-detail">
        <div className="commerce-detail-hero"><img src={product.image} alt={product.name} width={800} height={800}/><span>本次护理推荐</span><em>图灵官方核验</em></div>
        <div className="commerce-detail-title"><div><small>{product.ingredient} · {product.concern}</small><h3>{product.name}</h3><p>{product.size}</p></div><strong>¥{product.price}</strong></div>
        <section className="commerce-detail-section"><h4>产品推荐理由</h4><p>{product.reason}</p><p>{product.benefit}</p></section>
        <section className="commerce-detail-section"><h4>配方与使用</h4><div className="commerce-highlight-list">{product.highlights.map(item => <span key={item}>{item}</span>)}</div><p>{product.usage}</p></section>
        <ProductGuarantee onSupport={onSupport} />
        <p className="commerce-caution">首次使用请局部试用；敏感肌、孕期或有明确过敏史者，请先咨询专业人士。</p>
        <button className="commerce-sheet-main" type="button" onClick={onCheckout}>立即购买 · ¥{product.price}</button>
      </div>}
      {view === "support" && <CustomerSupport productName={product.name} />}
    </section>
  </dialog>;
}

function ReportCard({ onPoster, step, onJumpProduct, activeProductId, onSelectProduct, onProductDetail, onProductBuy, onExploreProducts, productSectionRef, commerceSuspended, reportSaveStatus, onOpenHistory, onRetrySave }: { reportSaveStatus: "idle" | "saving" | "saved" | "error"; onOpenHistory: () => void; onRetrySave: () => void; onPoster: () => void; step: number; onJumpProduct: (id: ProductId) => void; activeProductId: ProductId; onSelectProduct: (id: ProductId) => void; onProductDetail: (id: ProductId) => void; onProductBuy: (id: ProductId) => void; onExploreProducts: () => void; productSectionRef: React.RefObject<HTMLElement | null>; commerceSuspended: boolean }) {
  return <div className="report-card report-stream">
    {step===0&&<div className="report-generating-line"><span className="typing"><i/><i/><i/></span>正在生成你的肌肤测试报告</div>}
    {step>=1&&<Reveal className="report-header-reveal"><div className="report-top"><div><span>SKIN REPORT · 08/25</span><h3>你的肌肤测试报告</h3></div><b>{step>=7?"已完成":"生成中"}</b></div><div className="report-build-progress"><i style={{width:`${Math.min(100,step/7*100)}%`}}/></div></Reveal>}
    {step>=2&&<Reveal className="report-block"><section className="report-surface overview-surface"><div className="stream-heading"><span>01</span><div><small>OVERVIEW</small><h3>肌肤综合概览</h3></div></div><Overview onJumpProduct={onJumpProduct} commerceReady={step>=7} step={step}/></section></Reveal>}
    {step===1&&<BuildIndicator label="正在构建肌肤综合概览" index={1}/>}
    {step>=5&&<section className="report-surface details-surface details-collapsible"><div className="details-disclosure"><header className="details-summary"><span className="details-summary-marker">02</span><span className="details-summary-copy"><small>重点预览</small><strong>11 项分项检测</strong></span><span className="details-summary-status"><em>已完成 11/11</em><b>先看需关注项</b></span></header><Details/></div></section>}
    {step===2&&<BuildIndicator label="正在解析肤色光谱" index={2}/>}
    {step===3&&<BuildIndicator label="正在构建分区油光地图" index={3}/>}
    {step===4&&<BuildIndicator label="正在整理 11 项检测维度" index={4}/>}
    {step===5&&<BuildIndicator label="正在生成专属皮肤说明书" index={5}/>} 
    {step===6&&<BuildIndicator label="正在完成报告校验" index={6}/>} 
    {step>=7&&<><Reveal className="report-action"><button type="button" onClick={onPoster}>✦ 生成我的皮肤说明书 <span>→</span></button></Reveal><ReportSavedEntry status={reportSaveStatus} onOpen={onOpenHistory} onRetry={onRetrySave}/><Reveal delay={120}><ProductShelf activeId={activeProductId} onSelect={onSelectProduct} onDetail={onProductDetail} onBuy={onProductBuy} onExplore={onExploreProducts} sectionRef={productSectionRef} suspended={commerceSuspended}/></Reveal></>}
  </div>;
}

function Poster({ photoUrl, onClose, onDownload }: { photoUrl:string; onClose:()=>void; onDownload:()=>void }) {
  return <div className="modal poster-modal" role="dialog" aria-label="皮肤说明书预览">
    <div className="modal-bar"><button onClick={onClose} type="button">‹</button><b>报告预览</b><button onClick={onDownload} type="button">保存</button></div>
    <div className="poster-scroll"><article className="poster poster-report-v13" id="skin-poster">
      <header className="poster-hero"><div className="poster-brand"><strong>图灵鉴 X</strong><small>TURING AI · SKIN LAB</small></div><div><h2>我的皮肤说明书</h2><p>11 维肤况分析 · 个性护理建议</p></div></header>
      <section className="poster-identity-card">
        <figure className="poster-user-photo"><img src={photoUrl} alt="用户本次检测照片"/><figcaption>本次检测照片 · 仅用于生成报告</figcaption></figure>
        <div className="poster-score-copy"><small>综合肤质分</small><div><strong>76</strong><span>/100</span></div><h3>清透微光肌</h3><p>整体肤况良好，光泽与洁净度表现突出。</p><ul><li>混合偏干</li><li>修护维稳</li></ul></div>
      </section>
      <section className="poster-evidence-grid">
        <div className="poster-radar-card poster-radar-compact"><header><div><small>11D SKIN MAP</small><h3>11 维肌肤雷达图</h3></div><p>暖色点位优先关注</p></header><div className="poster-radar"><RadarChart size={226}/></div></div>
        <div className="poster-evidence-side">
          <div className="poster-result-card poster-tone-single"><header><div><small>CHROMA PROFILE</small><h3>肤色结果</h3></div><span>87%</span></header><div className="poster-tone-result"><i style={{background:selectedTone.color}}/><div><strong>暖黄调 · 黄二白</strong><p>底妆优先试暖黄调二白。</p></div></div></div>
          <div className="poster-result-card poster-oil-fixed"><header><div><small>SEBUM MAP</small><h3>油光结果</h3></div><span>T 区偏油</span></header><div className="poster-oil-layout"><img src={OIL_FACE_ASSET} alt="贴合面部轮廓的分区油光示意"/><div className="poster-oil-bars">{oilZones.map(zone=><div className={getOilLevel(zone.value)} key={zone.id}><span>{zone.label}<b>{zone.value}%</b></span><i><u style={{width:`${zone.value}%`}}/></i></div>)}</div></div></div>
        </div>
      </section>
      <section className="poster-care-plan"><header><small>DAILY CARE GUIDE</small><h3>你的三步护理节奏</h3></header><ol><li><span>01</span><div><b>先修护屏障</b><p>神经酰胺打底，减少刺激型产品叠加。</p></div></li><li><span>02</span><div><b>再改善眼周与暗沉</b><p>按耐受加入咖啡因与低浓度烟酰胺。</p></div></li><li><span>03</span><div><b>最后温和抗老</b><p>状态稳定后循序加入胜肽，坚持日间防晒。</p></div></li></ol><small>建议仅作日常护肤参考，首次使用请局部测试；敏感肌、孕期或有明确过敏史者，建议咨询专业人士。</small></section>
      <footer><span>图灵鉴 X · AI 肌肤检测</span><small>结果仅作日常护肤参考，不构成医疗诊断</small></footer>
    </article></div>
    <button className="save-poster" onClick={onDownload} type="button">保存高清报告</button>
  </div>;
}

export default function Home() {
  const [appView, setAppView] = useState<AppView>("chat");
  const [skinEntry, setSkinEntry] = useState<"history" | "catalog">("history");
  const [flow, setFlow] = useState<FlowState>("idle");
  const [photoUrl, setPhotoUrl] = useState("/og.png");
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [clearPhoto, setClearPhoto] = useState(false);
  const [poster, setPoster] = useState(false);
  const [activeProductId, setActiveProductId] = useState<ProductId>(commerceProducts[0].id);
  const [selectedProductId, setSelectedProductId] = useState<ProductId>(commerceProducts[0].id);
  const [commerceView, setCommerceView] = useState<CommerceView>(null);
  const experience = useExperience();
  const [checkoutProduct, setCheckoutProduct] = useState<OrderProduct | null>(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | undefined>();
  const [paymentOrder, setPaymentOrder] = useState<ShopOrder | null>(null);
  const [orderEntryId, setOrderEntryId] = useState<string | undefined>();
  const orderReturnView = useRef<"chat" | "skin">("chat");
  const reportIdRef = useRef("");
  const [reportSaveStatus, setReportSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [guide, setGuide] = useState<"skin" | "orders" | null>(null);
  const [skinHighlight, setSkinHighlight] = useState(false);
  const saveReport = useCallback(async () => {
    if (!experience.ready || !reportIdRef.current) return;
    const id = reportIdRef.current;
    setReportSaveStatus("saving");
    try {
      await experience.mutate("report", id);
      if (reportIdRef.current !== id) return;
      setReportSaveStatus("saved");
      try { if (!localStorage.getItem("turing-guide-skin-v1")) { setGuide("skin"); setSkinHighlight(true); } } catch { setGuide("skin"); }
    } catch { if (reportIdRef.current === id) setReportSaveStatus("error"); }
  }, [experience.ready, experience.mutate]);
  const dismissGuide = useCallback(() => {
    if (guide) { try { localStorage.setItem(`turing-guide-${guide}-v1`, "seen"); } catch {} }
    setGuide(null);
  }, [guide]);
  const readOrder = useCallback(async (id: string) => { await experience.mutate("read", id); }, [experience.mutate]);
  const openOrders = (id?: string) => {
    if (appView === "skin" || appView === "chat") orderReturnView.current = appView;
    setOrderEntryId(id); setMenu(false); setGuide(null); setCommerceView(null); setAppView("orders");
  };
  const startCheckout = (product: OrderProduct) => { if (appView === "chat" || appView === "skin") orderReturnView.current = appView; setCommerceView(null); setCheckoutOrderId(undefined); setCheckoutProduct(product); setGuide(null); };
  const paymentComplete = (result: ShopOrder) => { setCheckoutProduct(null); setPaymentOrder(result); setAppView("payment"); };
  const createOrder = async (id: string, pay: boolean, shippingAddress: ShippingAddress) => {
    if (!checkoutProduct) return;
    const created = await experience.mutate("create", id, checkoutProduct.id);
    if (pay && created.state !== "pending_payment") { paymentComplete(created); return; }
    await experience.mutate("address", id, undefined, shippingAddress);
    if (pay) paymentComplete(await experience.mutate("pay", id));
    else { setCheckoutProduct(null); openOrders(id); }
  };
  const payOrder = async (id: string) => {
    const order = experience.orders.find(item => item.id === id);
    if (order && !order.addressComplete) { setCheckoutOrderId(id); setCheckoutProduct(order.product); return; }
    paymentComplete(await experience.mutate("pay", id));
  };
  const returnAfterPayment = () => {
    setAppView("chat");
    try { if (!localStorage.getItem("turing-guide-orders-v1")) setGuide("orders"); } catch { setGuide("orders"); }
  };
  const [errorText, setErrorText] = useState("");
  const [progress, setProgress] = useState(0);
  const [reportStep, setReportStep] = useState(0);
  const [landmarksComplete, setLandmarksComplete] = useState(false);
  const [input, setInput] = useState("");
  const [chatText, setChatText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const productSectionRef = useRef<HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const statuses = ["正在建立面部轮廓", "识别 68 个面部关键点", "分析肤色与纹理分布", "生成 11 维肌肤数据", "AI 正在整理护理建议"];
  const statusIndex = Math.min(statuses.length-1,Math.floor(progress/21));
  const openCommerce = useCallback((view: Exclude<CommerceView, null>, productId?: ProductId) => {
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!activeElement?.closest(".commerce-sheet")) previousFocusRef.current = activeElement;
    if (productId) {
      setSelectedProductId(productId);
      setActiveProductId(productId);
    }
    setCommerceView(view);
  }, []);
  const closeCommerce = useCallback(() => {
    setCommerceView(null);
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    if (flow === "report" && reportStep >= 7 && reportSaveStatus === "idle" && experience.ready) void saveReport();
  }, [flow, reportStep, reportSaveStatus, experience.ready, saveReport]);
  useEffect(() => {
    if (!commerceView) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeCommerce(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeCommerce, commerceView]);

  useEffect(()=>{
    const container = scrollRef.current;
    if (!container) return;
    if(flow==="idle"&&!chatText){container.scrollTop=0;return;}
    const timer = window.setTimeout(() => {
      if (flow === "report" && !landmarksComplete) {
        const target = container.querySelector<HTMLElement>(".analysis-card.complete");
        container.scrollTo({ top: Math.max(0, (target?.offsetTop ?? 0) - 14), behavior: "smooth" });
      } else {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
    }, 60);
    return () => window.clearTimeout(timer);
  },[flow,chatText,reportStep,landmarksComplete]);
  useEffect(()=>{
    if(flow!=="checking") return;
    const t=setTimeout(()=>{setFlow("scanning");setProgress(3);},900); return()=>clearTimeout(t);
  },[flow]);
  useEffect(()=>{
    if(flow!=="scanning") return;
    const timer=setInterval(()=>setProgress(p=>Math.min(100,p+1)),85); return()=>clearInterval(timer);
  },[flow]);
  useEffect(()=>{
    if(flow!=="scanning") return;
    if(progress>=100){const t=setTimeout(()=>setFlow("report"),450);return()=>clearTimeout(t);}
  },[progress,flow]);
  useEffect(()=>{
    if(flow!=="report") return;
    const timer = window.setTimeout(()=>setLandmarksComplete(true),LANDMARK_SEQUENCE_MS);
    return()=>window.clearTimeout(timer);
  },[flow]);
  useEffect(()=>{
    if(flow!=="report" || !landmarksComplete) return;
    const timers = Array.from({length:7},(_,i)=>window.setTimeout(()=>setReportStep(i+1),650+2300*i));
    return()=>timers.forEach(window.clearTimeout);
  },[flow,landmarksComplete]);

  const begin = (url = "/og.png") => { reportIdRef.current = crypto.randomUUID(); setReportSaveStatus("idle"); setPhotoUrl(url); setSheet(false); setMenu(false); setErrorText(""); setProgress(0); setReportStep(0); setLandmarksComplete(false); setFlow("checking"); };
  const upload = (e:ChangeEvent<HTMLInputElement>) => { const file=e.target.files?.[0]; if(!file)return; begin(URL.createObjectURL(file)); e.target.value=""; };
  const showError = (type:"multi"|"cover"|"blur") => {
    const map={multi:"我检测到画面中有多张人脸，目前暂不支持多人分析。请上传一张只有你的清晰正脸照，我们重新来一次。",cover:"眼镜、口罩或头发遮挡了部分检测区域。请露出额头、眼周与下颌，并正对镜头重新拍摄。",blur:"照片清晰度不足，可能影响细纹与毛孔判断。建议在自然光下保持镜头稳定，再拍一张清晰照片。"};
    setErrorText(map[type]);setSheet(false);setFlow("error");
  };
  const reset=()=>{setAppView("chat");setFlow("idle");setProgress(0);setReportStep(0);setLandmarksComplete(false);setMenu(false);setChatText("");setInput("");(window as any).jianxNewChat();};
  const closeMenu=useCallback(()=>setMenu(false),[]);
  const openMenu=useCallback(()=>setMenu(true),[]);
  const openSkinManagement=()=>{dismissGuide();setSkinHighlight(false);setMenu(false);setSkinEntry("history");setAppView("skin");};
  const exploreAllProducts=()=>{setSkinEntry("catalog");setAppView("skin");};
  const returnFromSkin=()=>{setAppView("chat");if(skinEntry==="catalog")window.requestAnimationFrame(()=>document.getElementById("explore-all-products")?.focus({preventScroll:true}));};
  const startFreshSkinTest=()=>{setAppView("chat");setFlow("idle");setProgress(0);setReportStep(0);setLandmarksComplete(false);setChatText("");setInput("");setMenu(false);};
  const send=()=>{if(!input.trim())return;setChatText(input.trim());setInput("");};
  useEffect(()=>{
    const receive=(event:Event)=>{const message=(event as CustomEvent).detail;if(message.type==="reset-chat"){startFreshSkinTest();return;}if(message.type!=="activate")return;
      setMenu(false);setSheet(false);setPrivacy(false);setPoster(false);setGuide(null);setCommerceView(null);setCheckoutProduct(null);setPaymentOrder(null);
      if(message.route==="skin-management")openSkinManagement();
      else if(message.route==="orders")openOrders();
      else if(message.route==="skin"){setAppView("chat");}
    };
    window.addEventListener("jianx-shell",receive);return()=>window.removeEventListener("jianx-shell",receive);
  });
  useEffect(()=>{(window as any).jianxReady();},[]);
  const jumpToProduct = (id: ProductId) => {
    setSelectedProductId(id);
    setActiveProductId(id);
    window.requestAnimationFrame(() => {
      if (productSectionRef.current) productSectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      else openCommerce("detail", id);
    });
  };
  const openProductDetail = (id: ProductId) => openCommerce("detail", id);
  const openProductCheckout = (id: ProductId) => startCheckout(getCommerceProduct(id));
  const downloadPosterLegacy=()=>{
    const c=document.createElement("canvas");c.width=750;c.height=3300;const x=c.getContext("2d");if(!x)return;
    const g=x.createLinearGradient(0,0,0,3300);g.addColorStop(0,"#0b0928");g.addColorStop(.55,"#08091f");g.addColorStop(1,"#040611");x.fillStyle=g;x.fillRect(0,0,750,3300);
    x.strokeStyle="#6f5cff55";x.lineWidth=2;for(let r=150;r<700;r+=85){x.beginPath();x.ellipse(375,560,r,70,0,0,Math.PI*2);x.stroke();}
    const center=(text:string,y:number,font:string,color:string="#f5f3ff")=>{x.fillStyle=color;x.font=font;x.textAlign="center";x.fillText(text,375,y)};
    center("✦  TURING AI · SKIN LAB  ✦",90,"500 22px system-ui","#a7adc8");center("我的皮肤说明书",175,"700 48px system-ui");center("AI 科技分析 · 专属护理建议",220,"400 21px system-ui","#a7adc8");
    x.fillStyle="#12102f";x.strokeStyle="#8f78ff";x.lineWidth=2;x.beginPath();x.roundRect(55,290,640,480,36);x.fill();x.stroke();center("综合肤质评分",365,"500 22px system-ui","#a7adc8");center("76",515,"700 132px system-ui");center("/100",565,"400 22px system-ui","#a7adc8");center("松弛感发光体",650,"700 38px system-ui","#ffcc5c");center("状态从容 · 光泽在线 · 需要一点温柔修护",705,"400 20px system-ui","#a7adc8");
    const box=(y:number,title:string,lines:string[])=>{x.fillStyle="#0e1027";x.strokeStyle="#6f5cff44";x.beginPath();x.roundRect(55,y,640,lines.length*62+105,30);x.fill();x.stroke();x.textAlign="left";x.fillStyle="#fff";x.font="700 30px system-ui";x.fillText(title,90,y+56);lines.forEach((l,i)=>{x.fillStyle=i===0?"#a995ff":"#c9cce0";x.font=i===0?"600 25px system-ui":"400 21px system-ui";x.fillText(l,90,y+112+i*54)});};
    box(820,"AI 肤况总览",["整体肤况良好，通透光泽与毛孔洁净度表现突出。","近期优先关注眼周疲态与双颊轻敏，先稳定屏障再进阶。"]);
    center("11 维肌肤状态图",1125,"700 34px system-ui");center("分数越高，代表该维度当前状态越好",1165,"400 18px system-ui","#8e96b5");
    const cx=375,cy=1440,outer=190;
    for(let ring=1;ring<=4;ring++){x.beginPath();metrics.forEach((_,i)=>{const a=-Math.PI/2+i*Math.PI*2/metrics.length,rr=outer*ring/4,px=cx+Math.cos(a)*rr,py=cy+Math.sin(a)*rr;if(i)x.lineTo(px,py);else x.moveTo(px,py)});x.closePath();x.strokeStyle=ring===4?"#7e6cff70":"#7e6cff26";x.lineWidth=1.5;x.stroke();}
    const dataPoints=metrics.map((m,i)=>{const a=-Math.PI/2+i*Math.PI*2/metrics.length;return [cx+Math.cos(a)*outer*m.score/10,cy+Math.sin(a)*outer*m.score/10] as const});
    metrics.forEach((m,i)=>{const a=-Math.PI/2+i*Math.PI*2/metrics.length,ox=cx+Math.cos(a)*outer,oy=cy+Math.sin(a)*outer;x.beginPath();x.moveTo(cx,cy);x.lineTo(ox,oy);x.strokeStyle="#7e6cff22";x.stroke();const lx=cx+Math.cos(a)*248,ly=cy+Math.sin(a)*248;x.textAlign=Math.cos(a)>.2?"left":Math.cos(a)<-.2?"right":"center";x.fillStyle=m.score<6.5?"#ffcc5c":"#74d8ff";x.font="700 19px system-ui";x.fillText(String(Math.round(m.score*10)),lx,ly-2);x.fillStyle="#aeb4ca";x.font="400 15px system-ui";x.fillText(m.name,lx,ly+20)});
    const dg=x.createLinearGradient(cx-outer,cy-outer,cx+outer,cy+outer);dg.addColorStop(0,"#ffcc5c99");dg.addColorStop(.45,"#6f5cffaa");dg.addColorStop(1,"#39bfff88");x.beginPath();dataPoints.forEach(([px,py],i)=>i?x.lineTo(px,py):x.moveTo(px,py));x.closePath();x.fillStyle=dg;x.fill();x.strokeStyle="#b5a6ff";x.lineWidth=3;x.stroke();dataPoints.forEach(([px,py])=>{x.beginPath();x.arc(px,py,5,0,Math.PI*2);x.fillStyle="#ffcc5c";x.fill()});
    x.beginPath();x.arc(cx,cy,55,0,Math.PI*2);x.fillStyle="#0b0d24";x.fill();x.strokeStyle="#8b78ff";x.lineWidth=2;x.stroke();center("76",1452,"700 43px system-ui");center("综合分",1480,"400 14px system-ui","#8d95b2");
    box(1740,"本次重点关注",["01  细纹 5.1　　02  泛红 5.6　　03  眼袋 6.2","优先修护屏障，减少刺激叠加，关注眼周休息。"]);box(2020,"你的肌肤优势",["✦ 光泽度 9.1　 ✦ 黑头 8.9　 ✦ 毛孔 8.7","通透、洁净与细腻度是你当前的优势。"]);box(2300,"AI 护肤建议",["先修护，再进阶。未来 2–4 周优先稳定屏障。","白天坚持防晒；眼周搭配咖啡因，耐受稳定后加入胜肽。","推荐成分：神经酰胺 · 咖啡因 · 烟酰胺 · 胜肽"]);
    center("图灵鉴 X · AI 肌肤检测",3050,"700 28px system-ui");center("本报告已进行人脸隐私处理",3100,"400 19px system-ui","#a7adc8");center("结果仅作日常护肤参考，不构成医疗诊断",3195,"400 17px system-ui","#a7adc8");
    const a=document.createElement("a");a.download=`AI皮肤说明书-${new Date().toISOString().slice(0,10)}.png`;a.href=c.toDataURL("image/png");a.click();
  };
  void downloadPosterLegacy;
  const downloadPosterCanvasLegacy=()=>{
    const c=document.createElement("canvas");c.width=750;c.height=1600;const x=c.getContext("2d");if(!x)return;
    const bg=x.createLinearGradient(0,0,0,1600);bg.addColorStop(0,"#100c35");bg.addColorStop(.48,"#080a22");bg.addColorStop(1,"#040611");x.fillStyle=bg;x.fillRect(0,0,750,1600);
    const glow=x.createRadialGradient(620,130,10,620,130,310);glow.addColorStop(0,"#6f5cff55");glow.addColorStop(1,"#6f5cff00");x.fillStyle=glow;x.fillRect(300,0,450,470);
    const center=(text:string,y:number,font:string,color:string="#f5f3ff")=>{x.fillStyle=color;x.font=font;x.textAlign="center";x.fillText(text,375,y)};
    const card=(px:number,py:number,w:number,h:number,stroke="#6f5cff44")=>{x.fillStyle="#0e1028e8";x.strokeStyle=stroke;x.lineWidth=1.5;x.beginPath();x.roundRect(px,py,w,h,24);x.fill();x.stroke();};
    center("✦  TURING · SKIN LAB  ✦",58,"500 17px system-ui","#a7adc8");center("我的皮肤说明书",113,"700 38px system-ui");center("11 维肤况分析 · 专属护理建议",147,"400 16px system-ui","#8f97b5");
    card(40,180,245,240,"#8f78ff88");x.textAlign="left";x.fillStyle="#9da5c2";x.font="500 16px system-ui";x.fillText("综合肤质评分",68,218);x.fillStyle="#fff";x.font="700 94px system-ui";x.fillText("76",65,318);x.fillStyle="#8f97b5";x.font="400 17px system-ui";x.fillText("/100",190,316);x.fillStyle="#ffda82";x.font="700 27px system-ui";x.fillText("清透微光肌",68,365);x.fillStyle="#a8aec5";x.font="400 14px system-ui";x.fillText("通透有光 · 温柔修护",68,396);
    card(305,180,405,240,"#62cfff44");x.fillStyle="#b8aaff";x.font="700 17px system-ui";x.fillText("肤况总览",334,220);x.fillStyle="#c9cce0";x.font="400 17px system-ui";["整体肤况良好，光泽与洁净度表现突出；","近期优先关注眼周疲态与双颊轻敏，","先稳定屏障，再循序进阶。"].forEach((line,i)=>x.fillText(line,334,262+i*34));x.fillStyle="#171835";x.beginPath();x.roundRect(330,365,155,34,17);x.fill();x.beginPath();x.roundRect(496,365,175,34,17);x.fill();x.fillStyle="#d6d3e5";x.font="500 13px system-ui";x.fillText("混合偏干",350,387);x.fillText("修护维稳",516,387);
    card(40,450,405,610,"#7d6cff55");x.fillStyle="#fff";x.font="700 24px system-ui";x.fillText("11 维肌肤雷达图",70,495);x.fillStyle="#858eac";x.font="400 13px system-ui";x.fillText("分数越高，代表该维度状态越好",70,520);
    const cx=242,cy=770,outer=132;
    for(let ring=1;ring<=4;ring++){x.beginPath();metrics.forEach((_,i)=>{const angle=-Math.PI/2+i*Math.PI*2/metrics.length,rr=outer*ring/4,px=cx+Math.cos(angle)*rr,py=cy+Math.sin(angle)*rr;if(i)x.lineTo(px,py);else x.moveTo(px,py)});x.closePath();x.strokeStyle=ring===4?"#7e6cff70":"#7e6cff26";x.lineWidth=1.3;x.stroke();}
    const dataPoints=metrics.map((m,i)=>{const angle=-Math.PI/2+i*Math.PI*2/metrics.length;return [cx+Math.cos(angle)*outer*m.score/10,cy+Math.sin(angle)*outer*m.score/10] as const});
    metrics.forEach((m,i)=>{const angle=-Math.PI/2+i*Math.PI*2/metrics.length,ox=cx+Math.cos(angle)*outer,oy=cy+Math.sin(angle)*outer;x.beginPath();x.moveTo(cx,cy);x.lineTo(ox,oy);x.strokeStyle="#7e6cff22";x.stroke();const lx=cx+Math.cos(angle)*177,ly=cy+Math.sin(angle)*177;x.textAlign=Math.cos(angle)>.2?"left":Math.cos(angle)<-.2?"right":"center";x.fillStyle=m.score<6.5?"#ffcc5c":"#74d8ff";x.font="700 13px system-ui";x.fillText(`${m.name} ${m.score.toFixed(1)}`,lx,ly)});
    const dg=x.createLinearGradient(cx-outer,cy-outer,cx+outer,cy+outer);dg.addColorStop(0,"#ffcc5c99");dg.addColorStop(.45,"#6f5fffaa");dg.addColorStop(1,"#39bfff88");x.beginPath();dataPoints.forEach(([px,py],i)=>i?x.lineTo(px,py):x.moveTo(px,py));x.closePath();x.fillStyle=dg;x.fill();x.strokeStyle="#c0b5ff";x.lineWidth=3;x.stroke();dataPoints.forEach(([px,py])=>{x.beginPath();x.arc(px,py,4,0,Math.PI*2);x.fillStyle="#ffcc5c";x.fill()});x.beginPath();x.arc(cx,cy,39,0,Math.PI*2);x.fillStyle="#0b0d24";x.fill();x.strokeStyle="#8b78ff";x.stroke();x.textAlign="center";x.fillStyle="#fff";x.font="700 29px system-ui";x.fillText("76",cx,775);x.fillStyle="#8d95b2";x.font="400 11px system-ui";x.fillText("综合分",cx,794);
    card(465,450,245,292,"#ffcc5c44");x.textAlign="left";x.fillStyle="#ffdc8c";x.font="700 21px system-ui";x.fillText("优先关注",492,492);[["01","细纹","5.1"],["02","泛红","5.6"],["03","眼袋","6.2"]].forEach((v,i)=>{const py=538+i*59;x.fillStyle="#6f5cff33";x.beginPath();x.roundRect(490,py-27,192,43,12);x.fill();x.fillStyle="#ffcc5c";x.font="500 11px system-ui";x.fillText(v[0],505,py);x.fillStyle="#f0eef8";x.font="600 15px system-ui";x.fillText(v[1],543,py);x.textAlign="right";x.fillStyle="#ffdc8c";x.fillText(v[2],665,py);x.textAlign="left";});
    card(465,762,245,298,"#55ceff44");x.fillStyle="#8be3ff";x.font="700 21px system-ui";x.fillText("高光优势",492,804);[["光泽度","9.1"],["黑头","8.9"],["毛孔","8.7"]].forEach((v,i)=>{const py=850+i*58;x.fillStyle="#121a36";x.beginPath();x.roundRect(490,py-26,192,42,12);x.fill();x.fillStyle="#c9cce0";x.font="500 14px system-ui";x.fillText(v[0],507,py);x.textAlign="right";x.fillStyle="#75ddff";x.font="700 16px system-ui";x.fillText(v[1],664,py);x.textAlign="left";});
    card(40,1090,670,350,"#8f78ff55");x.fillStyle="#fff";x.font="700 23px system-ui";x.fillText("护理建议",70,1135);x.fillStyle="#c4c8db";x.font="400 16px system-ui";["先修护，再进阶。优先稳定屏障并坚持防晒；眼周可搭配咖啡因，","耐受稳定后，再循序加入胜肽等温和功效成分。"].forEach((line,i)=>x.fillText(line,70,1175+i*30));["神经酰胺","咖啡因","烟酰胺","胜肽"].forEach((item,i)=>{x.fillStyle=i===0?"#6f5cff66":"#171834";x.beginPath();x.roundRect(70+i*145,1248,126,38,19);x.fill();x.fillStyle="#e7e4f7";x.font="500 14px system-ui";x.textAlign="center";x.fillText(item,133+i*145,1273)});x.textAlign="left";x.fillStyle="#7f87a3";x.font="400 12px system-ui";x.fillText("成分建议仅作护肤参考，首次使用请局部测试；敏感、孕期或有过敏史请咨询专业人士。",70,1340);x.fillText("本报告已进行人脸隐私处理 · 结果不构成医疗诊断",70,1380);
    center("图灵鉴 X · AI 肌肤检测",1503,"700 19px system-ui");center("TURING SKIN LAB",1535,"500 12px system-ui","#767e9b");
    const a=document.createElement("a");a.download=`AI皮肤说明书-${new Date().toISOString().slice(0,10)}.png`;a.href=c.toDataURL("image/png");a.click();
  };
  void downloadPosterCanvasLegacy;
  const downloadPoster=async()=>{
    const source=document.getElementById("skin-poster");
    if(!source)return;
    const rect=source.getBoundingClientRect();
    const clone=source.cloneNode(true) as HTMLElement;
    clone.style.width=`${rect.width}px`;
    clone.style.height=`${rect.height}px`;
    clone.style.margin="0";
    const sourceCanvases=Array.from(source.querySelectorAll("canvas"));
    const cloneCanvases=Array.from(clone.querySelectorAll("canvas"));
    cloneCanvases.forEach((canvas,index)=>{
      const canvasRect=sourceCanvases[index]?.getBoundingClientRect();
      const image=document.createElement("img");
      image.src=sourceCanvases[index]?.toDataURL("image/png") ?? "";
      image.alt=sourceCanvases[index]?.getAttribute("aria-label") ?? "肌肤雷达图";
      image.style.cssText=`width:${canvasRect?.width ?? 190}px;height:${canvasRect?.height ?? 190}px;display:block`;
      canvas.replaceWith(image);
    });
    const css=Array.from(document.styleSheets).map(sheet=>{try{return Array.from(sheet.cssRules).map(rule=>rule.cssText).join("\n")}catch{return ""}}).join("\n");
    const serialized=new XMLSerializer().serializeToString(clone);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}" viewBox="0 0 ${rect.width} ${rect.height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style><![CDATA[${css}]]></style>${serialized}</div></foreignObject></svg>`;
    const svgUrl=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}));
    const image=new Image();
    image.onload=()=>{
      const scale=3;
      const canvas=document.createElement("canvas");
      canvas.width=Math.round(rect.width*scale);
      canvas.height=Math.round(rect.height*scale);
      const context=canvas.getContext("2d");
      if(!context){URL.revokeObjectURL(svgUrl);return;}
      context.drawImage(image,0,0,canvas.width,canvas.height);
      canvas.toBlob(blob=>{
        URL.revokeObjectURL(svgUrl);
        if(!blob)return;
        const url=URL.createObjectURL(blob);
        const link=document.createElement("a");
        link.download=`AI皮肤说明书-${new Date().toISOString().slice(0,10)}.png`;
        link.href=url;
        link.click();
        window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      },"image/png",1);
    };
    image.onerror=()=>URL.revokeObjectURL(svgUrl);
    image.src=svgUrl;
  };
  void downloadPoster;
  const downloadPosterStable=async()=>{
    const canvas=document.createElement("canvas");
    canvas.width=1080;canvas.height=1740;
    const ctx=canvas.getContext("2d");
    if(!ctx)return;
    const oilFaceAsset=await new Promise<HTMLImageElement|undefined>(resolve=>{const asset=new Image();asset.onload=()=>resolve(asset);asset.onerror=()=>resolve(undefined);asset.src=OIL_FACE_ASSET;});
    const background=ctx.createLinearGradient(0,0,0,1740);background.addColorStop(0,"#100b35");background.addColorStop(.52,"#080a20");background.addColorStop(1,"#040611");ctx.fillStyle=background;ctx.fillRect(0,0,1080,1740);
    const topGlow=ctx.createRadialGradient(540,80,10,540,80,480);topGlow.addColorStop(0,"#6f5cff58");topGlow.addColorStop(.52,"#6f5cff16");topGlow.addColorStop(1,"#6f5cff00");ctx.fillStyle=topGlow;ctx.fillRect(0,0,1080,540);
    const write=(value:string,x:number,y:number,font:string,color="#f7f5ff",align:CanvasTextAlign="left")=>{ctx.font=font;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline="alphabetic";ctx.fillText(value,x,y)};
    const card=(x:number,y:number,w:number,h:number,accent="#8d78ff")=>{ctx.save();ctx.shadowColor="#00000066";ctx.shadowBlur=28;ctx.shadowOffsetY=14;ctx.fillStyle="#0d1028";ctx.beginPath();ctx.roundRect(x,y,w,h,28);ctx.fill();ctx.restore();const edge=ctx.createLinearGradient(x,y,x+w,y+h);edge.addColorStop(0,accent+"bb");edge.addColorStop(.48,"#ffffff18");edge.addColorStop(1,"#55d4ff66");ctx.strokeStyle=edge;ctx.lineWidth=1.6;ctx.beginPath();ctx.roundRect(x+.8,y+.8,w-1.6,h-1.6,27);ctx.stroke();};
    ctx.strokeStyle="#8f7aff50";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(540,20,420,185,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.ellipse(540,15,330,130,0,0,Math.PI*2);ctx.stroke();
    write("✦",170,76,"500 20px system-ui","#d8d0ff","center");write("✦",910,76,"500 20px system-ui","#d8d0ff","center");write("图灵鉴 X",540,88,"700 40px system-ui","#ffffff","center");write("— T U R I N G   A I —",540,124,"500 15px system-ui","#b5aecb","center");write("肌肤检测报告",540,185,"700 50px system-ui","#ffffff","center");write("AI 科技智能检测 · 专业建议 · 隐私保护",540,224,"400 17px system-ui","#8c94b1","center");
    card(52,260,976,244,"#a58fff");
    const scoreX=180,scoreY=382;ctx.strokeStyle="#282a45";ctx.lineWidth=15;ctx.beginPath();ctx.arc(scoreX,scoreY,84,0,Math.PI*2);ctx.stroke();const scoreGrad=ctx.createLinearGradient(104,305,260,462);scoreGrad.addColorStop(0,"#55d5ff");scoreGrad.addColorStop(.52,"#8f7aff");scoreGrad.addColorStop(1,"#ffcc5c");ctx.strokeStyle=scoreGrad;ctx.lineCap="round";ctx.beginPath();ctx.arc(scoreX,scoreY,84,-Math.PI*.75,Math.PI*.77);ctx.stroke();const inner=ctx.createRadialGradient(scoreX,scoreY-30,10,scoreX,scoreY,72);inner.addColorStop(0,"#2a215f");inner.addColorStop(1,"#0a0d21");ctx.fillStyle=inner;ctx.beginPath();ctx.arc(scoreX,scoreY,70,0,Math.PI*2);ctx.fill();write("综合肤质分",scoreX,356,"500 14px system-ui","#aab1c8","center");write("76",scoreX,410,"700 63px system-ui","#ffffff","center");write("/100",scoreX,438,"400 14px system-ui","#7f87a5","center");
    write("本次肤况结论",304,315,"600 16px system-ui","#ffcc5c");write("清透微光肌",304,363,"700 38px system-ui","#ffffff");write("整体肤况良好，光泽与洁净度表现突出。",304,407,"400 20px system-ui","#c3c7d9");write("近期优先关注眼周疲态与双颊轻敏，先稳定屏障，再循序进阶。",304,441,"400 20px system-ui","#a7aec5");["混合偏干","修护维稳","温和抗老"].forEach((item,index)=>{const bx=304+index*150;ctx.fillStyle="#171833";ctx.beginPath();ctx.roundRect(bx,461,132,28,14);ctx.fill();write(item,bx+66,480,"500 13px system-ui","#c8c5da","center")});
    card(52,532,618,626,"#8f79ff");write("11D SKIN MAP",84,577,"500 13px system-ui","#8f81da");write("11 维肌肤雷达图",84,614,"700 28px system-ui");write("分数越高，代表该维度状态越好",84,641,"400 14px system-ui","#7f88a5");
    ([['高',scoreLevelColors.high],['中',scoreLevelColors.mid],['低',scoreLevelColors.low]] as const).forEach(([label,color],index)=>{const x=406+index*73;ctx.save();ctx.shadowColor=color;ctx.shadowBlur=9;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,626,5,0,Math.PI*2);ctx.fill();ctx.restore();write(label,x+12,631,"500 13px system-ui","#aeb5cc")});
    const cx=361,cy=900,outer=168;
    for(let ring=1;ring<=5;ring++){ctx.beginPath();metrics.forEach((_,index)=>{const angle=-Math.PI/2+index*Math.PI*2/metrics.length,rr=outer*ring/5,px=cx+Math.cos(angle)*rr,py=cy+Math.sin(angle)*rr;if(index)ctx.lineTo(px,py);else ctx.moveTo(px,py)});ctx.closePath();ctx.strokeStyle=ring===5?"#8f79ff66":"#8f79ff22";ctx.lineWidth=1.5;ctx.stroke();}
    const radarPoints=metrics.map((item,index)=>{const angle=-Math.PI/2+index*Math.PI*2/metrics.length;return [cx+Math.cos(angle)*outer*item.score/10,cy+Math.sin(angle)*outer*item.score/10] as const});metrics.forEach((item,index)=>{const angle=-Math.PI/2+index*Math.PI*2/metrics.length;const ox=cx+Math.cos(angle)*outer,oy=cy+Math.sin(angle)*outer;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ox,oy);ctx.strokeStyle="#8877ff25";ctx.stroke();const rawX=cx+Math.cos(angle)*226,rawY=cy+Math.sin(angle)*226;const label=radarDisplayName(item.name);ctx.font="600 14px system-ui";const halfWidth=Math.max(ctx.measureText(label).width/2,32);const lx=Math.min(638-halfWidth,Math.max(84+halfWidth,rawX));const ly=Math.min(1127,Math.max(696,rawY));write(label,lx,ly-4,"500 14px system-ui","#aeb6ce","center");write(item.score.toFixed(1),lx,ly+16,"700 16px system-ui",scoreLevelColors[getScoreLevel(item.score)],"center")});const radarGradient=ctx.createLinearGradient(cx-outer,cy-outer,cx+outer,cy+outer);radarGradient.addColorStop(0,"#9c8aff82");radarGradient.addColorStop(.52,"#6276ff9b");radarGradient.addColorStop(1,"#46cfff70");ctx.beginPath();radarPoints.forEach(([px,py],index)=>index?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fillStyle=radarGradient;ctx.fill();ctx.strokeStyle="#b9b2ff";ctx.lineWidth=4;ctx.stroke();radarPoints.forEach(([px,py],index)=>{const color=scoreLevelColors[getScoreLevel(metrics[index].score)];ctx.save();ctx.shadowColor=color;ctx.shadowBlur=10;ctx.fillStyle=color;ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();ctx.restore()});ctx.save();ctx.shadowColor="#7c8cff";ctx.shadowBlur=14;ctx.fillStyle="#b9c2ff";ctx.beginPath();ctx.arc(cx,cy,4,0,Math.PI*2);ctx.fill();ctx.restore();
    card(694,532,334,300,"#e3ad7c");write("CHROMA PROFILE",726,573,"500 12px system-ui","#7d849e");write("肤色光谱",726,612,"700 28px system-ui","#f2d4b3");tonePalette.forEach((tone,index)=>{const col=index%6,row=Math.floor(index/6),x=726+col*44,y=642+row*18;ctx.fillStyle=tone.color;ctx.beginPath();ctx.roundRect(x,y,38,13,3);ctx.fill();if(tone.id===selectedToneId){ctx.strokeStyle="#ffffff";ctx.lineWidth=2;ctx.stroke();ctx.shadowColor="#f0bb79";ctx.shadowBlur=10;ctx.stroke();ctx.shadowBlur=0;}});write("中性偏暖 · 黄二白",726,804,"700 19px system-ui","#f5e3d2");write("24 色矩阵匹配 · 置信度 87%",726,825,"500 11px system-ui","#aab1c8");
    card(694,856,334,302,"#55d3ff");write("SEBUM MAP",726,897,"500 12px system-ui","#7d849e");write("分区油光",726,936,"700 28px system-ui","#7addff");if(oilFaceAsset){ctx.drawImage(oilFaceAsset,714,946,136,174);}write("整体平衡",872,992,"700 25px system-ui","#d9e9ff");write("鼻部 T 区偏油",872,1026,"600 16px system-ui","#ffda83");write(`前额 ${getOilZoneValue("forehead")}%`,872,1067,"500 14px system-ui","#9da6c1");write(`双颊 ${getOilZoneValue("cheeks")}%`,986,1067,"600 16px system-ui","#78ddff","right");write(`下巴 ${getOilZoneValue("chin")}%`,872,1106,"500 14px system-ui","#9da6c1");write(`鼻部 ${getOilZoneValue("tzone")}%`,986,1106,"600 16px system-ui","#ffda83","right");
    card(52,1190,976,350,"#8290ff");write("DAILY CARE GUIDE",84,1234,"500 13px system-ui","#8c7fd2");write("护理建议",84,1276,"700 29px system-ui");write("先修护，再进阶。优先稳定屏障并坚持防晒；眼周可搭配咖啡因，",84,1320,"400 20px system-ui","#c1c5d8");write("耐受稳定后，再循序加入胜肽等温和功效成分。",84,1354,"400 20px system-ui","#a8aec5");const ingredientDots=["#7d8cff","#55d5ff","#aa99ff","#72a0ff"];["神经酰胺","咖啡因","烟酰胺","胜肽"].forEach((item,index)=>{const x=84+index*220;ctx.fillStyle="#13172e";ctx.beginPath();ctx.roundRect(x,1390,190,42,13);ctx.fill();const edge=ctx.createLinearGradient(x,0,x+190,0);edge.addColorStop(0,"#8177ff70");edge.addColorStop(.55,"#ffffff14");edge.addColorStop(1,"#55d4ff55");ctx.strokeStyle=edge;ctx.lineWidth=1.4;ctx.stroke();ctx.save();ctx.shadowColor=ingredientDots[index];ctx.shadowBlur=10;ctx.fillStyle=ingredientDots[index];ctx.beginPath();ctx.arc(x+25,1411,4,0,Math.PI*2);ctx.fill();ctx.restore();write(item,x+105,1417,"500 15px system-ui","#dfe2ee","center")});write("成分建议仅作日常护肤参考，首次使用请局部测试；敏感肌、孕期或有明确过敏史者，建议咨询专业人士。",84,1472,"400 13px system-ui","#747d99");write("结果仅作日常护肤参考，不构成医疗诊断",84,1503,"400 13px system-ui","#636c88");
    write("图灵鉴 X · AI 肌肤检测",540,1635,"700 24px system-ui","#f1eff9","center");write("TURING SKIN LAB",540,1671,"500 13px system-ui","#737c98","center");
    const link=document.createElement("a");link.download=`AI皮肤说明书-${new Date().toISOString().slice(0,10)}.png`;link.href=canvas.toDataURL("image/png",1);link.click();
  };
  void downloadPosterStable;
  const downloadPosterV13=async()=>{
    const canvas=document.createElement("canvas");
    canvas.width=1080;canvas.height=1440;
    const ctx=canvas.getContext("2d");
    if(!ctx)return;
    const loadImage=(source:string)=>new Promise<HTMLImageElement|undefined>(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(undefined);image.src=source;});
    const [userPhoto,oilFaceAsset]=await Promise.all([loadImage(photoUrl),loadImage(OIL_FACE_ASSET)]);
    const background=ctx.createLinearGradient(0,0,0,1440);background.addColorStop(0,"#100b35");background.addColorStop(.52,"#090b23");background.addColorStop(1,"#040611");ctx.fillStyle=background;ctx.fillRect(0,0,1080,1440);
    const glow=ctx.createRadialGradient(840,120,12,840,120,500);glow.addColorStop(0,"#6554ff55");glow.addColorStop(.6,"#6554ff12");glow.addColorStop(1,"#6554ff00");ctx.fillStyle=glow;ctx.fillRect(300,0,780,620);
    const write=(value:string,x:number,y:number,font:string,color="#f7f5ff",align:CanvasTextAlign="left")=>{ctx.font=font;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline="alphabetic";ctx.fillText(value,x,y)};
    const card=(x:number,y:number,w:number,h:number,accent="#8d78ff")=>{ctx.save();ctx.shadowColor="#00000070";ctx.shadowBlur=28;ctx.shadowOffsetY=12;ctx.fillStyle="#0d1028f2";ctx.beginPath();ctx.roundRect(x,y,w,h,28);ctx.fill();ctx.restore();const edge=ctx.createLinearGradient(x,y,x+w,y+h);edge.addColorStop(0,accent+"aa");edge.addColorStop(.48,"#ffffff18");edge.addColorStop(1,"#55d4ff55");ctx.strokeStyle=edge;ctx.lineWidth=1.6;ctx.beginPath();ctx.roundRect(x+.8,y+.8,w-1.6,h-1.6,27);ctx.stroke();};
    const cover=(image:HTMLImageElement,x:number,y:number,w:number,h:number,r:number)=>{const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);const sw=w/scale,sh=h/scale,sx=(image.naturalWidth-sw)/2,sy=(image.naturalHeight-sh)/2;ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.clip();ctx.drawImage(image,sx,sy,sw,sh,x,y,w,h);const overlay=ctx.createLinearGradient(x,y,x,y+h);overlay.addColorStop(0,"#0b0c1b00");overlay.addColorStop(1,"#07091b8a");ctx.fillStyle=overlay;ctx.fillRect(x,y,w,h);ctx.restore();};

    write("图灵鉴 X",70,78,"700 30px system-ui");write("TURING AI · SKIN LAB",70,108,"500 13px system-ui","#8f97b5");write("我的皮肤说明书",1010,82,"700 38px system-ui","#ffffff","right");write("11 维肤况分析 · 个性护理建议",1010,111,"400 14px system-ui","#858eaa","right");

    card(52,138,976,250,"#a58fff");
    ctx.fillStyle="#15162d";ctx.beginPath();ctx.roundRect(80,162,218,202,20);ctx.fill();if(userPhoto)cover(userPhoto,80,162,218,202,20);else{const photoGlow=ctx.createLinearGradient(80,162,298,364);photoGlow.addColorStop(0,"#6b5bff44");photoGlow.addColorStop(1,"#203c5d55");ctx.fillStyle=photoGlow;ctx.fillRect(80,162,218,202);}write("本次检测照片 · 隐私保护",189,348,"500 11px system-ui","#e5e6ef","center");
    write("综合肤质分",340,184,"500 14px system-ui","#aab2c9");write("76",338,282,"700 94px system-ui");write("/100",463,278,"500 17px system-ui","#848ca9");write("清透微光肌",340,326,"700 31px system-ui","#ffdc8a");write("整体肤况良好，光泽与洁净度表现突出。",340,357,"400 16px system-ui","#c6cada");["混合偏干","修护维稳","T 区偏油"].forEach((item,index)=>{const bx=708+index*92;ctx.fillStyle="#171932";ctx.beginPath();ctx.roundRect(bx,246,82,31,16);ctx.fill();write(item,bx+41,267,"500 11px system-ui","#d6d3e4","center")});

    card(52,414,590,600,"#8f79ff");write("11D SKIN MAP",82,456,"500 12px system-ui","#9184dd");write("11 维肌肤雷达图",82,493,"700 26px system-ui");write("暖色点位优先关注",612,490,"400 12px system-ui","#8790ad","right");
    const cx=347,cy=746,outer=162;
    for(let ring=1;ring<=5;ring++){ctx.beginPath();metrics.forEach((_,index)=>{const angle=-Math.PI/2+index*Math.PI*2/metrics.length,rr=outer*ring/5,px=cx+Math.cos(angle)*rr,py=cy+Math.sin(angle)*rr;if(index)ctx.lineTo(px,py);else ctx.moveTo(px,py)});ctx.closePath();ctx.strokeStyle=ring===5?"#8f79ff66":"#8f79ff20";ctx.lineWidth=1.5;ctx.stroke();}
    const radarPoints=metrics.map((item,index)=>{const angle=-Math.PI/2+index*Math.PI*2/metrics.length;return [cx+Math.cos(angle)*outer*item.score/10,cy+Math.sin(angle)*outer*item.score/10] as const});
    metrics.forEach((item,index)=>{const angle=-Math.PI/2+index*Math.PI*2/metrics.length;const ox=cx+Math.cos(angle)*outer,oy=cy+Math.sin(angle)*outer;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ox,oy);ctx.strokeStyle="#8877ff22";ctx.stroke();const rawX=cx+Math.cos(angle)*220,rawY=cy+Math.sin(angle)*220;const label=radarDisplayName(item.name);ctx.font="600 13px system-ui";const half=Math.max(ctx.measureText(label).width/2,31);const lx=Math.min(615-half,Math.max(78+half,rawX));const ly=Math.min(984,Math.max(548,rawY));write(label,lx,ly-4,"500 13px system-ui","#aeb6ce","center");write(item.score.toFixed(1),lx,ly+14,"700 14px system-ui",scoreLevelColors[getScoreLevel(item.score)],"center")});
    const radarGradient=ctx.createLinearGradient(cx-outer,cy-outer,cx+outer,cy+outer);radarGradient.addColorStop(0,"#a08eff7a");radarGradient.addColorStop(.5,"#6878ff9a");radarGradient.addColorStop(1,"#46d0ff70");ctx.beginPath();radarPoints.forEach(([px,py],index)=>index?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fillStyle=radarGradient;ctx.fill();ctx.strokeStyle="#c0b8ff";ctx.lineWidth=4;ctx.stroke();radarPoints.forEach(([px,py],index)=>{const color=scoreLevelColors[getScoreLevel(metrics[index].score)];ctx.save();ctx.shadowColor=color;ctx.shadowBlur=10;ctx.fillStyle=color;ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();ctx.restore()});

    card(662,414,366,198,"#e0ac7e");write("CHROMA PROFILE",690,452,"500 11px system-ui","#8d8293");write("肤色结果",690,485,"700 23px system-ui","#f3e4d4");write("87% 匹配",998,480,"600 12px system-ui","#d8c7b4","right");ctx.fillStyle=selectedTone.color;ctx.beginPath();ctx.roundRect(690,512,92,62,13);ctx.fill();ctx.strokeStyle="#ffffffaa";ctx.lineWidth=2;ctx.stroke();write("暖黄调 · 黄二白",805,535,"700 18px system-ui","#f5e5d4");write("底妆优先试暖黄调二白",805,562,"400 12px system-ui","#a6adbf");

    card(662,630,366,384,"#55d3ff");write("SEBUM MAP",690,668,"500 11px system-ui","#7e89a7");write("油光结果",690,701,"700 23px system-ui","#81e2ff");write("T 区 78% · 偏油",998,697,"600 13px system-ui","#ffcf76","right");if(oilFaceAsset)ctx.drawImage(oilFaceAsset,684,720,112,150);oilZones.forEach((zone,index)=>{const y=752+index*48;write(zone.label,820,y,"500 13px system-ui","#bdc4d6");write(zone.value+"%",997,y,"700 14px system-ui",getOilLevel(zone.value)==="oily"?"#ffcf76":"#7dddff","right");ctx.fillStyle="#ffffff0b";ctx.beginPath();ctx.roundRect(820,y+9,177,6,3);ctx.fill();const bar=ctx.createLinearGradient(820,0,997,0);bar.addColorStop(0,"#4fd7d0");bar.addColorStop(.7,"#8e7cff");bar.addColorStop(1,"#ffbe69");ctx.fillStyle=bar;ctx.beginPath();ctx.roundRect(820,y+9,177*zone.value/100,6,3);ctx.fill();});write("整体平衡，建议 T 区分区清洁。",690,982,"400 12px system-ui","#838ca8");

    card(52,1038,976,248,"#8d85ff");write("DAILY CARE GUIDE",84,1077,"500 11px system-ui","#8c82cc");write("你的三步护理节奏",84,1112,"700 25px system-ui");const careSteps=[["01","先修护屏障","神经酰胺打底，减少刺激叠加。"],["02","改善眼周与暗沉","咖啡因与低浓度烟酰胺。"],["03","循序温和抗老","状态稳定后再加入胜肽。"]] as const;careSteps.forEach(([rank,title,copy],index)=>{const x=84+index*305;ctx.fillStyle="#151831";ctx.beginPath();ctx.roundRect(x,1136,278,82,16);ctx.fill();write(rank,x+18,1165,"700 14px system-ui",index===0?"#ffcc6f":"#8c83d7");write(title,x+55,1165,"700 15px system-ui");write(copy,x+18,1197,"400 11px system-ui","#8f98b3")});write("建议仅作日常护肤参考，首次使用请局部测试；敏感肌、孕期或有明确过敏史者，建议咨询专业人士。",84,1255,"400 11px system-ui","#68728f");
    write("图灵鉴 X · AI 肌肤检测",540,1368,"700 21px system-ui","#f1eff9","center");write("结果仅作日常护肤参考，不构成医疗诊断",540,1396,"400 11px system-ui","#6f7894","center");
    const link=document.createElement("a");link.download=`AI皮肤说明书-${new Date().toISOString().slice(0,10)}.png`;link.href=canvas.toDataURL("image/png",1);link.click();
  };

  return <main className="stage"><section className="phone-shell" aria-label="AI肌肤检测移动端原型">
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <header className="app-header" inert={commerceView || checkoutProduct || menu || appView !== "chat" ? true : undefined} aria-hidden={Boolean(commerceView || checkoutProduct || menu || appView !== "chat")}><button className="icon-button menu" aria-label="打开菜单" onClick={openMenu}><i/><i/><i/></button><div className="brand-title"><span className="brand-star">✦</span><div><strong>AI 肌肤检测</strong><small>TURING SKIN LAB</small></div></div><button className="app-header-balance" aria-label="返回首页" onClick={()=>{setMenu(false);(window as any).jianxNavigate('home');}}>⌂</button></header>
    <div className="conversation" ref={scrollRef} inert={commerceView || checkoutProduct || menu || appView !== "chat" ? true : undefined} aria-hidden={Boolean(commerceView || checkoutProduct || menu || appView !== "chat")}>
      <section className="welcome-card intro-stream skin-hero"><div className="skin-hero-main"><div className="skin-hero-copy"><div className="skin-hero-kicker"><i/> 肌肤光谱解析</div><h1>读懂肌肤的<br/><span>每一寸微光</span></h1></div><div className="skin-spectrum" aria-hidden="true"><div className="spectrum-scan"/><div className="spectrum-ring ring-one"/><div className="spectrum-ring ring-two"/><div className="spectrum-orbit orbit-one"><i/><i/></div><div className="spectrum-orbit orbit-two"><i/><i/></div><div className="spectrum-orbit orbit-three"><i/></div><div className="spectrum-core"><b>SKIN</b><small>光谱检测</small></div><div className="spectrum-reticle"><i/><i/><i/><i/></div></div></div><p className="skin-hero-description">让镜头捕捉肌肤此刻的光与纹理，一张清晰正脸照，即可开启 11 维深度解析，解锁你的专属皮肤说明书。</p><div className="feature-pills"><span>智能检测</span><span>隐私保护</span><span>科学建议</span></div><button className="primary-cta" type="button" onClick={()=>setSheet(true)}><span>＋</span> 开启肌肤光谱检测</button><div className="skin-hero-stats"><span><b>11</b>项肤况维度</span><span><b>68</b>个定位点</span><span><b>1</b>份专属报告</span></div><p className="privacy-note">我们将对您的信息做加密隐私处理，开启检测即代表您已阅读并同意<br/><span>《皮肤检测用户协议及隐私政策》</span></p></section>
      {flow!=="idle"&&<div className="user-photo-row"><button type="button" className="user-photo" onClick={()=>setPrivacy(true)}><img src={photoUrl} alt="已上传的正脸照片"/><span>点击查看原图</span><i>隐私模糊</i></button></div>}
      {flow==="checking"&&<div className="ai-status-line"><span className="typing"><i/><i/><i/></span>正在检查照片是否符合检测要求…</div>}
      {flow==="error"&&<section className="error-inline"><span>照片暂时无法分析</span><p>{errorText}</p><button onClick={()=>setSheet(true)} type="button">重新上传照片</button></section>}
      {flow==="scanning"&&<section className="analysis-card stream-card"><div className="analysis-head"><div><span>LIVE ANALYSIS</span><h3>正在进行面部科学分析</h3></div><b>{progress}%</b></div><FaceVisual photoUrl={photoUrl} scanning/><div className="analysis-status"><span><i/> {statuses[statusIndex]}</span><b>{String(statusIndex+1).padStart(2,"0")} / 05</b></div><div className="analysis-track"><i style={{width:`${progress}%`}}/></div><small>请稍候，AI 正在构建你的专属肌肤数据</small></section>}
      {flow==="report"&&<><Reveal className="analysis-card complete stream-card"><div className="analysis-head"><div><span>ANALYSIS COMPLETE</span><h3>面部检测点已完成检测</h3></div><b>✓</b></div><FaceVisual photoUrl={photoUrl} annotated/>{landmarksComplete&&<p className="scan-caption">已定位 11 项肌肤指标 · 完整报告如下</p>}</Reveal>{landmarksComplete&&<ReportCard onPoster={()=>setPoster(true)} step={reportStep} onJumpProduct={jumpToProduct} activeProductId={activeProductId} onSelectProduct={setActiveProductId} onProductDetail={openProductDetail} onProductBuy={openProductCheckout} onExploreProducts={exploreAllProducts} productSectionRef={productSectionRef} commerceSuspended={Boolean(sheet || menu || privacy || poster || commerceView || checkoutProduct || appView !== "chat")} reportSaveStatus={experience.error && reportSaveStatus === "idle" ? "error" : reportSaveStatus} onOpenHistory={openSkinManagement} onRetrySave={()=>{if(experience.ready)void saveReport();else void experience.reload();}}/>}</>}
      {chatText&&<><div className="text-message">{chatText}</div><div className="ai-plain-text">我记下了。你可以上传一张正脸照开始检测；报告会结合当前状态给出更具体的护理方向。</div></>}
    </div>
    <footer className="composer" inert={commerceView || checkoutProduct || menu || appView !== "chat" ? true : undefined} aria-hidden={Boolean(commerceView || checkoutProduct || menu || appView !== "chat")}><div className="composer-box"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send()}} placeholder="上传照片或聊聊你的肌肤状态…"/><div className="composer-actions"><button type="button" onClick={()=>setSheet(true)}>▣ <span>照片</span></button><button type="button" onClick={()=>setSheet(true)}>✦ <span>AI 鉴肤</span></button><button className="send" type="button" onClick={send} aria-label="发送">➤</button></div></div><small>结果仅作日常护肤参考，不构成医疗诊断</small></footer>
    <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload}/><input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={upload}/>
    {sheet&&<dialog open className="sheet-backdrop"><div className="action-sheet"><div className="sheet-handle"/><div className="sheet-title"><b>上传正脸照片</b><span>请选择清晰、无遮挡、光线均匀的照片</span></div><div className="upload-options"><button onClick={()=>fileRef.current?.click()} type="button"><i>▧</i><span><b>从相册选择</b><small>支持 JPG、PNG、HEIC</small></span><em>›</em></button><button onClick={()=>cameraRef.current?.click()} type="button"><i>◎</i><span><b>拍摄照片</b><small>调用前置相机拍摄</small></span><em>›</em></button><button onClick={()=>begin()} type="button"><i>✦</i><span><b>体验示例分析</b><small>使用合成素材体验完整流程</small></span><em>›</em></button></div><div className="demo-states"><span>异常状态演示</span><div><button onClick={()=>showError("multi")}>多人脸</button><button onClick={()=>showError("cover")}>有遮挡</button><button onClick={()=>showError("blur")}>不清晰</button></div></div><button className="sheet-cancel" onClick={()=>setSheet(false)} type="button">取消</button></div></dialog>}
    {appView==="skin"&&<SkinManagement key={skinEntry} initialView={skinEntry} onBack={returnFromSkin} onStartTest={startFreshSkinTest} onOpenMenu={openMenu} inactive={menu || Boolean(checkoutProduct)} records={experience.reports} recordsLoading={!experience.ready && !experience.error} recordsError={experience.error} onReloadRecords={experience.reload} onPurchase={startCheckout}/>}
    {appView === "orders" && <OrderCenter key={orderEntryId ?? "orders"} orders={experience.orders} initialId={orderEntryId} loading={!experience.ready && !experience.error} error={experience.error} onReload={experience.reload} onBack={()=>setAppView(orderReturnView.current)} onOpenMenu={openMenu} onShop={exploreAllProducts} onPay={payOrder} onReceive={async id=>{await experience.mutate("receive", id);}} onRead={readOrder} inactive={menu}/>}
    {appView === "payment" && paymentOrder && <PaymentSuccess order={paymentOrder} onOrders={()=>openOrders(paymentOrder.id)} onChat={returnAfterPayment}/>}
    <AppSidebar open={menu} activeArea={appView === "payment" ? "orders" : appView} hasOrder={experience.orders.length > 0} hasUnreadOrder={experience.orders.some(item=>!item.readAt || item.readAt < item.updatedAt)} skinHighlight={skinHighlight} onOrders={()=>{dismissGuide();openOrders();}} onClose={closeMenu} onSkinManagement={openSkinManagement} onNewChat={reset}/>
    {guide && appView === "chat" && !menu && !commerceView && !checkoutProduct && <aside className="menu-coachmark" role="status"><strong>{guide === "skin" ? "你的肤质记录，在这里" : "订单进度，在这里继续查看"}</strong><p>{guide === "skin" ? "打开左上角菜单 → 皮肤管理，查看历史变化与适合你的产品。" : "打开左上角菜单 → 商品订单，查看核验、配送与收货进度。"}</p><button type="button" aria-label="知道了，关闭引导" onClick={dismissGuide}>×</button></aside>}
    {checkoutProduct && <OrderCheckout existingId={checkoutOrderId} product={checkoutProduct} ready={experience.ready} loadError={experience.error} onReload={experience.reload} onClose={()=>setCheckoutProduct(null)} onSubmit={(id,address)=>createOrder(id,true,address)} onSavePending={(id,address)=>createOrder(id,false,address)}/>}

    {privacy&&<div className="modal privacy-modal" role="dialog"><div className="privacy-card glow-card">{!clearPhoto?<><div className="lock-orbit">◇</div><h3>查看清晰原图？</h3><p>原图可能包含面部隐私信息。仅在当前设备短暂展示，关闭后会恢复模糊状态。</p><button className="primary-cta" onClick={()=>setClearPhoto(true)}>确认查看</button><button className="ghost-button" onClick={()=>setPrivacy(false)}>保持模糊</button></>:<><img src={photoUrl} alt="清晰原图预览"/><span>清晰原图 · 仅当前可见</span><button className="ghost-button" onClick={()=>{setPrivacy(false);setClearPhoto(false)}}>关闭并恢复模糊</button></>}</div></div>}
    {commerceView&&<CommerceSheet view={commerceView} product={getCommerceProduct(selectedProductId)} onClose={closeCommerce} onBack={()=>setCommerceView("detail")} onCheckout={()=>openProductCheckout(selectedProductId)} onSupport={()=>setCommerceView("support")}/>}
    {poster&&<Poster photoUrl={photoUrl} onClose={()=>setPoster(false)} onDownload={downloadPosterV13}/>}
  </section></main>;
}
