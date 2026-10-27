// A small DOM fixture for exercising the real controllers without a browser dependency.
// It parses the actual HTML/templates and returns null for missing nodes.
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const decode = text => text.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'"}[entity]));
const camel = value => value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());

export class FixtureElement {
  constructor(tag, ownerDocument) {
    this.tagName = tag.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.nodes = [];
    this.dataset = {};
    this.events = new Map();
    this.style = {setProperty(name, value) { this[name] = value; }};
    this.hidden = false;
    this.disabled = false;
    this.inert = false;
    this.checked = false;
    this.value = '';
    this.tabIndex = /^(?:BUTTON|INPUT|TEXTAREA)$/.test(this.tagName) ? 0 : -1;
    this.scrollTop = this.scrollLeft = this.offsetLeft = 0;
    this.clientWidth = 375;
    // This DOM fixture has no raster renderer, matching a browser that cannot
    // allocate a 2D context. Canvas rendering itself is tested separately.
    if (this.tagName === 'CANVAS') this.getContext = () => null;
  }
  get children() { return this.nodes.filter(node => typeof node !== 'string'); }
  get firstElementChild() { return this.children[0] || null; }
  get id() { return this.getAttribute('id') || ''; }
  set id(value) { this.setAttribute('id', value); }
  get className() { return this.getAttribute('class') || ''; }
  set className(value) { this.setAttribute('class', value); }
  get classList() {
    const element = this;
    return {
      contains(name) { return element.className.split(/\s+/).includes(name); },
      add(...names) { element.className = [...new Set([...element.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove(...names) { element.className = element.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
      toggle(name, force) {
        const on = force === undefined ? !this.contains(name) : force;
        if (on) this.add(name); else this.remove(name);
        return on;
      }
    };
  }
  setAttribute(name, value) {
    value = String(value);
    this.attributes.set(name, value);
    if (name.startsWith('data-')) this.dataset[camel(name.slice(5))] = value;
    if (name === 'hidden') this.hidden = true;
    if (name === 'disabled') this.disabled = true;
    if (name === 'tabindex') this.tabIndex = Number(value);
    if (name === 'value') this.value = value;
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  get innerHTML() { return this.sourceHTML || ''; }
  set innerHTML(value) {
    this.sourceHTML = String(value);
    this.nodes = [];
    const stack = [this];
    for (const token of String(value).match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || []) {
      if (/^<!/.test(token)) continue;
      if (/^<\//.test(token)) {
        const tag = token.slice(2).match(/^[\w-]+/)?.[0]?.toUpperCase();
        const index = stack.findLastIndex(node => node.tagName === tag);
        if (index > 0) stack.length = index;
      } else if (token.startsWith('<')) {
        const tag = token.slice(1).match(/^[\w-]+/)?.[0];
        if (!tag) continue;
        const node = new FixtureElement(tag, this.ownerDocument);
        const body = token.slice(tag.length + 1, token.endsWith('/>') ? -2 : -1);
        for (const attr of body.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
          node.setAttribute(attr[1], decode(attr[2] ?? attr[3] ?? attr[4] ?? ''));
        }
        stack.at(-1).append(node);
        if (!voidTags.has(tag.toLowerCase()) && !token.endsWith('/>')) stack.push(node);
      } else {
        stack.at(-1).nodes.push(decode(token));
      }
    }
    for (const textarea of this.querySelectorAll('textarea')) textarea.value = textarea.textContent;
  }
  get textContent() { return this.nodes.map(node => typeof node === 'string' ? node : node.textContent).join(''); }
  set textContent(value) { this.nodes = [String(value)]; }
  append(...nodes) {
    for (const node of nodes) {
      if (typeof node !== 'string') node.parentElement = this;
      this.nodes.push(node);
    }
  }
  replaceChildren(...nodes) { this.nodes = []; this.append(...nodes); }
  remove() {
    if (this.parentElement) {
      this.parentElement.nodes = this.parentElement.nodes.filter(node => node !== this);
      this.parentElement = null;
    }
  }
  matches(selector) {
    return selector.split(',').some(part => {
      part = part.trim();
      if (!part) return false;
      const tag = part.match(/^[\w-]+/)?.[0];
      if (tag && this.tagName !== tag.toUpperCase()) return false;
      const id = part.match(/#([\w-]+)/)?.[1];
      if (id && this.id !== id) return false;
      for (const match of part.matchAll(/\.([\w-]+)/g)) if (!this.classList.contains(match[1])) return false;
      for (const match of part.matchAll(/\[([\w-]+)(?:=["']?([^"'\]]+)["']?)?\]/g)) {
        if (!this.hasAttribute(match[1])) return false;
        if (match[2] !== undefined && this.getAttribute(match[1]) !== match[2]) return false;
      }
      return true;
    });
  }
  closest(selector) {
    let node = this;
    while (node) { if (node.matches(selector)) return node; node = node.parentElement; }
    return null;
  }
  querySelectorAll(selector) {
    const match = node => selector.split(',').some(part => {
      const chain = part.trim().split(/\s+(?![^[]*\])/);
      if (!node.matches(chain.pop())) return false;
      let ancestor = node.parentElement;
      while (chain.length) {
        const expected = chain.pop();
        while (ancestor && !ancestor.matches(expected)) ancestor = ancestor.parentElement;
        if (!ancestor) return false;
        ancestor = ancestor.parentElement;
      }
      return true;
    });
    const all = [];
    const visit = node => { for (const child of node.children) { if (match(child)) all.push(child); visit(child); } };
    visit(this);
    return all;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, listener) {
    const listeners = this.events.get(type) || [];
    listeners.push(listener); this.events.set(type, listeners);
  }
  removeEventListener(type, listener) {
    this.events.set(type, (this.events.get(type) || []).filter(item => item !== listener));
  }
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.preventDefault ||= () => { event.defaultPrevented = true; };
    event.stopPropagation ||= () => { event.stopped = true; };
    event.stopImmediatePropagation ||= event.stopPropagation;
    let node = this;
    do {
      node[`on${event.type}`]?.(event);
      for (const listener of node.events.get(event.type) || []) listener(event);
      node = event.bubbles === false || event.stopped ? null : node.parentElement;
    } while (node);
    return !event.defaultPrevented;
  }
  click() { if (!this.disabled) this.dispatchEvent({type: 'click'}); }
  focus() { this.ownerDocument.activeElement = this; }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  get isConnected() { return this.ownerDocument.root.contains(this); }
  getBoundingClientRect() { return {top: 0, left: 0, right: 375, bottom: 60, width: 375, height: 60}; }
  getClientRects() { return this.closest('[hidden]') || this.hidden ? [] : [this.getBoundingClientRect()]; }
  scrollIntoView() {}
}

export function createDocument(html = '') {
  const document = {
    title: '', activeElement: null, events: new Map(),
    createElement(tag) { return new FixtureElement(tag, this); },
    getElementById(id) { return this.root.querySelector(`#${id}`); },
    querySelector(selector) { return this.root.querySelector(selector); },
    querySelectorAll(selector) { return this.root.querySelectorAll(selector); },
    addEventListener(type, listener) { const listeners = this.events.get(type) || []; listeners.push(listener); this.events.set(type, listeners); },
    hasFocus() { return true; }
  };
  document.root = new FixtureElement('fixture-root', document);
  document.root.innerHTML = html;
  document.body = document.querySelector('body') || document.root;
  document.activeElement = document.body;
  return document;
}
