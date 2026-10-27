import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

// Normal location: <project>/tests/jianx-skin-store.test.mjs.
// The override only supports running this portable artifact before copying it.
const projectRoot = process.env.JIANX_TEST_ROOT || fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(join(projectRoot, "package.json"));
const { build } = require("esbuild");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "jianx-skin-store-test-"));
const cleanup = () => rm(temporaryDirectory, { recursive: true, force: true });
after(cleanup);

try {
  // Bundle actual source and its actual model; no mocked adapter or API rules.
  // Build writes only into this freshly allocated test-owned temporary folder.
  await build({
    entryPoints: [join(projectRoot, "skin-src/use-experience.ts"), join(projectRoot, "skin-src/order-model.ts")],
    outdir: temporaryDirectory,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    logLevel: "silent",
  });
} catch (error) {
  await cleanup();
  throw error;
}

const { createLocalExperienceStore, EXPERIENCE_STORAGE_KEY } = await import(pathToFileURL(join(temporaryDirectory, "use-experience.mjs")));
const { advanceOrder, reportSnapshot, resolveOrderProduct, maskedShippingAddress } = await import(pathToFileURL(join(temporaryDirectory, "order-model.mjs")));

const IDS = {
  report: "11111111-1111-4111-8111-111111111111",
  order: "22222222-2222-4222-8222-222222222222",
  second: "33333333-3333-4333-8333-333333333333",
  third: "44444444-4444-4444-8444-444444444444",
};
const ADDRESS = { recipient: "测试收件人", phone: "13800138000", address: "上海市测试区测试街道一号测试门牌" };

function fixture() {
  const entries = new Map();
  let time = "2026-09-21T12:00:00.000Z";
  let writes = 0;
  const storage = {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => { assert.equal(key, EXPERIENCE_STORAGE_KEY); entries.set(key, value); writes++; },
  };
  const clock = () => time;
  const store = createLocalExperienceStore(storage, clock);
  return {
    storage, store, clock,
    get raw() { return storage.getItem(EXPERIENCE_STORAGE_KEY); },
    get writes() { return writes; },
    tick(value) { time = value; },
    // Test fixtures are in-memory only; no browser data or user orders touched.
    seedRaw(value) { entries.set(EXPERIENCE_STORAGE_KEY, value); },
    create(id = IDS.order, product = "ceramide") { return store.mutate("create", id, product).result; },
    address(id = IDS.order) { return store.mutate("address", id, undefined, ADDRESS).result; },
  };
}

test("initial load is empty and never seeds sample orders or reports", () => {
  const f = fixture();
  assert.deepEqual(f.store.load(), { version: 1, orders: [], reports: [] });
  assert.equal(f.raw, null);
  assert.equal(f.writes, 0);
});

test("report uses the real snapshot, persists and retries idempotently", () => {
  const f = fixture();
  const report = f.store.mutate("report", IDS.report).result;
  assert.deepEqual(report, reportSnapshot(IDS.report, f.clock()));
  f.tick("2026-09-22T00:00:00.000Z");
  assert.deepEqual(f.store.mutate("report", IDS.report).result, report);
  assert.equal(f.store.load().reports.length, 1);
  assert.equal(f.store.load().orders.length, 0);
  assert.equal(f.writes, 1);
});

test("create returns the original API shape and keeps the first product on retry", () => {
  const f = fixture();
  const order = f.create();
  assert.deepEqual(order, {
    id: IDS.order, orderNo: "TG222222222222", product: resolveOrderProduct("ceramide"),
    state: "pending_payment", createdAt: f.clock(), updatedAt: f.clock(),
    recipient: "未填写", phone: "", address: "请填写收货地址", addressComplete: false,
    events: [{ state: "pending_payment", at: f.clock(), note: "演示订单已创建" }],
  });
  f.tick("2026-09-21T12:01:00.000Z");
  assert.deepEqual(f.create(IDS.order, "caffeine"), order);
  assert.equal(f.store.load().orders.length, 1);
  assert.equal(f.writes, 1);
});

test("IDs, product availability, record kinds and unknown actions are validated", () => {
  const f = fixture();
  assert.throws(() => f.store.mutate("report", "bad-id"), /记录编号无效/);
  assert.throws(() => f.store.mutate("report", undefined), /记录编号无效/);
  assert.throws(() => f.create(IDS.order, "nonexistent"), /商品暂不可用/);
  assert.throws(() => f.store.mutate("create", IDS.order), /商品暂不可用/);
  f.create();
  f.store.mutate("report", IDS.report);
  assert.throws(() => f.store.mutate("report", IDS.order), /记录类型不匹配/);
  assert.throws(() => f.create(IDS.report), /记录类型不匹配/);
  for (const action of ["address", "pay", "receive", "read"]) {
    assert.throws(() => f.store.mutate(action, IDS.second), /未找到订单/);
    assert.throws(() => f.store.mutate(action, IDS.report), /未找到订单/);
  }
  assert.throws(() => f.store.mutate("unknown", IDS.order), /操作无效/);
});

test("address validation rejects malformed data without changing storage", () => {
  const f = fixture(); f.create();
  const before = f.raw;
  for (const invalid of [undefined, {}, { ...ADDRESS, recipient: "" }, { ...ADDRESS, recipient: "字".repeat(31) },
    { ...ADDRESS, phone: "12345" }, { ...ADDRESS, phone: "12800138000" },
    { ...ADDRESS, address: "太短" }, { ...ADDRESS, address: "字".repeat(161) }]) {
    assert.throws(() => f.store.mutate("address", IDS.order, undefined, invalid), /请填写完整收货人、正确手机号和详细地址/);
    assert.equal(f.raw, before);
  }
});

test("saving an address persists only the real model's masked fields", () => {
  const f = fixture(); const created = f.create();
  f.tick("2026-09-21T12:01:00.000Z");
  const addressed = f.address();
  assert.deepEqual(addressed, { ...created, ...maskedShippingAddress(ADDRESS), updatedAt: f.clock() });
  for (const privateValue of Object.values(ADDRESS)) assert.equal(f.raw.includes(privateValue), false);
  assert.equal(addressed.addressComplete, true);
  assert.deepEqual(f.store.load().orders[0], addressed);
});

test("create → address → simulated pay matches advanceOrder and payment is idempotent", () => {
  const f = fixture(); f.create();
  assert.throws(() => f.store.mutate("pay", IDS.order), /请先填写并保存收货地址/);
  const addressed = f.address();
  f.tick("2026-09-21T12:02:00.000Z");
  const paid = f.store.mutate("pay", IDS.order).result;
  assert.deepEqual(paid, advanceOrder(addressed, "pay", f.clock()));
  assert.equal(paid.state, "awaiting_check");
  assert.equal(paid.events.length, 2);
  f.tick("2026-09-21T12:03:00.000Z");
  assert.deepEqual(f.store.mutate("pay", IDS.order).result, paid);
  assert.throws(() => f.address(), /当前状态不支持修改地址/);
  assert.throws(() => f.store.mutate("receive", IDS.order), /订单状态已变化，请刷新后重试/);
});

test("receive requires shipped, appends one event and is idempotent", () => {
  const f = fixture(); f.create(); f.address();
  f.store.mutate("pay", IDS.order);
  const snapshot = f.store.load();
  // Fulfilment is NOT an adapter action. Supply a test-only shipped fixture.
  const shipped = { ...snapshot.orders[0], state: "shipped", updatedAt: "2026-09-21T13:00:00.000Z" };
  snapshot.orders[0] = shipped;
  f.seedRaw(JSON.stringify(snapshot));
  f.tick("2026-09-21T14:00:00.000Z");
  const received = f.store.mutate("receive", IDS.order).result;
  assert.deepEqual(received, advanceOrder(shipped, "receive", f.clock()));
  assert.equal(received.receivedAt, f.clock());
  assert.equal(received.events.length, shipped.events.length + 1);
  f.tick("2026-09-21T15:00:00.000Z");
  assert.deepEqual(f.store.mutate("receive", IDS.order).result, received);
  assert.throws(() => f.store.mutate("pay", IDS.order), /订单状态已变化/);
});

test("read marks only readAt; later mutations preserve it and backward clocks do not regress it", () => {
  const f = fixture(); const created = f.create();
  f.tick("2026-09-21T12:01:00.000Z");
  const read = f.store.mutate("read", IDS.order).result;
  assert.deepEqual(read, { ...created, readAt: f.clock() });
  f.tick("2026-09-21T11:59:00.000Z");
  assert.equal(f.store.mutate("read", IDS.order).result.readAt, read.readAt);
  f.tick("2026-09-21T12:02:00.000Z");
  f.address();
  const paid = f.store.mutate("pay", IDS.order).result;
  assert.equal(paid.readAt, read.readAt);
  assert.ok(paid.updatedAt > paid.readAt);
});

test("multiple store instances always reload persisted state before mutation", () => {
  const f = fixture();
  const another = createLocalExperienceStore(f.storage, f.clock);
  assert.equal(another.load().orders.length, 0);
  f.create();
  f.tick("2026-09-21T12:01:00.000Z");
  another.mutate("create", IDS.second, "caffeine");
  f.store.mutate("read", IDS.order);
  f.address();
  another.mutate("pay", IDS.order);
  assert.equal(f.store.load().orders.length, 2);
  assert.equal(f.store.load().orders.find(order => order.id === IDS.order).state, "awaiting_check");
  assert.deepEqual(f.store.load(), another.load());
  f.store.mutate("report", IDS.report);
  assert.equal(another.load().reports.length, 1);
});

test("orders and reports are returned newest first and survive a fresh store", () => {
  const f = fixture(); f.create(); f.store.mutate("report", IDS.report);
  f.tick("2026-09-22T12:00:00.000Z");
  f.create(IDS.second, "caffeine"); f.store.mutate("report", IDS.third);
  const fresh = createLocalExperienceStore(f.storage, f.clock);
  assert.deepEqual(fresh.load().orders.map(order => order.id), [IDS.second, IDS.order]);
  assert.deepEqual(fresh.load().reports.map(report => report.id), [IDS.third, IDS.report]);
});

test("corrupt or incompatible saved data is rejected, never silently replaced", () => {
  const f = fixture();
  for (const raw of ["{broken", "null", JSON.stringify({ version: 2, orders: [], reports: [] }),
    JSON.stringify({ version: 1, orders: [{}], reports: [] }),
    JSON.stringify({ version: 1, orders: [], reports: [{}] })]) {
    f.seedRaw(raw);
    assert.throws(() => f.store.load(), /未覆盖原数据/);
    assert.throws(() => f.create(), /未覆盖原数据/);
    assert.equal(f.raw, raw);
    assert.equal(f.writes, 0);
  }
});

test("storage denial/quota failure surfaces an error without a successful mutation", () => {
  const f = fixture(); f.create(); const before = f.raw;
  const denied = createLocalExperienceStore({ getItem() { throw new Error("denied"); }, setItem() {} });
  assert.throws(() => denied.load(), /浏览器禁止本地存储/);
  const quota = createLocalExperienceStore({ getItem: f.storage.getItem, setItem() { throw new Error("quota"); } }, f.clock);
  assert.throws(() => quota.mutate("address", IDS.order, undefined, ADDRESS), /本地记录未保存/);
  assert.equal(f.raw, before);
  assert.equal(f.store.load().orders[0].addressComplete, false);
});
