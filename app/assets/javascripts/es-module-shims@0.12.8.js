/* ES Module Shims 0.12.8 */
(function () {
  // Bail on all shimming for Chrome until https://github.com/guybedford/es-module-shims/issues/150
  if (navigator.userAgent.match("Chrome")) return

  const resolvedPromise = Promise.resolve();

  let baseUrl;

  function createBlob (source, type = 'text/javascript') {
    return URL.createObjectURL(new Blob([source], { type }));
  }

  const hasDocument = typeof document !== 'undefined';

  // support browsers without dynamic import support (eg Firefox 6x)
  let supportsDynamicImport = false;
  let supportsJsonAssertions = false;
  let supportsCssAssertions = false;
  let dynamicImport;
  try {
    dynamicImport = (0, eval)('u=>import(u)');
    supportsDynamicImport = true;
  }
  catch (e) {
    if (hasDocument) {
      let err;
      self.addEventListener('error', e => err = e.error);
      dynamicImport = blobUrl => {
        const topLevelBlobUrl = createBlob(
          `import*as m from'${blobUrl}';self._esmsi=m;`
        );
        const s = document.createElement('script');
        s.type = 'module';
        s.src = topLevelBlobUrl;
        document.head.appendChild(s);
        return new Promise((resolve, reject) => {
          s.addEventListener('load', () => {
            document.head.removeChild(s);
            if (self._esmsi) {
              resolve(self._esmsi, baseUrl);
              self._esmsi = null;
            }
            else {
              reject(err);
            }
          });
        });
      };
    }
  }

  let supportsImportMeta = false;
  let supportsImportMaps = false;

  const featureDetectionPromise = Promise.all([
    dynamicImport(createBlob('import"data:text/css,{}"assert{type:"css"}')).then(() => supportsCssAssertions = true, () => {}),
    dynamicImport(createBlob('import"data:text/json,{}"assert{type:"json"}')).then(() => supportsJsonAssertions = true, () => {}),
    dynamicImport(createBlob('import.meta')).then(() => supportsImportMeta = true, () => {}),
    supportsDynamicImport && hasDocument && new Promise(resolve => {
      self._$s = v => {
        document.body.removeChild(iframe);
        if (v) supportsImportMaps = true;
        delete self._$s;
        resolve();
      };
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.srcdoc = `<script type=importmap>{"imports":{"x":"data:text/javascript,"}}<${''}/script><script>import('x').then(()=>1,()=>0).then(v=>parent._$s(v))<${''}/script>`, 'text/html';
      document.body.appendChild(iframe);
    })
  ]);

  if (hasDocument) {
    const baseEl = document.querySelector('base[href]');
    if (baseEl)
      baseUrl = baseEl.href;
  }

  if (!baseUrl && typeof location !== 'undefined') {
    baseUrl = location.href.split('#')[0].split('?')[0];
    const lastSepIndex = baseUrl.lastIndexOf('/');
    if (lastSepIndex !== -1)
      baseUrl = baseUrl.slice(0, lastSepIndex + 1);
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

  /* es-module-lexer 0.7.1 */
  const A=1===new Uint8Array(new Uint16Array([1]).buffer)[0];function parse(E,g="@"){if(!C)return init.then(()=>parse(E));const I=E.length+1,D=(C.__heap_base.value||C.__heap_base)+4*I-C.memory.buffer.byteLength;D>0&&C.memory.grow(Math.ceil(D/65536));const w=C.sa(I-1);if((A?B:Q)(E,new Uint16Array(C.memory.buffer,w,I)),!C.parse())throw Object.assign(new Error(`Parse error ${g}:${E.slice(0,C.e()).split("\n").length}:${C.e()-E.lastIndexOf("\n",C.e()-1)}`),{idx:C.e()});const L=[],k=[];for(;C.ri();){const A=C.is(),Q=C.ie(),B=C.ai(),g=C.id(),I=C.ss(),D=C.se();let w;C.ip()&&(w=o(E.slice(-1===g?A-1:A,-1===g?Q+1:Q))),L.push({n:w,s:A,e:Q,ss:I,se:D,d:g,a:B});}for(;C.re();)k.push(E.slice(C.es(),C.ee()));function o(A){try{return (0,eval)(A)}catch{}}return [L,k,!!C.f()]}function Q(A,Q){const B=A.length;let C=0;for(;C<B;){const B=A.charCodeAt(C);Q[C++]=(255&B)<<8|B>>>8;}}function B(A,Q){const B=A.length;let C=0;for(;C<B;)Q[C]=A.charCodeAt(C++);}let C;const init=WebAssembly.compile((E="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","undefined"!=typeof Buffer?Buffer.from(E,"base64"):Uint8Array.from(atob(E),A=>A.charCodeAt(0)))).then(WebAssembly.instantiate).then(({exports:A})=>{C=A;});var E;

  let id = 0;
  const registry = {};
  if (self.ESMS_DEBUG) {
    self._esmsr = registry;
  }

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
  let importMapPromise = resolvedPromise;

  let waitingForImportMapsInterval;
  let firstTopLevelProcess = true;
  async function topLevelLoad (url, fetchOpts, source, nativelyLoaded, lastStaticLoadPromise) {
    // no need to even fetch if we have feature support
    await featureDetectionPromise;
    if (waitingForImportMapsInterval > 0) {
      clearTimeout(waitingForImportMapsInterval);
      waitingForImportMapsInterval = 0;
    }
    if (firstTopLevelProcess) {
      firstTopLevelProcess = false;
      processScripts();
    }
    await importMapPromise;
    // early analysis opt-out
    if (nativelyLoaded && supportsDynamicImport && supportsImportMeta && supportsImportMaps && supportsJsonAssertions && supportsCssAssertions && !importMapSrcOrLazy) {
      // dont reexec inline for polyfills -> just return null (since no module id for executed inline module scripts)
      return source && nativelyLoaded ? null : dynamicImport(source ? createBlob(source) : url);
    }
    await init;
    const load = getOrCreateLoad(url, fetchOpts, source);
    const seen = {};
    await loadAll(load, seen);
    lastLoad = undefined;
    resolveDeps(load, seen);
    await lastStaticLoadPromise;
    if (source && !shimMode && !load.n) {
      if (lastStaticLoadPromise) {
        didExecForReadyPromise = true;
        if (domContentLoaded)
          didExecForDomContentLoaded = true;
      }
      const module = dynamicImport(createBlob(source));
      if (shouldRevokeBlobURLs) revokeObjectURLs(Object.keys(seen));
      return module;
    }
    const module = await dynamicImport(load.b);
    if (lastStaticLoadPromise && (!nativelyLoaded || load.b !== load.u)) {
      didExecForReadyPromise = true;
      if (domContentLoaded)
        didExecForDomContentLoaded = true;
    }
    // if the top-level load is a shell, run its update function
    if (load.s) {
      (await dynamicImport(load.s)).u$_(module);
    }
    if (shouldRevokeBlobURLs) revokeObjectURLs(Object.keys(seen));
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
    await featureDetectionPromise;
    // Make sure all the "in-flight" import maps are loaded and applied.
    await importMapPromise;
    const resolved = await resolve(id, parentUrl);
    return topLevelLoad(resolved.r || throwUnresolved(id, parentUrl), { credentials: 'same-origin' });
  }

  self.importShim = importShim;

  const meta = {};

  const edge = navigator.userAgent.match(/Edge\/\d\d\.\d+$/);

  async function importMetaResolve (id, parentUrl = this.url) {
    await importMapPromise;
    const resolved = await resolve(id, `${parentUrl}`);
    return resolved.r || throwUnresolved(id, parentUrl);
  }

  self._esmsm = meta;

  const esmsInitOptions = self.esmsInitOptions || {};
  delete self.esmsInitOptions;
  let shimMode = typeof esmsInitOptions.shimMode === 'boolean' ? esmsInitOptions.shimMode : !!esmsInitOptions.fetch || !!document.querySelector('script[type="module-shim"],script[type="importmap-shim"]');
  const fetchHook = esmsInitOptions.fetch || ((url, opts) => fetch(url, opts));
  const skip = esmsInitOptions.skip || /^https?:\/\/(cdn\.skypack\.dev|jspm\.dev)\//;
  const onerror = esmsInitOptions.onerror || ((e) => { throw e; });
  const shouldRevokeBlobURLs = esmsInitOptions.revokeBlobURLs;
  const noLoadEventRetriggers = esmsInitOptions.noLoadEventRetriggers;

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
  const jsonContentType = /^application\/json(;|$)/;
  const cssContentType = /^text\/css(;|$)/;
  const wasmContentType = /^application\/wasm(;|$)/;

  const cssUrlRegEx = /url\(\s*(?:(["'])((?:\\.|[^\n\\"'])+)\1|((?:\\.|[^\s,"'()\\])+))\s*\)/g;

  async function doFetch (url, fetchOpts) {
    const res = await fetchHook(url, fetchOpts);
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
        if (t === 'css' && !supportsCssAssertions || t === 'json' && !supportsJsonAssertions)
          load.n = true;
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
      load.d = (await Promise.all(load.a[0].map(async ({ n, d, a }) => {
        if (d >= 0 && !supportsDynamicImport ||
            d === 2 && (!supportsImportMeta || source.slice(end, end + 8) === '.resolve'))
          load.n = true;
        if (!n) return;
        const { r, m } = await resolve(n, load.r || load.u);
        if (m && (!supportsImportMaps || importMapSrcOrLazy))
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

  function processScripts () {
    if (waitingForImportMapsInterval > 0 && document.readyState !== 'loading') {
      clearTimeout(waitingForImportMapsInterval);
      waitingForImportMapsInterval = 0;
    }
    for (const link of document.querySelectorAll('link[rel="modulepreload"]'))
      processPreload(link);
    for (const script of document.querySelectorAll('script[type="module-shim"],script[type="importmap-shim"],script[type="module"],script[type="importmap"]'))
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

  let staticLoadCnt = 0;
  let didExecForReadyPromise = false;
  let didExecForDomContentLoaded = false;
  let lastStaticLoadPromise = Promise.resolve();
  let domContentLoaded = false;
  document.addEventListener('DOMContentLoaded', () => domContentLoaded = true);
  function staticLoadCheck () {
    staticLoadCnt--;
    if (staticLoadCnt === 0 && !noLoadEventRetriggers) {
      if (didExecForDomContentLoaded)
        document.dispatchEvent(new Event('DOMContentLoaded'));
      if (didExecForReadyPromise && document.readyState === 'complete')
        document.dispatchEvent(new Event('readystatechange'));
    }
  }

  function processScript (script, dynamic) {
    if (script.ep) // ep marker = script processed
      return;
    const shim = script.type.endsWith('-shim');
    if (shim) shimMode = true;
    const type = shimMode ? script.type.slice(0, -5) : script.type;
    // dont process module scripts in shim mode or noshim module scripts in polyfill mode
    if (!shim && shimMode || script.getAttribute('noshim') !== null)
      return;
    // empty inline scripts sometimes show before domready
    if (!script.src && !script.innerHTML)
      return;
    script.ep = true;
    if (type === 'module') {
      const isReadyScript = document.readyState !== 'complete';
      if (isReadyScript) staticLoadCnt++;
      const p = topLevelLoad(script.src || `${baseUrl}?${id++}`, getFetchOpts(script), !script.src && script.innerHTML, !shimMode, isReadyScript && lastStaticLoadPromise);
      p.catch(onerror);
      if (isReadyScript) {
        lastStaticLoadPromise = p.catch(staticLoadCheck);
        p.then(staticLoadCheck);
      }
    }
    else if (type === 'importmap') {
      importMapPromise = importMapPromise.then(async () => {
        if (script.src || dynamic)
          importMapSrcOrLazy = true;
        importMap = resolveAndComposeImportMap(script.src ? await (await fetchHook(script.src)).json() : JSON.parse(script.innerHTML), script.src || baseUrl, importMap);
      });
    }
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
          processScript(node, !firstTopLevelProcess);
        else if (node.tagName === 'LINK' && node.rel === 'modulepreload')
          processPreload(node);
        else if (node.querySelectorAll) {
          for (const script of node.querySelectorAll('script[type="module-shim"],script[type="importmap-shim"],script[type="module"],script[type="importmap"]')) {
            processScript(script, !firstTopLevelProcess);
          }
          for (const link of node.querySelectorAll('link[rel=modulepreload]')) {
            processPreload(link);
          }
        }
      }
    }
  }).observe(document, { childList: true, subtree: true });

  async function defaultResolve (id, parentUrl) {
    return resolveImportMap(importMap, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl);
  }

  async function resolve (id, parentUrl) {
    let urlResolved = resolveIfNotPlainOrUrl(id, parentUrl);

    let resolved;
    if (esmsInitOptions.resolve) {
      resolved = await esmsInitOptions.resolve(id, parentUrl, defaultResolve);
    }
    else {
      resolved = resolveImportMap(importMap, urlResolved || id, parentUrl);
    }

    return { r: resolved, m: urlResolved !== resolved };
  }

  function throwUnresolved (id, parentUrl) {
    throw Error("Unable to resolve specifier '" + id + (parentUrl ? "' from " + parentUrl : "'"));
  }

  if (hasDocument) {
    processScripts();
    waitingForImportMapsInterval = setInterval(processScripts, 20);
  }

}());