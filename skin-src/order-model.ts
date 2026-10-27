import { catalogProducts, type SkinDetectionRecord } from "./skin-data";
import { PRODUCT_SAMPLE_IMAGE } from "./product-assets";

export type ShippingAddress = { recipient: string; phone: string; address: string };
export function addressErrors(value: ShippingAddress) {
  return {
    recipient: !value.recipient.trim() || value.recipient.trim().length > 30 ? "请填写 1–30 字收货人姓名" : "",
    phone: !/^1[3-9]\d{9}$/.test(value.phone.trim()) ? "请填写正确的 11 位手机号码" : "",
    address: value.address.trim().length < 8 || value.address.trim().length > 160 ? "请填写完整省市区及详细地址（8–160 字）" : "",
  };
}
export function validShippingAddress(value: unknown): value is ShippingAddress {
  if (!value || typeof value !== "object") return false;
  const address = value as ShippingAddress;
  return ["recipient", "phone", "address"].every(key => typeof address[key as keyof ShippingAddress] === "string") && !Object.values(addressErrors(address)).some(Boolean);
}
export function maskedShippingAddress(value: ShippingAddress) {
  return { recipient: value.recipient.trim().slice(0, 1) + "**", phone: value.phone.trim().slice(0, 3) + "****" + value.phone.trim().slice(-4), address: "收货地址已校验 · 预览仅保留脱敏信息", addressComplete: true };
}
export type OrderProduct = { id: string; name: string; size: string; price: number; image: string };
export type OrderState = "pending_payment" | "awaiting_check" | "center_received" | "verifying" | "ready_to_ship" | "shipped" | "received" | "exception";
export type OrderEvent = { state: OrderState; at: string; note: string };
export type ShopOrder = {
  id: string; orderNo: string; product: OrderProduct; state: OrderState; createdAt: string; updatedAt: string;
  recipient: string; phone: string; address: string; events: OrderEvent[]; readAt?: string;
  verificationNo?: string; trackingNo?: string; carrier?: string; receivedAt?: string; sample?: boolean; addressComplete?: boolean;
};
export const orderStates: Record<OrderState, { title: string; note: string; next: string; phase: number; tone: string }> = {
  pending_payment: { title: "待支付", note: "订单已创建，付款后开始送检。", next: "完成付款，开启发货前核验", phase: 0, tone: "gold" },
  awaiting_check: { title: "待送检", note: "已收到付款，商品等待送往鉴定中心。", next: "鉴定中心收货后将更新进度", phase: 1, tone: "violet" },
  center_received: { title: "鉴定中心已收货", note: "商品已到达鉴定中心，等待安排核验。", next: "接下来核对商品信息及包装", phase: 1, tone: "blue" },
  verifying: { title: "核验中", note: "正在核对商品、批号效期与包装完整性。", next: "核验结果将在此更新", phase: 1, tone: "violet" },
  ready_to_ship: { title: "核验通过 · 待发货", note: "本次核验已完成，商品等待交付物流。", next: "发货后可查看物流进度", phase: 2, tone: "blue" },
  shipped: { title: "已发货", note: "商品已交付物流，请留意包裹动态。", next: "收到商品后，请手动确认收货", phase: 2, tone: "blue" },
  received: { title: "已收货", note: "你已确认收到商品，本次订单已完成。", next: "订单与核验记录将继续保留", phase: 3, tone: "mint" },
  exception: { title: "客服处理中", note: "订单流程暂缓，请联系人工客服了解情况。", next: "处理结果将在订单中更新", phase: 1, tone: "amber" },
};
export const orderFilters = ["全部", "待付款", "待发货", "待收货", "已完成", "售后"] as const;
export type OrderFilter = typeof orderFilters[number];
export function matchesOrderFilter(order: ShopOrder, filter: OrderFilter) {
  return filter === "全部" || ({ "待付款": ["pending_payment"], "待发货": ["awaiting_check", "center_received", "verifying", "ready_to_ship"], "待收货": ["shipped"], "已完成": ["received"], "售后": ["exception"] }[filter] as string[]).includes(order.state);
}
export const reportOrderProducts: OrderProduct[] = [
  { id: "ceramide", name: "神经酰胺屏障修护面霜", size: "15g 体验装", price: 59, image: PRODUCT_SAMPLE_IMAGE },
  { id: "caffeine", name: "咖啡因焕活眼部精华", size: "10ml 体验装", price: 69, image: PRODUCT_SAMPLE_IMAGE },
  { id: "niacinamide", name: "低浓度烟酰胺焕亮精华", size: "15ml 体验装", price: 79, image: PRODUCT_SAMPLE_IMAGE },
  { id: "peptide", name: "多肽弹润紧致精华", size: "15ml 体验装", price: 89, image: PRODUCT_SAMPLE_IMAGE },
];
export function resolveOrderProduct(id: string): OrderProduct | undefined {
  const item = [...reportOrderProducts, ...catalogProducts].find(product => product.id === id);
  if (!item) return;
  return { id: item.id, name: item.name, size: item.size, price: item.price, image: item.image };
}
export function advanceOrder(order: ShopOrder, action: "pay" | "receive", now: string): ShopOrder {
  const state: OrderState = action === "pay" ? "awaiting_check" : "received";
  if (order.state === state) return order; // Safe retry after an uncertain response.
  if (order.state !== (action === "pay" ? "pending_payment" : "shipped")) throw new Error("当前订单状态不支持此操作");
  if (action === "pay" && !order.sample && !order.addressComplete) throw new Error("请先填写并保存收货地址");
  return { ...order, state, updatedAt: now, ...(action === "receive" ? { receivedAt: now } : {}), events: [...order.events, { state, at: now, note: action === "pay" ? "模拟付款成功，等待送检" : "用户手动确认收货" }] };
}
export function reportSnapshot(id: string, now: string): SkinDetectionRecord {
  const date = new Date(now).toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
  return { id, date, shortDate: date.slice(5).replace("-", "/"), time: new Date(now).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }), score: 76, delta: 0, title: "清透微光肌", keywords: ["混合偏干", "修护维稳"], tone: "暖黄调 · 黄二白", toneColor: "#edc79a", oil: "T 区轻油 · 双颊偏干", advice: "优先温和修护，关注双颊泛红与眼周状态。", photo: "/skin-oil-face-v2.png", metrics: { shine: 91, pores: 87, barrier: 56, eye: 62 } };
}
export function sampleOrders(): ShopOrder[] {
  const normal: OrderState[] = (Object.keys(orderStates) as OrderState[]).filter(state => state !== "exception");
  return (Object.keys(orderStates) as OrderState[]).map((state, index) => {
    const events = (state === "exception" ? normal.slice(0, 4).concat("exception") : normal.slice(0, index + 1)).map((value, i) => ({ state: value, at: new Date(Date.UTC(2026, 8, 15, 2 + i)).toISOString(), note: value === "received" ? "用户手动确认收货（样例）" : orderStates[value].note }));
    const lastAt = events.at(-1)!.at;
    return { id: `sample-${state}`, orderNo: `DEMO202609${String(index + 1).padStart(4, "0")}`, product: reportOrderProducts[index % 4], state, createdAt: events[0].at, updatedAt: lastAt, recipient: "体验用户", phone: "138****0000", address: "演示收货地址 · 不用于真实配送", events, sample: true, ...(["ready_to_ship", "shipped", "received"].includes(state) ? { verificationNo: `SAMPLE-VR-${index + 1}` } : {}), ...(["shipped", "received"].includes(state) ? { trackingNo: `SAMPLE-WAYBILL-${index + 1}`, carrier: "演示物流" } : {}), ...(state === "received" ? { receivedAt: lastAt } : {}) };
  });
}
