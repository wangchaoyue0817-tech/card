"use client";

import { useEffect, useRef, useState } from "react";
import { ChatsCircle, Headset, PaperPlaneRight, ShieldCheck } from "@phosphor-icons/react";
import { PRODUCT_SAMPLE_IMAGE } from "./product-assets";

export { PRODUCT_SAMPLE_IMAGE } from "./product-assets";

export function ProductGuarantee({ onSupport }: { onSupport: () => void }) {
  return <section className="product-guarantee">
    <header><span><ShieldCheck size={24} weight="duotone" /></span><h4>正品保障·先鉴定再发货</h4></header>
    <p>图灵鉴X官方平台购买的商品，将统一发往图灵线下鉴定中心核验，出具正品鉴定报告后为您极速发货</p>
    <p className="product-guarantee-note">如对商品核验结果有疑问，可联系人工客服申请复核。</p>
    <button type="button" onClick={onSupport}><Headset size={18} />联系人工客服</button>
  </section>;
}

export function CustomerSupport({ productName, orderNo }: { productName: string; orderNo?: string }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<{ id: number; text: string }[]>([]);
  const conversationRef = useRef<HTMLDivElement>(null);
  useEffect(() => { conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);
  const send = () => {
    if (!draft.trim()) return;
    setMessages(current => [...current, { id: Date.now(), text: draft.trim() }]);
    setDraft("");
  };
  return <section className="customer-service">
    <header className="customer-service-agent"><span><Headset size={25} weight="duotone" /></span><div><b>图灵官方客服</b><small>商品咨询 · 核验复核</small></div><em>演示会话</em></header>
    <div className="customer-service-context"><img src={PRODUCT_SAMPLE_IMAGE} alt="咨询商品示例图" /><div><small>{orderNo ? `订单 ${orderNo}` : "正在咨询"}</small><strong>{productName}</strong></div></div>
    <div className="customer-service-messages" ref={conversationRef} role="log" aria-label="客服消息" aria-live="polite">
      <p className="service-message"><ChatsCircle size={18} /><span>您好，请描述您遇到的问题。如需申请核验复核，可在这里补充具体情况。</span></p>
      {messages.map(message => <div className="service-exchange" key={message.id}><p className="service-message is-user"><span>{message.text}</span></p><p className="service-message"><ChatsCircle size={18} /><span>已收到您的消息。正式接入后，人工客服将在此继续处理您的咨询。</span></p></div>)}
    </div>
    <form className="customer-service-compose" onSubmit={event => { event.preventDefault(); send(); }}><input aria-label="输入咨询内容" placeholder="请输入您想咨询的问题" value={draft} onChange={event => setDraft(event.target.value)} /><button type="submit" disabled={!draft.trim()} aria-label="发送咨询"><PaperPlaneRight size={19} weight="fill" /></button></form>
  </section>;
}
