/* ES Module Shims 0.15.1 */
(function () {

  Promise.resolve();

  const edge = navigator.userAgent.match(/Edge\/\d\d\.\d+$/);

  let baseUrl;

  function createBlob (source, type = 'text/javascript') {
    return URL.createObjectURL(new Blob([source], { type }));
  }

  const noop = () => {};

  const baseEl = document.querySelector('base[href]');
  if (baseEl)
    baseUrl = baseEl.href;

  if (!baseUrl && typeof location !== 'undefined') {
    baseUrl = location.href.split('#')[0].split('?')[0];
    const lastSepIndex = baseUrl.lastIndexOf('/');
    if (lastSepIndex !== -1)
      baseUrl = baseUrl.slice(0, lastSepIndex + 1);
  }

  function isURL (url) {
    try {
      new URL(url);
      return true;
    }
    catch {
      return false;
    }
  }

  const backslashRegEx = /\\/g;
  function resolveIfNotPlainOrUrl (relUrl, parentUrl) {
    // strip off any trailing query params or hashes
    parentUrl = parentUrl && parentUrl.split('#')[0].split('?')[0];
    if (relUrl.indexOf('\\') !== -1)
      relUrl = relUrl.replace(backslashRegEx, '/');
    // protocol-relative
    if (relUrl[0] === '/' && relUrl[1] === '/') {
      return parentUrl.slice(0, parentUrl.indexOf(':') + 1) + relUrl;
    }
    // relative-url
    else if (relUrl[0] === '.' && (relUrl[1] === '/' || relUrl[1] === '.' && (relUrl[2] === '/' || relUrl.length === 2 && (relUrl += '/')) ||
        relUrl.length === 1  && (relUrl += '/')) ||
        relUrl[0] === '/') {
      const parentProtocol = parentUrl.slice(0, parentUrl.indexOf(':') + 1);
      // Disabled, but these cases will give inconsistent results for deep backtracking
      //if (parentUrl[parentProtocol.length] !== '/')
      //  throw new Error('Cannot resolve');
      // read pathname from parent URL
      // pathname taken to be part after leading "/"
      let pathname;
      if (parentUrl[parentProtocol.length + 1] === '/') {
        // resolving to a :// so we need to read out the auth and host
        if (parentProtocol !== 'file:') {
          pathname = parentUrl.slice(parentProtocol.length + 2);
          pathname = pathname.slice(pathname.indexOf('/') + 1);
        }
        else {
          pathname = parentUrl.slice(8);
        }
      }
      else {
        // resolving to :/ so pathname is the /... part
        pathname = parentUrl.slice(parentProtocol.length + (parentUrl[parentProtocol.length] === '/'));
      }

      if (relUrl[0] === '/')
        return parentUrl.slice(0, parentUrl.length - pathname.length - 1) + relUrl;

      // join together and split for removal of .. and . segments
      // looping the string instead of anything fancy for perf reasons
      // '../../../../../z' resolved to 'x/y' is just 'z'
      const segmented = pathname.slice(0, pathname.lastIndexOf('/') + 1) + relUrl;

      const output = [];
      let segmentIndex = -1;
      for (let i = 0; i < segmented.length; i++) {
        // busy reading a segment - only terminate on '/'
        if (segmentIndex !== -1) {
          if (segmented[i] === '/') {
            output.push(segmented.slice(segmentIndex, i + 1));
            segmentIndex = -1;
          }
        }

        // new segment - check if it is relative
        else if (segmented[i] === '.') {
          // ../ segment
          if (segmented[i + 1] === '.' && (segmented[i + 2] === '/' || i + 2 === segmented.length)) {
            output.pop();
            i += 2;
          }
          // ./ segment
          else if (segmented[i + 1] === '/' || i + 1 === segmented.length) {
            i += 1;
          }
          else {
            // the start of a new segment as below
            segmentIndex = i;
          }
        }
        // it is the start of a new segment
        else {
          segmentIndex = i;
        }
      }
      // finish reading out the last segment
      if (segmentIndex !== -1)
        output.push(segmented.slice(segmentIndex));
      return parentUrl.slice(0, parentUrl.length - pathname.length) + output.join('');
    }
  }

  /*
   * Import maps implementation
   *
   * To make lookups fast we pre-resolve the entire import map
   * and then match based on backtracked hash lookups
   *
   */
  function resolveUrl (relUrl, parentUrl) {
    return resolveIfNotPlainOrUrl(relUrl, parentUrl) || (relUrl.indexOf(':') !== -1 ? relUrl : resolveIfNotPlainOrUrl('./' + relUrl, parentUrl));
  }

  function resolveAndComposePackages (packages, outPackages, baseUrl, parentMap) {
    for (let p in packages) {
      const resolvedLhs = resolveIfNotPlainOrUrl(p, baseUrl) || p;
      let target = packages[p];
      if (typeof target !== 'string') 
        continue;
      const mapped = resolveImportMap(parentMap, resolveIfNotPlainOrUrl(target, baseUrl) || target, baseUrl);
      if (mapped) {
        outPackages[resolvedLhs] = mapped;
        continue;
      }
      targetWarning(p, packages[p], 'bare specifier did not resolve');
    }
  }

  function resolveAndComposeImportMap (json, baseUrl, parentMap) {
    const outMap = { imports: Object.assign({}, parentMap.imports), scopes: Object.assign({}, parentMap.scopes) };

    if (json.imports)
      resolveAndComposePackages(json.imports, outMap.imports, baseUrl, parentMap);

    if (json.scopes)
      for (let s in json.scopes) {
        const resolvedScope = resolveUrl(s, baseUrl);
        resolveAndComposePackages(json.scopes[s], outMap.scopes[resolvedScope] || (outMap.scopes[resolvedScope] = {}), baseUrl, parentMap);
      }

    return outMap;
  }

  function getMatch (path, matchObj) {
    if (matchObj[path])
      return path;
    let sepIndex = path.length;
    do {
      const segment = path.slice(0, sepIndex + 1);
      if (segment in matchObj)
        return segment;
    } while ((sepIndex = path.lastIndexOf('/', sepIndex - 1)) !== -1)
  }

  function applyPackages (id, packages) {
    const pkgName = getMatch(id, packages);
    if (pkgName) {
      const pkg = packages[pkgName];
      if (pkg === null) return;
      if (id.length > pkgName.length && pkg[pkg.length - 1] !== '/')
        targetWarning(pkgName, pkg, "should have a trailing '/'");
      else
        return pkg + id.slice(pkgName.length);
    }
  }

  function targetWarning (match, target, msg) {
    console.warn("Package target " + msg + ", resolving target '" + target + "' for " + match);
  }

  function resolveImportMap (importMap, resolvedOrPlain, parentUrl) {
    let scopeUrl = parentUrl && getMatch(parentUrl, importMap.scopes);
    while (scopeUrl) {
      const packageResolution = applyPackages(resolvedOrPlain, importMap.scopes[scopeUrl]);
      if (packageResolution)
        return packageResolution;
      scopeUrl = getMatch(scopeUrl.slice(0, scopeUrl.lastIndexOf('/')), importMap.scopes);
    }
    return applyPackages(resolvedOrPlain, importMap.imports) || resolvedOrPlain.indexOf(':') !== -1 && resolvedOrPlain;
  }

  const optionsScript = document.querySelector('script[type=esms-options]');

  const esmsInitOptions$1 = optionsScript ? JSON.parse(optionsScript.innerHTML) : self.esmsInitOptions ? self.esmsInitOptions : {};

  let shimMode = !!esmsInitOptions$1.shimMode;
  const resolveHook = shimMode && esmsInitOptions$1.resolve;

  const skip = esmsInitOptions$1.skip ? new RegExp(esmsInitOptions$1.skip) : /^https:\/\/(cdn\.skypack\.dev|jspm\.dev)\//;

  let nonce = esmsInitOptions$1.nonce;

  if (!nonce) {
    const nonceElement = document.querySelector('script[nonce]');
    if (nonceElement)
      nonce = nonceElement.getAttribute('nonce');
  }

  const {
    fetchHook = fetch,
    onerror = noop,
    revokeBlobURLs,
    noLoadEventRetriggers,
  } = esmsInitOptions$1;

  const enable = Array.isArray(esmsInitOptions$1.polyfillEnable) ? esmsInitOptions$1.polyfillEnable : [];
  const cssModulesEnabled = enable.includes('css-modules');
  const jsonModulesEnabled = enable.includes('json-modules');

  function setShimMode () {
    shimMode = true;
  }

  let supportsDynamicImportCheck = false;

  let dynamicImport;
  try {
    dynamicImport = (0, eval)('u=>import(u)');
    supportsDynamicImportCheck = true;
  }
  catch (e) {}

  if (!supportsDynamicImportCheck) {
    let err;
    window.addEventListener('error', _err => err = _err);
    dynamicImport = (url, { errUrl = url }) => {
      err = undefined;
      const src = createBlob(`import*as m from'${url}';self._esmsi=m;`);
      const s = Object.assign(document.createElement('script'), { type: 'module', src });
      s.setAttribute('noshim', '');
      document.head.appendChild(s);
      return new Promise((resolve, reject) => {
        s.addEventListener('load', () => {
          document.head.removeChild(s);
          if (self._esmsi) {
            resolve(self._esmsi, baseUrl);
            self._esmsi = null;
          }
          else {
            reject(err.error || new Error(`Error loading or executing the graph of ${errUrl} (check the console for ${src}).`));
            err = undefined;
          }
        });
      });
    };
  }

  // support browsers without dynamic import support (eg Firefox 6x)
  let supportsJsonAssertions = false;
  let supportsCssAssertions = false;

  let supportsImportMeta = false;
  let supportsImportMaps = false;

  let supportsDynamicImport = false;

  const featureDetectionPromise = Promise.resolve(supportsDynamicImportCheck).then(_supportsDynamicImport => {
    if (!_supportsDynamicImport)
      return;
    supportsDynamicImport = true;

    return Promise.all([
      dynamicImport(createBlob('import.meta')).then(() => supportsImportMeta = true, noop),
      cssModulesEnabled && dynamicImport(createBlob('import"data:text/css,{}"assert{type:"css"}')).then(() => supportsCssAssertions = true, noop),
      jsonModulesEnabled && dynamicImport(createBlob('import"data:text/json,{}"assert{type:"json"}')).then(() => supportsJsonAssertions = true, noop),
      new Promise(resolve => {
        self._$s = v => {
          document.body.removeChild(iframe);
          if (v) supportsImportMaps = true;
          delete self._$s;
          resolve();
        };
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        // we use document.write here because eg Weixin built-in browser doesn't support setting srcdoc
        iframe.contentWindow.document.write(`<script type=importmap nonce="${nonce}">{"imports":{"x":"data:text/javascript,"}}<${''}/script><script nonce="${nonce}">import('x').then(()=>1,()=>0).then(v=>parent._$s(v))<${''}/script>`);
      })
    ]);
  });

  /* es-module-lexer 0.9.0 */
  const A=1===new Uint8Array(new Uint16Array([1]).buffer)[0];function parse(E,g="@"){if(!B)return init.then(()=>parse(E));const I=E.length+1,w=(B.__heap_base.value||B.__heap_base)+4*I-B.memory.buffer.byteLength;w>0&&B.memory.grow(Math.ceil(w/65536));const D=B.sa(I-1);if((A?C:Q)(E,new Uint16Array(B.memory.buffer,D,I)),!B.parse())throw Object.assign(new Error(`Parse error ${g}:${E.slice(0,B.e()).split("\n").length}:${B.e()-E.lastIndexOf("\n",B.e()-1)}`),{idx:B.e()});const k=[],L=[];for(;B.ri();){const A=B.is(),Q=B.ie(),C=B.ai(),g=B.id(),I=B.ss(),w=B.se();let D;B.ip()&&(D=o(E.slice(-1===g?A-1:A,-1===g?Q+1:Q))),k.push({n:D,s:A,e:Q,ss:I,se:w,d:g,a:C});}for(;B.re();)L.push(E.slice(B.es(),B.ee()));function o(A){try{return (0,eval)(A)}catch(A){}}return [k,L,!!B.f()]}function Q(A,Q){const C=A.length;let B=0;for(;B<C;){const C=A.charCodeAt(B);Q[B++]=(255&C)<<8|C>>>8;}}function C(A,Q){const C=A.length;let B=0;for(;B<C;)Q[B]=A.charCodeAt(B++);}let B;const init=WebAssembly.compile((E="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","undefined"!=typeof Buffer?Buffer.from(E,"base64"):Uint8Array.from(atob(E),A=>A.charCodeAt(0)))).then(WebAssembly.instantiate).then(({exports:A})=>{B=A;});var E;

  async function defaultResolve (id, parentUrl) {
    return resolveImportMap(importMap, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl);
  }

  async function _resolve (id, parentUrl) {
    const urlResolved = resolveIfNotPlainOrUrl(id, parentUrl);
    return {
      r: resolveImportMap(importMap, urlResolved || id, parentUrl),
      // b = bare specifier
      b: !urlResolved && !isURL(id)
    };
  }

  const resolve = resolveHook ? async (id, parentUrl) => ({ r: await esmsInitOptions.resolve(id, parentUrl, defaultResolve), b: false }) : _resolve;

  let id = 0;
  const registry = {};

  async function loadAll (load, seen) {
    if (load.b || seen[load.u])
      return;
    seen[load.u] = 1;
    await load.L;
    await Promise.all(load.d.map(dep => loadAll(dep, seen)));
    if (!load.n)
      load.n = load.d.some(dep => dep.n);
  }

  let importMap = { imports: {}, scopes: {} };
  let importMapSrcOrLazy = false;
  let importMapPromise = featureDetectionPromise;

  let acceptingImportMaps = true;
  let nativeAcceptingImportMaps = true;
  async function topLevelLoad (url, fetchOpts, source, nativelyLoaded, lastStaticLoadPromise) {
    if (acceptingImportMaps) {
      if (!shimMode) {
        acceptingImportMaps = false;
      }
      else {
        nativeAcceptingImportMaps = false;
      }
    }
    await importMapPromise;
    // early analysis opt-out - no need to even fetch if we have feature support
    if (!shimMode && supportsDynamicImport && supportsImportMeta && supportsImportMaps && (!jsonModulesEnabled || supportsJsonAssertions) && (!cssModulesEnabled || supportsCssAssertions) && !importMapSrcOrLazy) {
      // for polyfill case, only dynamic import needs a return value here, and dynamic import will never pass nativelyLoaded
      if (nativelyLoaded)
        return null;
      await lastStaticLoadPromise;
      return dynamicImport(source ? createBlob(source) : url, { errUrl: url || source });
    }
    await init;
    const load = getOrCreateLoad(url, fetchOpts, source);
    const seen = {};
    await loadAll(load, seen);
    lastLoad = undefined;
    resolveDeps(load, seen);
    await lastStaticLoadPromise;
    if (source && !shimMode && !load.n) {
      const module = await dynamicImport(createBlob(source), { errUrl: source });
      if (revokeBlobURLs) revokeObjectURLs(Object.keys(seen));
      return module;
    }
    const module = await dynamicImport(load.b, { errUrl: load.u });
    // if the top-level load is a shell, run its update function
    if (load.s)
      (await dynamicImport(load.s)).u$_(module);
    if (revokeBlobURLs) revokeObjectURLs(Object.keys(seen));
    // when tla is supported, this should return the tla promise as an actual handle
    // so readystate can still correspond to the sync subgraph exec completions
    return module;
  }

  function revokeObjectURLs(registryKeys) {
    let batch = 0;
    const keysLength = registryKeys.length;
    const schedule = self.requestIdleCallback ? self.requestIdleCallback : self.requestAnimationFrame;
    schedule(cleanup);
    function cleanup() {
      const batchStartIndex = batch * 100;
      if (batchStartIndex > keysLength) return
      for (const key of registryKeys.slice(batchStartIndex, batchStartIndex + 100)) {
        const load = registry[key];
        if (load) URL.revokeObjectURL(load.b);
      }
      batch++;
      schedule(cleanup);
    }
  }

  async function importShim (id, parentUrl = baseUrl, _assertion) {
    processScripts();
    await importMapPromise;
    return topLevelLoad((await resolve(id, parentUrl)).r || throwUnresolved(id, parentUrl), { credentials: 'same-origin' });
  }

  self.importShim = importShim;

  const meta = {};

  async function importMetaResolve (id, parentUrl = this.url) {
    await importMapPromise;
    return (await resolve(id, `${parentUrl}`)).r || throwUnresolved(id, parentUrl);
  }

  self._esmsm = meta;

  function urlJsString (url) {
    return `'${url.replace(/'/g, "\\'")}'`;
  }

  let lastLoad;
  function resolveDeps (load, seen) {
    if (load.b || !seen[load.u])
      return;
    seen[load.u] = 0;

    for (const dep of load.d)
      resolveDeps(dep, seen);

    // use direct native execution when possible
    // load.n is therefore conservative
    if (!shimMode && !load.n) {
      load.b = lastLoad = load.u;
      load.S = undefined;
      return;
    }

    const [imports] = load.a;

    // "execution"
    const source = load.S;

    // edge doesnt execute sibling in order, so we fix this up by ensuring all previous executions are explicit dependencies
    let resolvedSource = edge && lastLoad ? `import '${lastLoad}';` : '';

    if (!imports.length) {
      resolvedSource += source;
    }
    else {
      // once all deps have loaded we can inline the dependency resolution blobs
      // and define this blob
      let lastIndex = 0, depIndex = 0;
      for (const { s: start, se: end, d: dynamicImportIndex } of imports) {
        // dependency source replacements
        if (dynamicImportIndex === -1) {
          const depLoad = load.d[depIndex++];
          let blobUrl = depLoad.b;
          if (!blobUrl) {
            // circular shell creation
            if (!(blobUrl = depLoad.s)) {
              blobUrl = depLoad.s = createBlob(`export function u$_(m){${
              depLoad.a[1].map(
                name => name === 'default' ? `$_default=m.default` : `${name}=m.${name}`
              ).join(',')
            }}${
              depLoad.a[1].map(name =>
                name === 'default' ? `let $_default;export{$_default as default}` : `export let ${name}`
              ).join(';')
            }\n//# sourceURL=${depLoad.r}?cycle`);
            }
          }
          // circular shell execution
          else if (depLoad.s) {
            resolvedSource += `${source.slice(lastIndex, start - 1)}/*${source.slice(start - 1, end)}*/${urlJsString(blobUrl)};import*as m$_${depIndex} from'${depLoad.b}';import{u$_ as u$_${depIndex}}from'${depLoad.s}';u$_${depIndex}(m$_${depIndex})`;
            lastIndex = end;
            depLoad.s = undefined;
            continue;
          }
          resolvedSource += `${source.slice(lastIndex, start - 1)}/*${source.slice(start - 1, end)}*/${urlJsString(blobUrl)}`;
          lastIndex = end;
        }
        // import.meta
        else if (dynamicImportIndex === -2) {
          meta[load.r] = { url: load.r, resolve: importMetaResolve };
          resolvedSource += `${source.slice(lastIndex, start)}self._esmsm[${urlJsString(load.r)}]`;
          lastIndex = end;
        }
        // dynamic import
        else {
          resolvedSource += `${source.slice(lastIndex, dynamicImportIndex + 6)}Shim(${source.slice(start, end)}, ${load.r && urlJsString(load.r)}`;
          lastIndex = end;
        }
      }

      resolvedSource += source.slice(lastIndex);
    }

    resolvedSource = resolvedSource.replace(/\/\/# sourceMappingURL=(.*)\s*$/, (match, url) => {
      return match.replace(url, new URL(url, load.r));
    });
    let hasSourceURL = false;
    resolvedSource = resolvedSource.replace(/\/\/# sourceURL=(.*)\s*$/, (match, url) => {
      hasSourceURL = true;
      return match.replace(url, new URL(url, load.r));
    });
    if (!hasSourceURL) {
      resolvedSource += '\n//# sourceURL=' + load.r;
    }

    load.b = lastLoad = createBlob(resolvedSource);
    load.S = undefined;
  }

  const jsContentType = /^(text|application)\/(x-)?javascript(;|$)/;
  const jsonContentType = /^(text|application)\/json(;|$)/;
  const cssContentType = /^(text|application)\/css(;|$)/;
  const wasmContentType = /^application\/wasm(;|$)/;

  const cssUrlRegEx = /url\(\s*(?:(["'])((?:\\.|[^\n\\"'])+)\1|((?:\\.|[^\s,"'()\\])+))\s*\)/g;

  // restrict in-flight fetches to a pool of 100
  let p = [];
  let c = 0;
  function pushFetchPool () {
    if (++c > 100)
      return new Promise(r => p.push(r));
  }
  function popFetchPool () {
    c--;
    if (p.length)
      p.shift()();
  }

  async function doFetch (url, fetchOpts) {
    const poolQueue = pushFetchPool();
    if (poolQueue) await poolQueue;
    try {
      var res = await fetchHook(url, fetchOpts);
    }
    finally {
      popFetchPool();
    }
    if (!res.ok)
      throw new Error(`${res.status} ${res.statusText} ${res.url}`);
    const contentType = res.headers.get('content-type');
    if (jsContentType.test(contentType))
      return { r: res.url, s: await res.text(), t: 'js' };
    else if (jsonContentType.test(contentType))
      return { r: res.url, s: `export default ${await res.text()}`, t: 'json' };
    else if (cssContentType.test(contentType))
      return { r: res.url, s: `var s=new CSSStyleSheet();s.replaceSync(${
      JSON.stringify((await res.text()).replace(cssUrlRegEx, (_match, quotes, relUrl1, relUrl2) => `url(${quotes}${resolveUrl(relUrl1 || relUrl2, url)}${quotes})`))
    });export default s;`, t: 'css' };
    else if (wasmContentType.test(contentType))
      throw new Error('WASM modules not yet supported');
    else
      throw new Error(`Unknown Content-Type "${contentType}"`);
  }

  function getOrCreateLoad (url, fetchOpts, source) {
    let load = registry[url];
    if (load)
      return load;

    load = registry[url] = {
      // url
      u: url,
      // response url
      r: undefined,
      // fetchPromise
      f: undefined,
      // source
      S: undefined,
      // linkPromise
      L: undefined,
      // analysis
      a: undefined,
      // deps
      d: undefined,
      // blobUrl
      b: undefined,
      // shellUrl
      s: undefined,
      // needsShim
      n: false,
      // type
      t: null
    };

    load.f = (async () => {
      if (!source) {
        // preload fetch options override fetch options (race)
        let t;
        ({ r: load.r, s: source, t } = await (fetchCache[url] || doFetch(url, fetchOpts)));
        if (t && !shimMode) {
          if (t === 'css' && !cssModulesEnabled || t === 'json' && !jsonModulesEnabled)
            throw new Error(`${t}-modules must be enabled to polyfill via: window.esmsInitOptions = { polyfillEnable: ['${t}-modules'] }`);
          if (t === 'css' && !supportsCssAssertions || t === 'json' && !supportsJsonAssertions)
            load.n = true;
        }
      }
      try {
        load.a = parse(source, load.u);
      }
      catch (e) {
        console.warn(e);
        load.a = [[], []];
      }
      load.S = source;
      return load;
    })();

    load.L = load.f.then(async () => {
      let childFetchOpts = fetchOpts;
      load.d = (await Promise.all(load.a[0].map(async ({ n, d }) => {
        if (d >= 0 && !supportsDynamicImport || d === 2 && !supportsImportMeta)
          load.n = true;
        if (!n) return;
        const { r, b } = await resolve(n, load.r || load.u);
        if (b && !supportsImportMaps)
          load.n = true;
        if (d !== -1) return;
        if (!r)
          throwUnresolved(n, load.r || load.u);
        if (skip.test(r)) return { b: r };
        if (childFetchOpts.integrity)
          childFetchOpts = Object.assign({}, childFetchOpts, { integrity: undefined });
        return getOrCreateLoad(r, childFetchOpts).f;
      }))).filter(l => l);
    });

    return load;
  }

  const scriptQuery = 'script[type="module-shim"],script[type="importmap-shim"],script[type="module"],script[type="importmap"]';
  const preloadQuery = 'link[rel="modulepreload"]';

  function processScripts () {
    for (const link of document.querySelectorAll(preloadQuery))
      processPreload(link);
    const scripts = document.querySelectorAll(scriptQuery);
    // early shim mode opt-in
    if (!shimMode) {
      for (const script of scripts) {
        if (script.type.endsWith('-shim'))
          setShimMode();
      }
    }
    for (const script of scripts)
      processScript(script);
  }

  function getFetchOpts (script) {
    const fetchOpts = {};
    if (script.integrity)
      fetchOpts.integrity = script.integrity;
    if (script.referrerpolicy)
      fetchOpts.referrerPolicy = script.referrerpolicy;
    if (script.crossorigin === 'use-credentials')
      fetchOpts.credentials = 'include';
    else if (script.crossorigin === 'anonymous')
      fetchOpts.credentials = 'omit';
    else
      fetchOpts.credentials = 'same-origin';
    return fetchOpts;
  }

  let lastStaticLoadPromise = Promise.resolve();

  let domContentLoadedCnt = 1;
  function domContentLoadedCheck () {
    if (--domContentLoadedCnt === 0 && !noLoadEventRetriggers)
      document.dispatchEvent(new Event('DOMContentLoaded'));
  }
  // this should always trigger because we assume es-module-shims is itself a domcontentloaded requirement
  document.addEventListener('DOMContentLoaded', domContentLoadedCheck);

  let readyStateCompleteCnt = 1;
  if (document.readyState === 'complete')
    readyStateCompleteCheck();
  else
    document.addEventListener('readystatechange', readyStateCompleteCheck);
  function readyStateCompleteCheck () {
    if (--readyStateCompleteCnt === 0 && !noLoadEventRetriggers)
      document.dispatchEvent(new Event('readystatechange'));
  }

  function processScript (script) {
    if (script.ep) // ep marker = script processed
      return;
    const shim = script.type.endsWith('-shim');
    if (shim && !shimMode) setShimMode();
    const type = shimMode ? script.type.slice(0, -5) : script.type;
    // dont process module scripts in shim mode or noshim module scripts in polyfill mode
    if (!shim && shimMode || script.getAttribute('noshim') !== null)
      return;
    // empty inline scripts sometimes show before domready
    if (!script.src && !script.innerHTML)
      return;
    script.ep = true;
    if (type === 'module') {
      // does this load block readystate complete
      const isReadyScript = readyStateCompleteCnt > 0;
      // does this load block DOMContentLoaded
      const isDomContentLoadedScript = domContentLoadedCnt > 0;
      if (isReadyScript) readyStateCompleteCnt++;
      if (isDomContentLoadedScript) domContentLoadedCnt++;
      const loadPromise = topLevelLoad(script.src || `${baseUrl}?${id++}`, getFetchOpts(script), !script.src && script.innerHTML, !shimMode, isReadyScript && lastStaticLoadPromise).then(() => {
        if (!noLoadEventRetriggers)
          triggerLoadEvent(script);
      }).catch(e => {
        if (!noLoadEventRetriggers)
          triggerLoadEvent(script);
        // setTimeout(() => { throw e; });
        onerror(e);
      });
      if (isReadyScript)
        lastStaticLoadPromise = loadPromise.then(readyStateCompleteCheck);
      if (isDomContentLoadedScript)
        loadPromise.then(domContentLoadedCheck);
    }
    else if (acceptingImportMaps && type === 'importmap') {
      // we dont currently support multiple, external or dynamic imports maps in polyfill mode to match native
      if (script.src || !nativeAcceptingImportMaps) {
        if (!shimMode)
          return;
        importMapSrcOrLazy = true;
      }
      if (!shimMode) {
        acceptingImportMaps = false;
      }
      else {
        nativeAcceptingImportMaps = false;
      }
      importMapPromise = importMapPromise.then(async () => {
        importMap = resolveAndComposeImportMap(script.src ? await (await fetchHook(script.src)).json() : JSON.parse(script.innerHTML), script.src || baseUrl, importMap);
      });
    }
  }

  function triggerLoadEvent (script) {
    script.dispatchEvent(new Event('load'));
  }

  const fetchCache = {};
  function processPreload (link) {
    if (link.ep) // ep marker = processed
      return;
    link.ep = true;
    if (fetchCache[link.href])
      return;
    fetchCache[link.href] = doFetch(link.href, getFetchOpts(link));
  }

  new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      for (const node of mutation.addedNodes) {
        if (node.tagName === 'SCRIPT' && node.type)
          processScript(node);
        else if (node.tagName === 'LINK' && node.rel === 'modulepreload')
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });

  function throwUnresolved (id, parentUrl) {
    throw Error("Unable to resolve specifier '" + id + (parentUrl ? "' from " + parentUrl : "'"));
  }

  processScripts();

}());