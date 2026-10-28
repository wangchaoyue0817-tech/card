import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../public/events/', import.meta.url));
const publicRoot = path.resolve(root, '..');
// Only these additive EB05 resources may cross the archived import boundary.
// Every original resource remains confined to events; the shared files must
// still resolve inside this project's public directory and exist on disk.
const sharedPhase2Resources = new Set([
  path.join(publicRoot, 'phase2-service-bridge.js'),
  path.join(publicRoot, 'phase2-grant-dialog.css')
]);
// The added activity/prize entry reads only the second-period summary state.
const phase2EntryResources = new Set([
  path.join(publicRoot, 'phase2-session.js'),
  path.join(publicRoot, 'phase2-model.js')
]);
async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(filename));
    else if (entry.isFile()) files.push(filename);
  }
  return files;
}

function staticReferences(source) {
  const refs = new Set();
  const patterns = [
    /\b(?:src|href|poster)\s*=\s*["'`]([^"'`]+)["'`]/g,
    /\burl\(\s*["']?([^"')]+)["']?\s*\)/g,
    /@import\s+["']([^"']+)["']/g,
    /\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /["'`](assets\/[^"'`]+)["'`]/g,
    /["'`]((?:\.\/|\.\.\/)?[\w./-]+\.(?:css|js|mjs|html)(?:[?#][^"'`]*)?)["'`]/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) refs.add(match[1].trim());
  }
  return [...refs].filter(ref => ref && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?)/i.test(ref));
}

test('HTML, CSS and JavaScript local resources and module imports all exist', async () => {
  const missing = [];
  for (const filename of await filesIn(root)) {
    if (!/\.(?:html|css|js|mjs)$/.test(filename)) continue;
    const source = await readFile(filename, 'utf8');
    for (const reference of staticReferences(source)) {
      const pathname = reference.split(/[?#]/)[0];
      if (!pathname || pathname.includes('${')) continue;
      const target = pathname.startsWith('/') ? path.resolve(root, `.${pathname}`) : path.resolve(path.dirname(filename), pathname);
      const outsideEvents = path.relative(root, target).startsWith('..');
      const allowedEntry = path.basename(filename) === 'phase2-entry.js' && phase2EntryResources.has(target);
      const allowedShared = (sharedPhase2Resources.has(target) || allowedEntry) && !path.relative(publicRoot, target).startsWith('..');
      if (outsideEvents && !allowedShared) {
        missing.push(`${path.relative(root, filename)} escapes public: ${reference}`);
        continue;
      }
      try {
        assert.ok((await stat(target)).isFile());
      } catch {
        missing.push(`${path.relative(root, filename)} → ${reference}`);
      }
    }
    // Dynamic icon helpers build their URL from these literal icon names.
    for (const match of source.matchAll(/\bglyph\(\s*['"]([\w-]+)['"]/g)) {
      try { await stat(path.join(root, 'assets/icons', `${match[1]}.svg`)); }
      catch { missing.push(`${path.relative(root, filename)} → icon ${match[1]}`); }
    }
    if (/icon-map\.js$|expert-catalog\.js$/.test(filename)) {
      for (const match of source.matchAll(/["']([\w-]+\.svg)["']/g)) {
        try { await stat(path.join(root, 'assets/icons', match[1])); }
        catch { missing.push(`${path.relative(root, filename)} → icon ${match[1]}`); }
      }
    }
  }
  assert.deepEqual(missing, [], missing.join('\n'));
});

test('navigation exposes home, expert, card and the shared activity destinations', async () => {
  const expected = new Set(['home', 'expert', 'card', 'lottery', 'prizes', 'ranking']);
  const shell = await readFile(path.join(root, 'site-shell.js'), 'utf8');
  const routeMap = shell.match(/\broutes\s*=\s*\{([^}]+)\}/)?.[1];
  assert.ok(routeMap, 'The shell must declare its supported routes');
  const routes = [...routeMap.matchAll(/(?:['"]([\w-]+)['"]|([\w-]+))\s*:/g)].map(match => match[1] || match[2]);
  assert.deepEqual(new Set(routes), expected);
  for (const filename of (await filesIn(root)).filter(filename => /\.(?:html|js)$/.test(filename))) {
    const source = await readFile(filename, 'utf8');
    for (const match of source.matchAll(/\b(?:jianxNavigate|navigate|jianxRoute)\(\s*['"]([\w-]+)['"]/g)) {
      // The two additive entry modules delegate to the new parent-shell route.
      const isPhase2Entry = ['phase2-entry.js','phase2-card-entry.js'].includes(path.basename(filename));
      const isPhase2Route = match[1] === 'card-eb05' || (path.basename(filename) === 'phase2-entry.js' && match[1] === 'card-eb05-prizes');
      assert.ok(expected.has(match[1]) || (isPhase2Entry && isPhase2Route), `${path.relative(root, filename)} navigates to excluded route ${match[1]}`);
    }
  }
});

