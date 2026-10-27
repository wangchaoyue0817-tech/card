import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from './dom-fixture.mjs';
import {comfortMarkup,mountComfort} from '../../public/events/gacha-comfort.js';

function fixture(reduced=false) {
  const document=createDocument(`<body>${comfortMarkup()}</body>`);
  const listeners=new Set();
  const media={matches:reduced,addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)};
  document.defaultView={matchMedia:()=>media};
  return {document,listeners,media,root:document.querySelector('[data-comfort]'),button:document.querySelector('[data-comfort-hug]')};
}

test('hug responds once per animation, can replay, and cleans listeners when dismissed',()=>{
  const f=fixture(),stop=mountComfort(f.document);
  f.button.click();
  assert.equal(f.root.classList.contains('is-hugging'),true);
  assert.equal(f.root.classList.contains('is-hugged'),true);
  assert.equal(f.button.getAttribute('aria-label'),'再抱一下小扭蛋');
  f.button.click();
  f.root.dispatchEvent({type:'animationend',animationName:'gc-float-heart'});
  assert.equal(f.root.classList.contains('is-hugging'),true);
  f.root.dispatchEvent({type:'animationend',animationName:'gc-hug'});
  assert.equal(f.root.classList.contains('is-hugging'),false);
  f.button.click();
  assert.equal(f.root.classList.contains('is-hugging'),true);
  stop();stop();
  assert.equal(f.listeners.size,0);
  assert.equal(f.button.events.get('click').length,0);
  assert.equal(f.root.events.get('animationend').length,0);
  f.button.click();
  assert.equal(f.root.classList.contains('is-hugging'),false);
});

test('reduced motion keeps the static hug and accessible response without animation',()=>{
  const f=fixture(true),stop=mountComfort(f.document);
  f.button.click();f.button.click();
  assert.equal(f.root.classList.contains('is-hugging'),false);
  assert.equal(f.root.classList.contains('is-hugged'),true);
  const status=f.root.querySelector('[role="status"]');
  assert.equal(status.getAttribute('aria-live'),'polite');
  assert.match(status.textContent,/抱抱已送达/);
  stop();
});

test('re-mount and changed motion preference do not leave competing handlers or stuck animation',()=>{
  const f=fixture(),old=mountComfort(f.document),stop=mountComfort(f.document);
  old();
  assert.equal(f.button.events.get('click').length,1);
  assert.equal(f.listeners.size,1);
  f.button.click();f.media.matches=true;
  for(const listener of f.listeners)listener({matches:true});
  assert.equal(f.root.classList.contains('is-hugging'),false);
  f.button.click();
  assert.equal(f.root.classList.contains('is-hugged'),true);
  stop();
});

test('winning views with no comfort illustration mount no extra interaction',()=>{
  const document=createDocument('<body><h2>获得专家线上鉴别券</h2></body>');
  const stop=mountComfort(document);
  stop();stop();
  assert.equal(document.querySelectorAll('button').length,0);
});
