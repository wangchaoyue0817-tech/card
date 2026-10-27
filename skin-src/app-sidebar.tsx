"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  ArrowRight,
  Bag,
  CaretRight,
  ChatCircleDots,
  ForkKnife,
  Medal,
  Scan,
  ShirtFolded,
  Sparkle,
  X,
  Gift,
} from "@phosphor-icons/react";

type AppSidebarProps = {
  open: boolean;
  activeArea: "chat" | "skin" | "orders";
  hasOrder: boolean;
  hasUnreadOrder: boolean;
  skinHighlight: boolean;
  onOrders: () => void;
  onClose: () => void;
  onSkinManagement: () => void;
  onNewChat: () => void;
};

const conversationGroups = [
  { label: "今天", items: [{ title: "我的秋日肤况复盘", time: "21:36", active: true }, { title: "暖黄调底妆怎么选", time: "14:20" }] },
  { label: "近 7 天", items: [{ title: "换季屏障修护计划", time: "09/11" }, { title: "眼周疲态护理建议", time: "09/07" }] },
  { label: "近 30 天", items: [{ title: "T 区油光分区护理", time: "08/28" }, { title: "晨间精简护肤流程", time: "08/21" }] },
];

export function AppSidebar({ open, activeArea, hasOrder, hasUnreadOrder, skinHighlight, onOrders, onClose, onSkinManagement, onNewChat }: AppSidebarProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeDrawer = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(drawerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? [])]
        .filter(node => !node.hasAttribute("disabled"));
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
      const previousFocus = previousFocusRef.current;
      if (previousFocus && !previousFocus.closest('[inert], [aria-hidden="true"]')) previousFocus.focus();
    };
  }, [closeDrawer, open]);

  return (
    <div className={`app-drawer-layer ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button className="app-drawer-scrim" type="button" aria-label="关闭侧边栏" tabIndex={open ? 0 : -1} onClick={closeDrawer} />
      <aside className="app-drawer" role="dialog" aria-modal="true" aria-label="图灵鉴功能导航" ref={drawerRef}>
        <header className="drawer-account">
          <button className="drawer-user-entry" type="button" aria-label="用户名，用户设置入口">
            <span className="drawer-avatar"><img src="/skin-oil-face-v2.png" alt="用户头像" /></span>
            <span className="drawer-user-copy">
              <strong>用户名</strong>
              <span>用户设置</span>
            </span>
            <CaretRight className="drawer-entry-arrow" size={15} weight="bold" />
          </button>
          <button className="drawer-badge" type="button" aria-label="我的徽章，已获得9枚，共11枚；演示入口暂不跳转">
            <Medal size={20} weight="duotone" />
            <span><small>我的徽章</small><b>9 / 11</b></span>
            <CaretRight className="drawer-entry-arrow" size={14} weight="bold" />
          </button>
          <button className="drawer-close" type="button" aria-label="关闭侧边栏" onClick={closeDrawer} ref={closeRef}><X size={18} /></button>
        </header>

        <section className="drawer-console" aria-label="快捷功能">
          <div className="drawer-shortcuts two-columns has-lottery" role="group" aria-label="订单服务">
            <div className="drawer-shortcut is-static"><span><Scan size={20} weight="duotone" /></span><b>专鉴服务</b></div>
            <button type="button" className={`drawer-shortcut ${activeArea === "orders" ? "is-active" : ""} ${hasUnreadOrder ? "has-update" : ""}`} onClick={onOrders} aria-label={hasUnreadOrder ? "商品订单，有未读进度" : hasOrder ? "商品订单，查看核验与物流" : "商品订单，暂无订单"}><span><Bag size={20} weight="duotone" /></span><b>商品订单</b>{hasUnreadOrder && <i className="drawer-entry-update"/>}</button>
            <button type="button" className="drawer-shortcut drawer-lottery-entry" onClick={()=>{onClose();(window as any).jianxNavigate('lottery');}}><span><Gift size={20} weight="duotone"/></span><b>抽奖中心</b></button>
          </div>

          <div className="drawer-divider" aria-hidden="true" />
          <div className="drawer-shortcuts three-columns" role="group" aria-label="智能功能">
            <button className={`drawer-shortcut ${activeArea === "skin" ? "is-active" : ""} ${skinHighlight ? "has-update" : ""}`} type="button" onClick={onSkinManagement}>
              <span><Sparkle size={20} weight="duotone" /></span><b>皮肤管理</b>
            </button>
            <div className="drawer-shortcut is-static"><span><ShirtFolded size={20} weight="duotone" /></span><b>穿搭管理</b></div>
            <div className="drawer-shortcut is-static"><span><ForkKnife size={20} weight="duotone" /></span><b>鉴餐管理</b></div>
          </div>
          {skinHighlight && <p className="drawer-context-hint">皮肤管理：历史记录、肤况变化与护理推荐</p>}
        </section>

        <button className="drawer-new-chat" type="button" onClick={onNewChat}>
          <span className="drawer-new-chat-icon"><Sparkle className="drawer-new-chat-icon-spark" size={23} weight="fill" /></span>
          <span><b>新建对话</b></span>
          <span className="drawer-new-chat-spark"><ArrowRight size={17} weight="bold" /></span>
        </button>

        <section className="drawer-history">
          <header><span><ChatCircleDots size={17} /> 历史对话</span></header>
          <div className="drawer-history-scroll">
            {conversationGroups.map(group => (
              <div className="drawer-history-group" key={group.label}>
                <h3>{group.label}</h3>
                {group.items.map(item => (
                  <div className={`drawer-chat-row ${item.active ? "is-current" : ""}`} key={`${group.label}-${item.title}`}>
                    <span><span className={`drawer-chat-dot ${item.active ? "is-live" : ""}`} /></span>
                    <b>{item.title}</b>
                    <time>{item.time}</time>
                    <ArrowRight className="drawer-chat-arrow" size={12} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
