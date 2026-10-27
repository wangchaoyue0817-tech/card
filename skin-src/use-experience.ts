"use client";

// Copy this file over app/use-experience.ts in the CLIENT PREVIEW build only.
// This is device-local demo storage, not authentication, payment, or fulfilment.
import { useCallback, useEffect, useState } from "react";
import type { SkinDetectionRecord } from "./skin-data";
import {
  advanceOrder, maskedShippingAddress, orderStates, reportSnapshot,
  resolveOrderProduct, validShippingAddress,
  type ShopOrder, type ShippingAddress,
} from "./order-model";

export const EXPERIENCE_STORAGE_KEY = "jianx.unified.skin-experience.v1";
const STORAGE_LOCK = `${EXPERIENCE_STORAGE_KEY}.write`;
type Snapshot = { version: 1; orders: ShopOrder[]; reports: SkinDetectionRecord[] };
type StoragePort = Pick<Storage, "getItem" | "setItem">;
type OrderAction = "create" | "address" | "pay" | "receive" | "read";
type ExperienceMutation = {
  (action: "report", id: string, productId?: string, shippingAddress?: ShippingAddress): Promise<SkinDetectionRecord>;
  (action: OrderAction, id: string, productId?: string, shippingAddress?: ShippingAddress): Promise<ShopOrder>;
  (action: string, id: string, productId?: string, shippingAddress?: ShippingAddress): Promise<SkinDetectionRecord | ShopOrder>;
};

function sorted(snapshot: Snapshot): Snapshot {
  return {
    version: 1,
    orders: [...snapshot.orders].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    reports: [...snapshot.reports].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringFields(value: Record<string, unknown>, keys: string[]) {
  return keys.every(key => typeof value[key] === "string");
}

function numberFields(value: Record<string, unknown>, keys: string[]) {
  return keys.every(key => typeof value[key] === "number" && Number.isFinite(value[key]));
}

function validSnapshot(value: unknown): value is Snapshot {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.orders) || !Array.isArray(value.reports)) return false;
  return value.orders.every(item => isRecord(item)
    && stringFields(item, ["id", "orderNo", "createdAt", "updatedAt", "recipient", "phone", "address"])
    && typeof item.state === "string" && Object.hasOwn(orderStates, item.state)
    && isRecord(item.product) && stringFields(item.product, ["id", "name", "size", "image"])
    && typeof item.product.price === "number" && Number.isFinite(item.product.price)
    && Array.isArray(item.events) && item.events.every(event => isRecord(event)
      && typeof event.state === "string" && Object.hasOwn(orderStates, event.state)
      && typeof event.at === "string" && typeof event.note === "string"))
    && value.reports.every(item => isRecord(item)
      && stringFields(item, ["id", "date", "shortDate", "time", "title", "tone", "toneColor", "oil", "advice", "photo"])
      && numberFields(item, ["score", "delta"])
      && Array.isArray(item.keywords) && item.keywords.every(keyword => typeof keyword === "string")
      && isRecord(item.metrics) && numberFields(item.metrics, ["shine", "pores", "barrier", "eye"]));
}

// Dependency injection keeps the mutation rules independently testable.
// Empty means genuinely empty: never import or seed sampleOrders().
export function createLocalExperienceStore(storage: StoragePort, clock = () => new Date().toISOString()) {
  function load(): Snapshot {
    let raw: string | null;
    try { raw = storage.getItem(EXPERIENCE_STORAGE_KEY); }
    catch { throw new Error("浏览器禁止本地存储，预览记录暂时无法加载。"); }
    if (raw === null) return { version: 1, orders: [], reports: [] };
    let value: unknown;
    try { value = JSON.parse(raw); }
    catch { throw new Error("本地预览记录格式异常，未覆盖原数据。"); }
    if (!validSnapshot(value)) throw new Error("本地预览记录版本或格式不兼容，未覆盖原数据。");
    return sorted(value);
  }

  function mutate(action: string, id: string, productId?: string, shippingAddress?: ShippingAddress) {
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id)) throw new Error("记录编号无效");
    // Always read current disk state, not a potentially stale React closure.
    const snapshot = load();
    const order = snapshot.orders.find(item => item.id === id);
    const report = snapshot.reports.find(item => item.id === id);
    const now = clock();
    let result: ShopOrder | SkinDetectionRecord;

    if (action === "report" || action === "create") {
      if (order || report) {
        if ((action === "report" && order) || (action === "create" && report)) throw new Error("记录类型不匹配");
        return { result: (order ?? report)!, snapshot };
      }
      if (action === "report") {
        result = reportSnapshot(id, now);
        snapshot.reports.push(result);
      } else {
        const product = productId ? resolveOrderProduct(productId) : undefined;
        if (!product) throw new Error("商品暂不可用");
        result = {
          id, orderNo: `TG${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`,
          product, state: "pending_payment", createdAt: now, updatedAt: now,
          recipient: "未填写", phone: "", address: "请填写收货地址", addressComplete: false,
          events: [{ state: "pending_payment", at: now, note: "演示订单已创建" }],
        } satisfies ShopOrder;
        snapshot.orders.push(result);
      }
    } else {
      if (!order) throw new Error("未找到订单");
      if (action === "read") {
        result = { ...order, readAt: [order.readAt, now].filter((value): value is string => Boolean(value)).sort().at(-1) };
      } else if (action === "address") {
        if (order.state !== "pending_payment") throw new Error("当前状态不支持修改地址");
        if (!validShippingAddress(shippingAddress)) throw new Error("请填写完整收货人、正确手机号和详细地址");
        // Raw shipping fields are validated in memory and NEVER persisted.
        result = { ...order, ...maskedShippingAddress(shippingAddress), updatedAt: now };
      } else if (action === "pay" || action === "receive") {
        if (action === "pay" && order.state === "pending_payment" && !order.addressComplete) throw new Error("请先填写并保存收货地址");
        try { result = advanceOrder(order, action, now); }
        catch { throw new Error("订单状态已变化，请刷新后重试。"); }
      } else {
        throw new Error("操作无效");
      }
      snapshot.orders = snapshot.orders.map(item => item.id === id ? result as ShopOrder : item);
    }

    const next = sorted(snapshot);
    try { storage.setItem(EXPERIENCE_STORAGE_KEY, JSON.stringify(next)); }
    catch { throw new Error("本地记录未保存：存储不可用或空间不足，请重试。"); }
    return { result, snapshot: next };
  }
  return { load, mutate };
}

function browserStore() {
  try { return createLocalExperienceStore(window.localStorage); }
  catch { throw new Error("浏览器禁止本地存储，预览记录暂时无法加载。"); }
}

export function useExperience() {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [reports, setReports] = useState<SkinDetectionRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const publish = useCallback((snapshot: Snapshot) => {
    setOrders(snapshot.orders); setReports(snapshot.reports); setReady(true); setError("");
  }, []);
  const reload = useCallback(async () => {
    try { publish(browserStore().load()); }
    catch (issue) {
      setReady(false);
      setError(issue instanceof Error ? issue.message : "记录暂时无法加载");
    }
  }, [publish]);

  useEffect(() => {
    void reload();
    const onStorage = (event: StorageEvent) => {
      if (event.key === EXPERIENCE_STORAGE_KEY || event.key === null) void reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [reload]);

  const mutate = useCallback(async (action: string, id: string, productId?: string, shippingAddress?: ShippingAddress) => {
    if (!ready) throw new Error("请先加载记录后重试");
    const commit = () => {
      const changed = browserStore().mutate(action, id, productId, shippingAddress);
      publish(changed.snapshot);
      return changed.result;
    };
    try {
      // A single iframe is synchronous; Web Locks also serializes other tabs.
      return typeof navigator !== "undefined" && navigator.locks
        ? await navigator.locks.request(STORAGE_LOCK, commit)
        : commit();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "保存失败，请重试");
      throw issue;
    }
  }, [ready, publish]) as ExperienceMutation;

  return { orders, reports, ready, error, reload, mutate };
}
