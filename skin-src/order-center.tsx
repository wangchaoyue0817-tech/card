"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Bag, Check, CheckCircle, Clock, Copy, Headset, List, MapPin, Package, ShieldCheck, Sparkle, Truck, WarningCircle, X } from "@phosphor-icons/react";
import { CustomerSupport } from "./product-experience";
import { addressErrors, validShippingAddress, type ShippingAddress, advanceOrder, matchesOrderFilter, orderFilters, orderStates, sampleOrders, type OrderFilter, type OrderProduct, type ShopOrder } from "./order-model";

const time = (value: string) => new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" });

function OrderModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { if (!previous?.closest('[inert], [aria-hidden="true"]')) previous?.focus(); };
  }, []);
  return <dialog className="order-dialog" ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}><header><h2>{title}</h2><button className="order-icon-button" type="button" aria-label="关闭" onClick={onClose}><X size={21}/></button></header>{children}</dialog>;
}

export function OrderCheckout({ product, existingId, ready, loadError, onReload, onClose, onSubmit, onSavePending }: { product: OrderProduct; existingId?: string; ready: boolean; loadError: string; onReload: () => void; onClose: () => void; onSubmit: (id: string, address: ShippingAddress) => Promise<void>; onSavePending: (id: string, address: ShippingAddress) => Promise<void> }) {
  const idRef = useRef(existingId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [address, setAddress] = useState<ShippingAddress>({ recipient: "", phone: "", address: "" });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [touched, setTouched] = useState(false);
  const issues = addressErrors(address);
  const valid = validShippingAddress(address);
  const update = (key: keyof ShippingAddress, value: string) => { setSaved(false); setAddress(current => ({ ...current, [key]: value })); };
  const submit = async (pay: boolean) => {
    if (busy || !ready || !saved || !valid) return;
    idRef.current ||= crypto.randomUUID();
    setBusy(true); setError("");
    try { await (pay ? onSubmit : onSavePending)(idRef.current, address); } catch (issue) { setError(issue instanceof Error ? issue.message : "请稍后重试"); } finally { setBusy(false); }
  };
  return <OrderModal title="确认订单" onClose={() => { if (!busy) onClose(); }}>
    <ProductSummary product={product}/>
    <section className={`checkout-address ${saved ? "is-complete" : "is-required"}`} aria-label="收货地址">
      <button className="checkout-address-heading" type="button" onClick={() => { setEditing(!editing); }} disabled={busy} aria-expanded={editing}>
        <MapPin size={23} weight="duotone"/><span><strong>{saved ? "收货地址已完善" : "请添加收货地址"}<em>{saved ? "已校验" : "必填"}</em></strong><small>{saved ? `${address.recipient} · ${address.phone.slice(0,3)}****${address.phone.slice(-4)}` : "填写完整后，即可点亮支付按钮"}</small></span><span className="checkout-address-edit">{saved ? "修改" : "填写"} ›</span>
      </button>
      {saved && !editing && <p className="checkout-address-preview">{address.address}</p>}
      {editing && <div className="checkout-address-form">
        <div className="checkout-address-fields"><label>收货人<input value={address.recipient} maxLength={30} autoComplete="shipping name" disabled={busy} onChange={event => update("recipient",event.target.value)} aria-invalid={touched && !!issues.recipient} placeholder="收货人姓名"/>{touched && issues.recipient && <small>{issues.recipient}</small>}</label><label>手机号<input value={address.phone} maxLength={11} type="tel" inputMode="tel" autoComplete="shipping tel" disabled={busy} onChange={event => update("phone",event.target.value)} aria-invalid={touched && !!issues.phone} placeholder="11 位手机号码"/>{touched && issues.phone && <small>{issues.phone}</small>}</label></div>
        <label>详细地址<textarea value={address.address} maxLength={160} autoComplete="shipping street-address" rows={2} disabled={busy} onChange={event => update("address",event.target.value)} aria-invalid={touched && !!issues.address} placeholder="省 / 市 / 区、街道及门牌号"/>{touched && issues.address && <small>{issues.address}</small>}</label>
        <div className="checkout-address-tools"><button type="button" disabled={busy} onClick={() => { setAddress({recipient:"体验用户",phone:"13800000000",address:"上海市浦东新区示例路 100 号体验中心"}); setSaved(false); }}>使用示例地址</button><button className="order-button violet" type="button" disabled={busy} onClick={() => { setTouched(true); if (valid) { setSaved(true); setEditing(false); } }}>保存地址</button></div>
        <p className="checkout-privacy">预览可使用示例地址，仅保存脱敏信息，不用于真实配送。</p>
      </div>}
    </section>
    <div className="order-checkout-promise checkout-assurance"><span className="checkout-assurance-icon"><ShieldCheck size={26} weight="duotone"/></span><div><strong>先鉴定，再发货</strong><p>付款后进入送检流程，核验与配送进度<br/>可在侧边栏「商品订单」中查看。</p><span className="checkout-assurance-path">送检 <i>→</i> 核验 <i>→</i> 发货</span></div></div>
    <dl className="order-facts"><div><dt>商品金额</dt><dd>¥{product.price}</dd></div><div><dt>运费</dt><dd>¥0</dd></div><div className="order-total"><dt>合计</dt><dd>¥{product.price}</dd></div></dl>
    {(error || loadError) && <p className="order-error" role="alert">{error || loadError}<button type="button" onClick={onReload}>重新加载</button></p>}
    <button className="order-button gold wide" type="button" disabled={!ready || busy || !saved || !valid} onClick={() => void submit(true)}>{busy ? "正在处理…" : !saved || !valid ? "请先完善收货地址" : `确认模拟支付 · ¥${product.price}`}</button>
    <button className="order-text-button wide" type="button" disabled={!ready || busy || !saved || !valid} onClick={() => void submit(false)}>先创建订单，稍后付款</button>
  </OrderModal>;
}

export function PaymentSuccess({ order, onOrders, onChat }: { order: ShopOrder; onOrders: () => void; onChat: () => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, []);
  return <section className="order-center payment-result" aria-label="支付结果"><div className="payment-result-content">
    <div className="payment-success-orbit"><CheckCircle size={52} weight="duotone"/></div>
    <p className="order-eyebrow">PAYMENT COMPLETE</p><h1 ref={title} tabIndex={-1}>模拟支付成功</h1><p className="payment-result-amount">¥<strong>{order.product.price}</strong></p>
    <p className="payment-result-description">商品等待送检<br/>后续核验与配送进度，都在商品订单里。</p>
    <div className="payment-next"><ShieldCheck size={26} weight="duotone"/><div><strong>下一步：送往鉴定中心</strong><span>核验通过后再为你发货</span></div></div>
    <div className="order-entry-path"><List size={16}/><span>侧边栏</span><span>›</span><Bag size={16}/><strong>商品订单</strong></div>
    <button className="order-button violet wide" type="button" onClick={onOrders}>查看订单进度<ArrowRight size={19}/></button>
    <button className="order-text-button wide" type="button" onClick={onChat}>返回对话</button>
    <p className="order-footnote">本次为模拟交易，未产生真实扣款。</p>
  </div></section>;
}

function ProductSummary({ product }: { product: OrderProduct }) {
  return <div className="order-product"><img src={product.image} alt={product.name} width={800} height={800}/><div><h3>{product.name}</h3><p>{product.size} <span>×1</span></p><strong>¥{product.price}</strong></div></div>;
}

function Progress({ order }: { order: ShopOrder }) {
  const phase = orderStates[order.state].phase;
  return <ol className="order-progress" aria-label="订单进度">{["付款", "核验", "发货", "收货"].map((name, index) => <li key={name} className={index < phase || order.state === "received" ? "complete" : index === phase ? "current" : ""} aria-current={index === phase ? "step" : undefined}><span>{index < phase || order.state === "received" ? <Check size={13} weight="bold"/> : index + 1}</span><b>{name}</b></li>)}</ol>;
}

function StateIcon({ order }: { order: ShopOrder }) {
  const Icon = order.state === "exception" ? WarningCircle : order.state === "received" ? CheckCircle : order.state === "shipped" ? Truck : order.state === "pending_payment" ? Clock : ShieldCheck;
  return <Icon size={30} weight="duotone"/>;
}

export function OrderCenter({ orders, initialId, loading, error: loadError, onReload, onBack, onOpenMenu, onShop, onPay, onReceive, onRead, inactive }: { orders: ShopOrder[]; initialId?: string; loading: boolean; error: string; onReload: () => void; onBack: () => void; onOpenMenu: () => void; onShop: () => void; onPay: (id: string) => Promise<void>; onReceive: (id: string) => Promise<void>; onRead: (id: string) => Promise<void>; inactive?: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  const [filter, setFilter] = useState<OrderFilter>("全部");
  const [sampleMode, setSampleMode] = useState(false);
  const [samples, setSamples] = useState(sampleOrders);
  const [overlay, setOverlay] = useState<"receive" | "logistics" | "report" | "support" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const order = (sampleMode ? samples : orders).find(item => item.id === selectedId);
  const visible = (sampleMode ? samples : orders).filter(item => matchesOrderFilter(item, filter));
  useEffect(() => { titleRef.current?.focus(); scrollRef.current?.scrollTo(0, 0); }, [selectedId, sampleMode]);
  useEffect(() => {
    if (selectedId && !sampleMode) void onRead(selectedId).catch(() => {});
  }, [selectedId, sampleMode, onRead]);
  const selectOrder = (item: ShopOrder) => { setError(""); setSelectedId(item.id); };
  const act = async (action: "pay" | "receive", item: ShopOrder) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (item.sample) setSamples(current => current.map(value => value.id === item.id ? advanceOrder(value, action, new Date().toISOString()) : value));
      else await (action === "pay" ? onPay : onReceive)(item.id);
      setOverlay(null);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "暂时无法操作，请重试"); } finally { setBusy(false); }
  };
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); setCopied("已复制"); } catch { setCopied("复制失败，请手动选择单号"); } };
  const openSupport = (item: ShopOrder) => { selectOrder(item); setOverlay("support"); };
  return <section className="order-center" aria-label="商品订单" inert={inactive ? true : undefined} aria-hidden={inactive}>
    <header className="order-header"><button className="order-icon-button" type="button" aria-label={selectedId ? "返回订单列表" : "返回上一页"} onClick={() => selectedId ? setSelectedId(null) : onBack()}><ArrowLeft size={21}/></button><div><small>TURING ORDERS</small><h1 ref={titleRef} tabIndex={-1}>{selectedId ? "订单详情" : "商品订单"}</h1></div><button className="order-icon-button" type="button" aria-label="打开功能导航" onClick={onOpenMenu}><List size={22}/></button></header>
    <div className="order-scroll" ref={scrollRef}>
      <div className="order-mode-bar"><span>{sampleMode ? "状态样例 · 非真实订单" : "演示订单 · 不会真实扣款"}</span><button type="button" onClick={() => { setSampleMode(!sampleMode); setSelectedId(null); setFilter("全部"); setError(""); }}>{sampleMode ? "返回我的订单" : "查看状态样例"}</button></div>
      {(error || loadError) && !overlay && <p className="order-error" role="alert">{error || loadError}<button type="button" onClick={onReload}>重试</button></p>}
      {selectedId && !order ? <div className="order-empty"><Package size={38}/><h2>{loading ? "正在加载订单" : "暂未找到这笔订单"}</h2><button className="order-button violet" onClick={onReload} type="button">重新加载</button></div> : order ? <>
        <section className={`order-status-hero ${orderStates[order.state].tone}`}><div className="order-status-top"><span className="order-status-icon"><StateIcon order={order}/></span><span className="order-status-stamp">{order.sample ? "流程样例" : "模拟交易"}</span></div><h2>{orderStates[order.state].title}</h2><p>{orderStates[order.state].note}</p><div className="order-next-line"><span>下一步</span><strong>{orderStates[order.state].next}</strong></div><Progress order={order}/></section>
        <details className="order-event-card"><summary><Clock size={18}/><span><b>完整流转记录</b><small>最近更新 {time(order.updatedAt)}</small></span><span className="order-disclosure-plus">+</span></summary><ol>{[...order.events].reverse().map((event, index) => <li key={`${event.state}-${event.at}`} className={index === 0 ? "latest" : ""}><i/><div><strong>{orderStates[event.state].title}</strong><p>{event.note}</p><time>{time(event.at)}</time></div></li>)}</ol></details>
        {order.verificationNo && <button type="button" className="order-proof-card" onClick={() => setOverlay("report")}><ShieldCheck size={27} weight="duotone"/><span><strong>图灵官方核验</strong><small>核验记录已生成{order.sample ? "（样例）" : ""}</small></span><b>查看记录</b></button>}
        {order.trackingNo && <button type="button" className="order-delivery-card" onClick={() => setOverlay("logistics")}><Truck size={25} weight="duotone"/><span><strong>{order.state === "received" ? "你已确认收货" : "包裹已发出"}</strong><small>{order.carrier} · 查看物流信息</small></span></button>}
        <section className="order-info-card"><ProductSummary product={order.product}/><dl className="order-facts"><div><dt>商品金额</dt><dd>¥{order.product.price}</dd></div><div><dt>运费</dt><dd>¥0</dd></div><div className="order-total"><dt>{order.state === "pending_payment" ? "应付金额" : "实付金额"}</dt><dd>¥{order.product.price}</dd></div></dl></section>
        <section className="order-info-card order-address"><MapPin size={21}/><div><strong>{order.recipient}<span>{order.phone}</span></strong><p>{order.address}</p></div></section>
        <section className="order-info-card"><h3 className="order-section-title">订单信息</h3><dl className="order-facts"><div><dt>订单编号</dt><dd className="order-copy-value">{order.orderNo}<button type="button" aria-label="复制订单编号" onClick={() => void copy(order.orderNo)}><Copy size={16}/></button></dd></div><div><dt>下单时间</dt><dd>{time(order.createdAt)}</dd></div>{order.receivedAt && <div><dt>确认收货</dt><dd>{time(order.receivedAt)} · 用户确认</dd></div>}<div><dt>交易方式</dt><dd>模拟支付</dd></div></dl>{copied && <small role="status">{copied}</small>}</section>
        <button className="order-support-row" type="button" onClick={() => setOverlay("support")}><Headset size={21}/><span><strong>需要帮助？</strong><small>订单、核验及配送问题，联系人工客服</small></span><span>联系客服</span></button>
        <p className="order-footnote">演示环境尚未接入真实支付、鉴定及物流服务。</p>
      </> : <>
        <div className="order-list-intro"><div><h2>每一步，都有记录</h2><p>从付款到收货，进度在这里查看</p></div><ShieldCheck size={32} weight="duotone"/></div>
        <nav className="order-filters" aria-label="按订单状态筛选">{orderFilters.map(item => <button type="button" key={item} aria-pressed={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</nav>
        {!visible.length ? <div className="order-empty"><Bag size={43} weight="duotone"/><h2>{loading && !sampleMode ? "正在加载订单" : filter === "全部" ? "还没有订单" : `暂无${filter}订单`}</h2><p>{filter === "全部" ? "选好适合自己的护理，进度会留在这里。" : "其他订单可在「全部」中查看。"}</p><button className="order-button violet" type="button" onClick={filter === "全部" ? onShop : () => setFilter("全部")}>{filter === "全部" ? "探索适合我的产品" : "查看全部订单"}</button></div> : <div className="order-list">{visible.map(item => <article className="order-list-card" key={item.id}>
          <button className="order-card-open" type="button" aria-label={`${item.product.name}，${orderStates[item.state].title}，查看订单详情`} onClick={() => selectOrder(item)}><div className="order-list-card-top"><time>{time(item.createdAt)}</time><strong className={orderStates[item.state].tone}>{orderStates[item.state].title}</strong></div><ProductSummary product={item.product}/><p className="order-latest-note"><i/>{item.events.at(-1)?.note}</p></button>
          <footer><span>共 1 件<b>{item.state === "pending_payment" ? "应付" : "实付"} ¥{item.product.price}</b></span><div>{item.state === "pending_payment" ? <button type="button" className="order-button gold" disabled={busy} onClick={() => void act("pay", item)}>去支付</button> : item.state === "exception" ? <button type="button" className="order-button subtle" onClick={() => openSupport(item)}>联系人工客服</button> : item.state === "shipped" ? <button type="button" className="order-button subtle" onClick={() => { selectOrder(item); setOverlay("logistics"); }}>查看物流</button> : <button type="button" className="order-button subtle" onClick={() => selectOrder(item)}>{item.state === "received" ? "订单详情" : "查看进度"}</button>}</div></footer>
        </article>)}</div>}
        <p className="order-footnote">核验与物流更新不进入对话页<br/>下次从侧边栏「商品订单」继续查看</p>
      </>}
    </div>
    {order && ["pending_payment", "shipped", "exception"].includes(order.state) && <footer className="order-action-bar"><button className="order-button subtle" type="button" onClick={() => setOverlay(order.state === "shipped" ? "logistics" : "support")}>{order.state === "shipped" ? "查看物流" : "联系客服"}</button><button className={`order-button ${order.state === "pending_payment" ? "gold" : "violet"}`} disabled={busy} type="button" onClick={() => order.state === "pending_payment" ? void act("pay", order) : setOverlay(order.state === "shipped" ? "receive" : "support")}>{order.state === "pending_payment" ? `去支付 · ¥${order.product.price}` : order.state === "shipped" ? "确认收货" : "查看处理情况"}</button></footer>}
    {overlay && order && <OrderModal title={overlay === "receive" ? "确认已收到商品？" : overlay === "logistics" ? "物流信息" : overlay === "report" ? "核验记录" : "人工客服"} onClose={() => { if (!busy) { setOverlay(null); setError(""); } }}>
      {overlay === "receive" ? <><div className="order-confirm-symbol"><Package size={34} weight="duotone"/></div><p className="order-confirm-copy">请确认包裹已经收到，再完成此操作。<br/>物流显示签收不会自动确认收货。</p><ProductSummary product={order.product}/>{error && <p className="order-error" role="alert">{error}</p>}<div className="order-dialog-actions"><button className="order-button subtle" type="button" disabled={busy} autoFocus onClick={() => setOverlay(null)}>暂不确认</button><button className="order-button violet" type="button" disabled={busy} onClick={() => void act("receive", order)}>{busy ? "正在确认…" : "已收到，确认收货"}</button></div></> : overlay === "support" ? <CustomerSupport productName={order.product.name} orderNo={order.orderNo}/> : overlay === "logistics" ? <><p className="order-demo-banner">物流样例 · 不代表真实运输轨迹</p><div className="order-checkout-promise"><Truck size={30}/><div><strong>{order.carrier ?? "暂无物流信息"}</strong><p>{order.trackingNo ?? "发货后显示单号"}</p></div></div>{order.trackingNo && <button className="order-text-button" type="button" onClick={() => void copy(order.trackingNo!)}><Copy size={16}/>复制单号</button>}<p className="order-footnote" role="status">{copied}</p><ol className="order-logistics-events">{order.events.filter(event => event.state === "shipped" || event.state === "received").reverse().map(event => <li key={event.state}><strong>{event.state === "received" ? "用户确认收货" : "商品已交付物流"}</strong><time>{time(event.at)}</time></li>)}</ol></> : <><p className="order-demo-banner">核验记录样例 · 非真实正品鉴定报告</p><div className="order-checkout-promise"><ShieldCheck size={35} weight="duotone"/><div><strong>核验通过</strong><p>{order.verificationNo}</p></div></div><ProductSummary product={order.product}/><ul className="order-check-list">{["商品信息核对", "批号与效期检查", "包装完整性检查"].map(text => <li key={text}><CheckCircle size={18}/>{text}<small>通过（样例）</small></li>)}</ul><p className="order-footnote">真实报告将在鉴定服务接入后展示。</p></>}
    </OrderModal>}
  </section>;
}

export function ReportSavedEntry({ status, onOpen, onRetry }: { status: "idle" | "saving" | "saved" | "error"; onOpen: () => void; onRetry: () => void }) {
  return <section className="report-saved-entry" aria-label="皮肤管理入口"><Sparkle size={17} weight="duotone"/><div><strong>{status === "saved" ? "报告已记入皮肤管理" : status === "error" ? "报告未保存，请重试" : "正在保存报告…"}</strong><small>侧边栏可回看肤质变化</small></div><button className="report-saved-link" type="button" onClick={status === "error" ? onRetry : onOpen} disabled={status === "saving" || status === "idle"}>{status === "error" ? "重试" : "查看"}<ArrowRight size={14}/></button></section>;
}
