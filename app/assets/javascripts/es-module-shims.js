/* ES Module Shims 1.5.8 */
(function () {

  const hasWindow = typeof window !== 'undefined';
  const hasDocument = typeof document !== 'undefined';

  const noop = () => {};

  const optionsScript = hasDocument ? document.querySelector('script[type=esms-options]') : undefined;

  const esmsInitOptions = optionsScript ? JSON.parse(optionsScript.innerHTML) : {};
  Object.assign(esmsInitOptions, self.esmsInitOptions || {});

  let shimMode = hasDocument ? !!esmsInitOptions.shimMode : true;

  const importHook = globalHook(shimMode && esmsInitOptions.onimport);
  const resolveHook = globalHook(shimMode && esmsInitOptions.resolve);
  let fetchHook = esmsInitOptions.fetch ? globalHook(esmsInitOptions.fetch) : fetch;
  const metaHook = esmsInitOptions.meta ? globalHook(shimModule && esmsInitOptions.meta) : noop;

  const skip = esmsInitOptions.skip ? new RegExp(esmsInitOptions.skip) : null;

  const mapOverrides = esmsInitOptions.mapOverrides;

  let nonce = esmsInitOptions.nonce;
  if (!nonce && hasDocument) {
    const nonceElement = document.querySelector('script[nonce]');
    if (nonceElement)
      nonce = nonceElement.nonce || nonceElement.getAttribute('nonce');
  }

  const onerror = globalHook(esmsInitOptions.onerror || noop);
  const onpolyfill = esmsInitOptions.onpolyfill ? globalHook(esmsInitOptions.onpolyfill) : () => {
    console.log('%c^^ Module TypeError above is polyfilled and can be ignored ^^', 'font-weight:900;color:#391');
  };

  const { revokeBlobURLs, noLoadEventRetriggers, enforceIntegrity } = esmsInitOptions;

  function globalHook (name) {
    return typeof name === 'string' ? self[name] : name;
  }

  const enable = Array.isArray(esmsInitOptions.polyfillEnable) ? esmsInitOptions.polyfillEnable : [];
  const cssModulesEnabled = enable.includes('css-modules');
  const jsonModulesEnabled = enable.includes('json-modules');

  function setShimMode () {
    shimMode = true;
  }

  const edge = !navigator.userAgentData && !!navigator.userAgent.match(/Edge\/\d+\.\d+/);

  const baseUrl = hasDocument
    ? document.baseURI
    : `${location.protocol}//${location.host}${location.pathname.includes('/') 
    ? location.pathname.slice(0, location.pathname.lastIndexOf('/') + 1) 
    : location.pathname}`;

  function createBlob (source, type = 'text/javascript') {
    return URL.createObjectURL(new Blob([source], { type }));
  }

  const eoop = err => setTimeout(() => { throw err });

  const throwError = err => { (self.reportError || hasWindow && window.safari && console.error || eoop)(err), void onerror(err); };

  function fromParent (parent) {
    return parent ? ` imported from ${parent}` : '';
  }

  const backslashRegEx = /\\/g;

  function isURL (url) {
    if (url.indexOf(':') === -1) return false;
    try {
      new URL(url);
      return true;
    }
    catch (_) {
      return false;
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
    return resolveIfNotPlainOrUrl(relUrl, parentUrl) || (isURL(relUrl) ? relUrl : resolveIfNotPlainOrUrl('./' + relUrl, parentUrl));
  }

  function resolveIfNotPlainOrUrl (relUrl, parentUrl) {
    // strip off any trailing query params or hashes
    const queryHashIndex = parentUrl.indexOf('?', parentUrl.indexOf('#') === -1 ? parentUrl.indexOf('#') : parentUrl.length);
    if (queryHashIndex !== -1)
      parentUrl = parentUrl.slice(0, queryHashIndex);
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
          continue;
        }
        // new segment - check if it is relative
        else if (segmented[i] === '.') {
          // ../ segment
          if (segmented[i + 1] === '.' && (segmented[i + 2] === '/' || i + 2 === segmented.length)) {
            output.pop();
            i += 2;
            continue;
          }
          // ./ segment
          else if (segmented[i + 1] === '/' || i + 1 === segmented.length) {
            i += 1;
            continue;
          }
        }
        // it is the start of a new segment
        while (segmented[i] === '/') i++;
        segmentIndex = i; 
      }
      // finish reading out the last segment
      if (segmentIndex !== -1)
        output.push(segmented.slice(segmentIndex));
      return parentUrl.slice(0, parentUrl.length - pathname.length) + output.join('');
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
      return pkg + id.slice(pkgName.length);
    }
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

  function resolveAndComposePackages (packages, outPackages, baseUrl, parentMap) {
    for (let p in packages) {
      const resolvedLhs = resolveIfNotPlainOrUrl(p, baseUrl) || p;
      if ((!shimMode || !mapOverrides) && outPackages[resolvedLhs] && (outPackages[resolvedLhs] !== packages[resolvedLhs])) {
        throw Error(`Rejected map override "${resolvedLhs}" from ${outPackages[resolvedLhs]} to ${packages[resolvedLhs]}.`);
      }
      let target = packages[p];
      if (typeof target !== 'string')
        continue;
      const mapped = resolveImportMap(parentMap, resolveIfNotPlainOrUrl(target, baseUrl) || target, baseUrl);
      if (mapped) {
        outPackages[resolvedLhs] = mapped;
        continue;
      }
      console.warn(`Mapping "${p}" -> "${packages[p]}" does not resolve`);
    }
  }

  let err;
  window.addEventListener('error', _err => err = _err);
  function dynamicImportScript (url, { errUrl = url } = {}) {
    err = undefined;
    const src = createBlob(`import*as m from'${url}';self._esmsi=m`);
    const s = Object.assign(document.createElement('script'), { type: 'module', src });
    s.setAttribute('nonce', nonce);
    s.setAttribute('noshim', '');
    const p =  new Promise((resolve, reject) => {
      // Safari is unique in supporting module script error events
      s.addEventListener('error', cb);
      s.addEventListener('load', cb);

      function cb (_err) {
        document.head.removeChild(s);
        if (self._esmsi) {
          resolve(self._esmsi, baseUrl);
          self._esmsi = undefined;
        }
        else {
          reject(!(_err instanceof Event) && _err || err && err.error || new Error(`Error loading or executing the graph of ${errUrl} (check the console for ${src}).`));
          err = undefined;
        }
      }
    });
    document.head.appendChild(s);
    return p;
  }

  let dynamicImport = dynamicImportScript;

  const supportsDynamicImportCheck = dynamicImportScript(createBlob('export default u=>import(u)')).then(_dynamicImport => {
    if (_dynamicImport)
      dynamicImport = _dynamicImport.default;
    return !!_dynamicImport;
  }, noop);

  // support browsers without dynamic import support (eg Firefox 6x)
  let supportsJsonAssertions = false;
  let supportsCssAssertions = false;

  let supportsImportMaps = hasDocument && HTMLScriptElement.supports ? HTMLScriptElement.supports('importmap') : false;
  let supportsImportMeta = supportsImportMaps;
  let supportsDynamicImport = false;

  const featureDetectionPromise = Promise.resolve(supportsImportMaps || supportsDynamicImportCheck).then(_supportsDynamicImport => {
    if (!_supportsDynamicImport)
      return;
    supportsDynamicImport = true;

    return Promise.all([
      supportsImportMaps || dynamicImport(createBlob('import.meta')).then(() => supportsImportMeta = true, noop),
      cssModulesEnabled && dynamicImport(createBlob(`import"${createBlob('', 'text/css')}"assert{type:"css"}`)).then(() => supportsCssAssertions = true, noop),
      jsonModulesEnabled && dynamicImport(createBlob(`import"${createBlob('{}', 'text/json')}"assert{type:"json"}`)).then(() => supportsJsonAssertions = true, noop),
      supportsImportMaps || hasDocument && (HTMLScriptElement.supports || new Promise(resolve => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.setAttribute('nonce', nonce);
        // setting src to a blob URL results in a navigation event in webviews
        // setting srcdoc is not supported in React native webviews on iOS
        // therefore, we need to first feature detect srcdoc support
        iframe.srcdoc = `<!doctype html><script nonce="${nonce}"><${''}/script>`;
        document.head.appendChild(iframe);
        iframe.onload = () => {
          self._$s = v => {
            document.head.removeChild(iframe);
            supportsImportMaps = v;
            delete self._$s;
            resolve();
          };
          const supportsSrcDoc = iframe.contentDocument.head.childNodes.length > 0;
          const importMapTest = `<!doctype html><script type=importmap nonce="${nonce}">{"imports":{"x":"${createBlob('')}"}<${''}/script><script nonce="${nonce}">import('x').catch(() => {}).then(v=>parent._$s(!!v))<${''}/script>`;
          if (supportsSrcDoc)
            iframe.srcdoc = importMapTest;
          else
            iframe.contentDocument.write(importMapTest);
        };
      }))
    ]);
  });

  /* es-module-lexer 0.10.5 */
  let e,a,r,s=2<<19;const i=1===new Uint8Array(new Uint16Array([1]).buffer)[0]?function(e,a){const r=e.length;let s=0;for(;s<r;)a[s]=e.charCodeAt(s++);}:function(e,a){const r=e.length;let s=0;for(;s<r;){const r=e.charCodeAt(s);a[s++]=(255&r)<<8|r>>>8;}},t="xportmportlassetafromssertvoyiedeleinstantyreturdebuggeawaithrwhileforifcatcfinallels";let c$1,f,n;function parse(k,l="@"){c$1=k,f=l;const u=2*c$1.length+(2<<18);if(u>s||!e){for(;u>s;)s*=2;a=new ArrayBuffer(s),i(t,new Uint16Array(a,16,85)),e=function(e,a,r){"use asm";var s=new e.Int8Array(r),i=new e.Int16Array(r),t=new e.Int32Array(r),c=new e.Uint8Array(r),f=new e.Uint16Array(r),n=992;function b(e){e=e|0;var a=0,r=0,c=0,b=0,u=0,w=0,v=0;v=n;n=n+11520|0;u=v+2048|0;s[763]=1;i[377]=0;i[378]=0;i[379]=0;i[380]=-1;t[57]=t[2];s[764]=0;t[56]=0;s[762]=0;t[58]=v+10496;t[59]=v+2304;t[60]=v;s[765]=0;e=(t[3]|0)+-2|0;t[61]=e;a=e+(t[54]<<1)|0;t[62]=a;e:while(1){r=e+2|0;t[61]=r;if(e>>>0>=a>>>0){b=18;break}a:do{switch(i[r>>1]|0){case 9:case 10:case 11:case 12:case 13:case 32:break;case 101:{if((((i[379]|0)==0?D(r)|0:0)?(m(e+4|0,16,10)|0)==0:0)?(k(),(s[763]|0)==0):0){b=9;break e}else b=17;break}case 105:{if(D(r)|0?(m(e+4|0,26,10)|0)==0:0){l();b=17;}else b=17;break}case 59:{b=17;break}case 47:switch(i[e+4>>1]|0){case 47:{j();break a}case 42:{y(1);break a}default:{b=16;break e}}default:{b=16;break e}}}while(0);if((b|0)==17){b=0;t[57]=t[61];}e=t[61]|0;a=t[62]|0;}if((b|0)==9){e=t[61]|0;t[57]=e;b=19;}else if((b|0)==16){s[763]=0;t[61]=e;b=19;}else if((b|0)==18)if(!(s[762]|0)){e=r;b=19;}else e=0;do{if((b|0)==19){e:while(1){a=e+2|0;t[61]=a;c=a;if(e>>>0>=(t[62]|0)>>>0){b=75;break}a:do{switch(i[a>>1]|0){case 9:case 10:case 11:case 12:case 13:case 32:break;case 101:{if(((i[379]|0)==0?D(a)|0:0)?(m(e+4|0,16,10)|0)==0:0){k();b=74;}else b=74;break}case 105:{if(D(a)|0?(m(e+4|0,26,10)|0)==0:0){l();b=74;}else b=74;break}case 99:{if((D(a)|0?(m(e+4|0,36,8)|0)==0:0)?M(i[e+12>>1]|0)|0:0){s[765]=1;b=74;}else b=74;break}case 40:{r=t[57]|0;c=t[59]|0;b=i[379]|0;i[379]=b+1<<16>>16;t[c+((b&65535)<<2)>>2]=r;b=74;break}case 41:{a=i[379]|0;if(!(a<<16>>16)){b=36;break e}a=a+-1<<16>>16;i[379]=a;r=i[378]|0;if(r<<16>>16!=0?(w=t[(t[60]|0)+((r&65535)+-1<<2)>>2]|0,(t[w+20>>2]|0)==(t[(t[59]|0)+((a&65535)<<2)>>2]|0)):0){a=w+4|0;if(!(t[a>>2]|0))t[a>>2]=c;t[w+12>>2]=e+4;i[378]=r+-1<<16>>16;b=74;}else b=74;break}case 123:{b=t[57]|0;c=t[51]|0;e=b;do{if((i[b>>1]|0)==41&(c|0)!=0?(t[c+4>>2]|0)==(b|0):0){a=t[52]|0;t[51]=a;if(!a){t[47]=0;break}else {t[a+28>>2]=0;break}}}while(0);r=i[379]|0;b=r&65535;s[u+b>>0]=s[765]|0;s[765]=0;c=t[59]|0;i[379]=r+1<<16>>16;t[c+(b<<2)>>2]=e;b=74;break}case 125:{e=i[379]|0;if(!(e<<16>>16)){b=49;break e}r=e+-1<<16>>16;i[379]=r;a=i[380]|0;if(e<<16>>16!=a<<16>>16)if(a<<16>>16!=-1&(r&65535)<(a&65535)){b=53;break e}else {b=74;break a}else {c=t[58]|0;b=(i[377]|0)+-1<<16>>16;i[377]=b;i[380]=i[c+((b&65535)<<1)>>1]|0;h();b=74;break a}}case 39:{d(39);b=74;break}case 34:{d(34);b=74;break}case 47:switch(i[e+4>>1]|0){case 47:{j();break a}case 42:{y(1);break a}default:{a=t[57]|0;r=i[a>>1]|0;r:do{if(!(U(r)|0)){switch(r<<16>>16){case 41:if(q(t[(t[59]|0)+(f[379]<<2)>>2]|0)|0){b=71;break r}else {b=68;break r}case 125:break;default:{b=68;break r}}e=f[379]|0;if(!(p(t[(t[59]|0)+(e<<2)>>2]|0)|0)?(s[u+e>>0]|0)==0:0)b=68;else b=71;}else switch(r<<16>>16){case 46:if(((i[a+-2>>1]|0)+-48&65535)<10){b=68;break r}else {b=71;break r}case 43:if((i[a+-2>>1]|0)==43){b=68;break r}else {b=71;break r}case 45:if((i[a+-2>>1]|0)==45){b=68;break r}else {b=71;break r}default:{b=71;break r}}}while(0);r:do{if((b|0)==68){b=0;if(!(o(a)|0)){switch(r<<16>>16){case 0:{b=71;break r}case 47:break;default:{e=1;break r}}if(!(s[764]|0))e=1;else b=71;}else b=71;}}while(0);if((b|0)==71){g();e=0;}s[764]=e;b=74;break a}}case 96:{h();b=74;break}default:b=74;}}while(0);if((b|0)==74){b=0;t[57]=t[61];}e=t[61]|0;}if((b|0)==36){L();e=0;break}else if((b|0)==49){L();e=0;break}else if((b|0)==53){L();e=0;break}else if((b|0)==75){e=(i[380]|0)==-1&(i[379]|0)==0&(s[762]|0)==0&(i[378]|0)==0;break}}}while(0);n=v;return e|0}function k(){var e=0,a=0,r=0,c=0,f=0,n=0;f=t[61]|0;n=f+12|0;t[61]=n;a=w(1)|0;e=t[61]|0;if(!((e|0)==(n|0)?!(I(a)|0):0))c=3;e:do{if((c|0)==3){a:do{switch(a<<16>>16){case 100:{B(e,e+14|0);break e}case 97:{t[61]=e+10;w(1)|0;e=t[61]|0;c=6;break}case 102:{c=6;break}case 99:{if((m(e+2|0,36,8)|0)==0?(r=e+10|0,$(i[r>>1]|0)|0):0){t[61]=r;f=w(1)|0;n=t[61]|0;E(f)|0;B(n,t[61]|0);t[61]=(t[61]|0)+-2;break e}e=e+4|0;t[61]=e;c=13;break}case 108:case 118:{c=13;break}case 123:{t[61]=e+2;e=w(1)|0;r=t[61]|0;while(1){if(N(e)|0){d(e);e=(t[61]|0)+2|0;t[61]=e;}else {E(e)|0;e=t[61]|0;}w(1)|0;e=C(r,e)|0;if(e<<16>>16==44){t[61]=(t[61]|0)+2;e=w(1)|0;}a=r;r=t[61]|0;if(e<<16>>16==125){c=32;break}if((r|0)==(a|0)){c=29;break}if(r>>>0>(t[62]|0)>>>0){c=31;break}}if((c|0)==29){L();break e}else if((c|0)==31){L();break e}else if((c|0)==32){t[61]=r+2;c=34;break a}break}case 42:{t[61]=e+2;w(1)|0;c=t[61]|0;C(c,c)|0;c=34;break}default:{}}}while(0);if((c|0)==6){t[61]=e+16;e=w(1)|0;if(e<<16>>16==42){t[61]=(t[61]|0)+2;e=w(1)|0;}n=t[61]|0;E(e)|0;B(n,t[61]|0);t[61]=(t[61]|0)+-2;break}else if((c|0)==13){e=e+4|0;t[61]=e;s[763]=0;a:while(1){t[61]=e+2;n=w(1)|0;e=t[61]|0;switch((E(n)|0)<<16>>16){case 91:case 123:{c=15;break a}default:{}}a=t[61]|0;if((a|0)==(e|0))break e;B(e,a);switch((w(1)|0)<<16>>16){case 61:{c=19;break a}case 44:break;default:{c=20;break a}}e=t[61]|0;}if((c|0)==15){t[61]=(t[61]|0)+-2;break}else if((c|0)==19){t[61]=(t[61]|0)+-2;break}else if((c|0)==20){t[61]=(t[61]|0)+-2;break}}else if((c|0)==34)a=w(1)|0;e=t[61]|0;if(a<<16>>16==102?(m(e+2|0,52,6)|0)==0:0){t[61]=e+8;u(f,w(1)|0);break}t[61]=e+-2;}}while(0);return}function l(){var e=0,a=0,r=0,c=0,f=0;f=t[61]|0;a=f+12|0;t[61]=a;e:do{switch((w(1)|0)<<16>>16){case 40:{e=t[61]|0;a=t[59]|0;r=i[379]|0;i[379]=r+1<<16>>16;t[a+((r&65535)<<2)>>2]=e;if((i[t[57]>>1]|0)!=46){e=t[61]|0;t[61]=e+2;r=w(1)|0;v(f,t[61]|0,0,e);e=t[51]|0;a=t[60]|0;f=i[378]|0;i[378]=f+1<<16>>16;t[a+((f&65535)<<2)>>2]=e;switch(r<<16>>16){case 39:{d(39);break}case 34:{d(34);break}default:{t[61]=(t[61]|0)+-2;break e}}e=(t[61]|0)+2|0;t[61]=e;switch((w(1)|0)<<16>>16){case 44:{t[61]=(t[61]|0)+2;w(1)|0;r=t[51]|0;t[r+4>>2]=e;f=t[61]|0;t[r+16>>2]=f;s[r+24>>0]=1;t[61]=f+-2;break e}case 41:{i[379]=(i[379]|0)+-1<<16>>16;f=t[51]|0;t[f+4>>2]=e;t[f+12>>2]=(t[61]|0)+2;s[f+24>>0]=1;i[378]=(i[378]|0)+-1<<16>>16;break e}default:{t[61]=(t[61]|0)+-2;break e}}}break}case 46:{t[61]=(t[61]|0)+2;if(((w(1)|0)<<16>>16==109?(e=t[61]|0,(m(e+2|0,44,6)|0)==0):0)?(i[t[57]>>1]|0)!=46:0)v(f,f,e+8|0,2);break}case 42:case 39:case 34:{c=16;break}case 123:{e=t[61]|0;if(i[379]|0){t[61]=e+-2;break e}while(1){if(e>>>0>=(t[62]|0)>>>0)break;e=w(1)|0;if(!(N(e)|0)){if(e<<16>>16==125){c=31;break}}else d(e);e=(t[61]|0)+2|0;t[61]=e;}if((c|0)==31)t[61]=(t[61]|0)+2;w(1)|0;e=t[61]|0;if(m(e,50,8)|0){L();break e}t[61]=e+8;e=w(1)|0;if(N(e)|0){u(f,e);break e}else {L();break e}}default:if((t[61]|0)!=(a|0))c=16;}}while(0);do{if((c|0)==16){if(i[379]|0){t[61]=(t[61]|0)+-2;break}e=t[62]|0;a=t[61]|0;while(1){if(a>>>0>=e>>>0){c=23;break}r=i[a>>1]|0;if(N(r)|0){c=21;break}c=a+2|0;t[61]=c;a=c;}if((c|0)==21){u(f,r);break}else if((c|0)==23){L();break}}}while(0);return}function u(e,a){e=e|0;a=a|0;var r=0,s=0;r=(t[61]|0)+2|0;switch(a<<16>>16){case 39:{d(39);s=5;break}case 34:{d(34);s=5;break}default:L();}do{if((s|0)==5){v(e,r,t[61]|0,1);t[61]=(t[61]|0)+2;s=(w(0)|0)<<16>>16==97;a=t[61]|0;if(s?(m(a+2|0,58,10)|0)==0:0){t[61]=a+12;if((w(1)|0)<<16>>16!=123){t[61]=a;break}e=t[61]|0;r=e;e:while(1){t[61]=r+2;r=w(1)|0;switch(r<<16>>16){case 39:{d(39);t[61]=(t[61]|0)+2;r=w(1)|0;break}case 34:{d(34);t[61]=(t[61]|0)+2;r=w(1)|0;break}default:r=E(r)|0;}if(r<<16>>16!=58){s=16;break}t[61]=(t[61]|0)+2;switch((w(1)|0)<<16>>16){case 39:{d(39);break}case 34:{d(34);break}default:{s=20;break e}}t[61]=(t[61]|0)+2;switch((w(1)|0)<<16>>16){case 125:{s=25;break e}case 44:break;default:{s=24;break e}}t[61]=(t[61]|0)+2;if((w(1)|0)<<16>>16==125){s=25;break}r=t[61]|0;}if((s|0)==16){t[61]=a;break}else if((s|0)==20){t[61]=a;break}else if((s|0)==24){t[61]=a;break}else if((s|0)==25){s=t[51]|0;t[s+16>>2]=e;t[s+12>>2]=(t[61]|0)+2;break}}t[61]=a+-2;}}while(0);return}function o(e){e=e|0;e:do{switch(i[e>>1]|0){case 100:switch(i[e+-2>>1]|0){case 105:{e=S(e+-4|0,68,2)|0;break e}case 108:{e=S(e+-4|0,72,3)|0;break e}default:{e=0;break e}}case 101:{switch(i[e+-2>>1]|0){case 115:break;case 116:{e=S(e+-4|0,78,4)|0;break e}default:{e=0;break e}}switch(i[e+-4>>1]|0){case 108:{e=O(e+-6|0,101)|0;break e}case 97:{e=O(e+-6|0,99)|0;break e}default:{e=0;break e}}}case 102:{if((i[e+-2>>1]|0)==111?(i[e+-4>>1]|0)==101:0)switch(i[e+-6>>1]|0){case 99:{e=S(e+-8|0,86,6)|0;break e}case 112:{e=S(e+-8|0,98,2)|0;break e}default:{e=0;break e}}else e=0;break}case 110:{e=e+-2|0;if(O(e,105)|0)e=1;else e=S(e,102,5)|0;break}case 111:{e=O(e+-2|0,100)|0;break}case 114:{e=S(e+-2|0,112,7)|0;break}case 116:{e=S(e+-2|0,126,4)|0;break}case 119:switch(i[e+-2>>1]|0){case 101:{e=O(e+-4|0,110)|0;break e}case 111:{e=S(e+-4|0,134,3)|0;break e}default:{e=0;break e}}default:e=0;}}while(0);return e|0}function h(){var e=0,a=0,r=0;a=t[62]|0;r=t[61]|0;e:while(1){e=r+2|0;if(r>>>0>=a>>>0){a=8;break}switch(i[e>>1]|0){case 96:{a=9;break e}case 36:{if((i[r+4>>1]|0)==123){a=6;break e}break}case 92:{e=r+4|0;break}default:{}}r=e;}if((a|0)==6){t[61]=r+4;e=i[380]|0;a=t[58]|0;r=i[377]|0;i[377]=r+1<<16>>16;i[a+((r&65535)<<1)>>1]=e;r=(i[379]|0)+1<<16>>16;i[379]=r;i[380]=r;}else if((a|0)==8){t[61]=e;L();}else if((a|0)==9)t[61]=e;return}function w(e){e=e|0;var a=0,r=0,s=0;r=t[61]|0;e:do{a=i[r>>1]|0;a:do{if(a<<16>>16!=47)if(e)if(M(a)|0)break;else break e;else if(z(a)|0)break;else break e;else switch(i[r+2>>1]|0){case 47:{j();break a}case 42:{y(e);break a}default:{a=47;break e}}}while(0);s=t[61]|0;r=s+2|0;t[61]=r;}while(s>>>0<(t[62]|0)>>>0);return a|0}function d(e){e=e|0;var a=0,r=0,s=0,c=0;c=t[62]|0;a=t[61]|0;while(1){s=a+2|0;if(a>>>0>=c>>>0){a=9;break}r=i[s>>1]|0;if(r<<16>>16==e<<16>>16){a=10;break}if(r<<16>>16==92){r=a+4|0;if((i[r>>1]|0)==13){a=a+6|0;a=(i[a>>1]|0)==10?a:r;}else a=r;}else if(T(r)|0){a=9;break}else a=s;}if((a|0)==9){t[61]=s;L();}else if((a|0)==10)t[61]=s;return}function v(e,a,r,i){e=e|0;a=a|0;r=r|0;i=i|0;var c=0,f=0;c=t[55]|0;t[55]=c+32;f=t[51]|0;t[((f|0)==0?188:f+28|0)>>2]=c;t[52]=f;t[51]=c;t[c+8>>2]=e;if(2==(i|0))e=r;else e=1==(i|0)?r+2|0:0;t[c+12>>2]=e;t[c>>2]=a;t[c+4>>2]=r;t[c+16>>2]=0;t[c+20>>2]=i;s[c+24>>0]=1==(i|0)&1;t[c+28>>2]=0;return}function A(){var e=0,a=0,r=0;r=t[62]|0;a=t[61]|0;e:while(1){e=a+2|0;if(a>>>0>=r>>>0){a=6;break}switch(i[e>>1]|0){case 13:case 10:{a=6;break e}case 93:{a=7;break e}case 92:{e=a+4|0;break}default:{}}a=e;}if((a|0)==6){t[61]=e;L();e=0;}else if((a|0)==7){t[61]=e;e=93;}return e|0}function C(e,a){e=e|0;a=a|0;var r=0,s=0;r=t[61]|0;s=i[r>>1]|0;if(s<<16>>16==97){t[61]=r+4;r=w(1)|0;e=t[61]|0;if(N(r)|0){d(r);a=(t[61]|0)+2|0;t[61]=a;}else {E(r)|0;a=t[61]|0;}s=w(1)|0;r=t[61]|0;}if((r|0)!=(e|0))B(e,a);return s|0}function g(){var e=0,a=0,r=0;e:while(1){e=t[61]|0;a=e+2|0;t[61]=a;if(e>>>0>=(t[62]|0)>>>0){r=7;break}switch(i[a>>1]|0){case 13:case 10:{r=7;break e}case 47:break e;case 91:{A()|0;break}case 92:{t[61]=e+4;break}default:{}}}if((r|0)==7)L();return}function p(e){e=e|0;switch(i[e>>1]|0){case 62:{e=(i[e+-2>>1]|0)==61;break}case 41:case 59:{e=1;break}case 104:{e=S(e+-2|0,160,4)|0;break}case 121:{e=S(e+-2|0,168,6)|0;break}case 101:{e=S(e+-2|0,180,3)|0;break}default:e=0;}return e|0}function y(e){e=e|0;var a=0,r=0,s=0,c=0,f=0;c=(t[61]|0)+2|0;t[61]=c;r=t[62]|0;while(1){a=c+2|0;if(c>>>0>=r>>>0)break;s=i[a>>1]|0;if(!e?T(s)|0:0)break;if(s<<16>>16==42?(i[c+4>>1]|0)==47:0){f=8;break}c=a;}if((f|0)==8){t[61]=a;a=c+4|0;}t[61]=a;return}function m(e,a,r){e=e|0;a=a|0;r=r|0;var i=0,t=0;e:do{if(!r)e=0;else {while(1){i=s[e>>0]|0;t=s[a>>0]|0;if(i<<24>>24!=t<<24>>24)break;r=r+-1|0;if(!r){e=0;break e}else {e=e+1|0;a=a+1|0;}}e=(i&255)-(t&255)|0;}}while(0);return e|0}function I(e){e=e|0;e:do{switch(e<<16>>16){case 38:case 37:case 33:{e=1;break}default:if((e&-8)<<16>>16==40|(e+-58&65535)<6)e=1;else {switch(e<<16>>16){case 91:case 93:case 94:{e=1;break e}default:{}}e=(e+-123&65535)<4;}}}while(0);return e|0}function U(e){e=e|0;e:do{switch(e<<16>>16){case 38:case 37:case 33:break;default:if(!((e+-58&65535)<6|(e+-40&65535)<7&e<<16>>16!=41)){switch(e<<16>>16){case 91:case 94:break e;default:{}}return e<<16>>16!=125&(e+-123&65535)<4|0}}}while(0);return 1}function x(e){e=e|0;var a=0,r=0,s=0,c=0;r=n;n=n+16|0;s=r;t[s>>2]=0;t[54]=e;a=t[3]|0;c=a+(e<<1)|0;e=c+2|0;i[c>>1]=0;t[s>>2]=e;t[55]=e;t[47]=0;t[51]=0;t[49]=0;t[48]=0;t[53]=0;t[50]=0;n=r;return a|0}function S(e,a,r){e=e|0;a=a|0;r=r|0;var s=0,c=0;s=e+(0-r<<1)|0;c=s+2|0;e=t[3]|0;if(c>>>0>=e>>>0?(m(c,a,r<<1)|0)==0:0)if((c|0)==(e|0))e=1;else e=$(i[s>>1]|0)|0;else e=0;return e|0}function O(e,a){e=e|0;a=a|0;var r=0;r=t[3]|0;if(r>>>0<=e>>>0?(i[e>>1]|0)==a<<16>>16:0)if((r|0)==(e|0))r=1;else r=$(i[e+-2>>1]|0)|0;else r=0;return r|0}function $(e){e=e|0;e:do{if((e+-9&65535)<5)e=1;else {switch(e<<16>>16){case 32:case 160:{e=1;break e}default:{}}e=e<<16>>16!=46&(I(e)|0);}}while(0);return e|0}function j(){var e=0,a=0,r=0;e=t[62]|0;r=t[61]|0;e:while(1){a=r+2|0;if(r>>>0>=e>>>0)break;switch(i[a>>1]|0){case 13:case 10:break e;default:r=a;}}t[61]=a;return}function B(e,a){e=e|0;a=a|0;var r=0,s=0;r=t[55]|0;t[55]=r+12;s=t[53]|0;t[((s|0)==0?192:s+8|0)>>2]=r;t[53]=r;t[r>>2]=e;t[r+4>>2]=a;t[r+8>>2]=0;return}function E(e){e=e|0;while(1){if(M(e)|0)break;if(I(e)|0)break;e=(t[61]|0)+2|0;t[61]=e;e=i[e>>1]|0;if(!(e<<16>>16)){e=0;break}}return e|0}function P(){var e=0;e=t[(t[49]|0)+20>>2]|0;switch(e|0){case 1:{e=-1;break}case 2:{e=-2;break}default:e=e-(t[3]|0)>>1;}return e|0}function q(e){e=e|0;if(!(S(e,140,5)|0)?!(S(e,150,3)|0):0)e=S(e,156,2)|0;else e=1;return e|0}function z(e){e=e|0;switch(e<<16>>16){case 160:case 32:case 12:case 11:case 9:{e=1;break}default:e=0;}return e|0}function D(e){e=e|0;if((t[3]|0)==(e|0))e=1;else e=$(i[e+-2>>1]|0)|0;return e|0}function F(){var e=0;e=t[(t[49]|0)+12>>2]|0;if(!e)e=-1;else e=e-(t[3]|0)>>1;return e|0}function G(){var e=0;e=t[(t[49]|0)+16>>2]|0;if(!e)e=-1;else e=e-(t[3]|0)>>1;return e|0}function H(){var e=0;e=t[(t[49]|0)+4>>2]|0;if(!e)e=-1;else e=e-(t[3]|0)>>1;return e|0}function J(){var e=0;e=t[49]|0;e=t[((e|0)==0?188:e+28|0)>>2]|0;t[49]=e;return (e|0)!=0|0}function K(){var e=0;e=t[50]|0;e=t[((e|0)==0?192:e+8|0)>>2]|0;t[50]=e;return (e|0)!=0|0}function L(){s[762]=1;t[56]=(t[61]|0)-(t[3]|0)>>1;t[61]=(t[62]|0)+2;return}function M(e){e=e|0;return (e|128)<<16>>16==160|(e+-9&65535)<5|0}function N(e){e=e|0;return e<<16>>16==39|e<<16>>16==34|0}function Q(){return (t[(t[49]|0)+8>>2]|0)-(t[3]|0)>>1|0}function R(){return (t[(t[50]|0)+4>>2]|0)-(t[3]|0)>>1|0}function T(e){e=e|0;return e<<16>>16==13|e<<16>>16==10|0}function V(){return (t[t[49]>>2]|0)-(t[3]|0)>>1|0}function W(){return (t[t[50]>>2]|0)-(t[3]|0)>>1|0}function X(){return c[(t[49]|0)+24>>0]|0|0}function Y(e){e=e|0;t[3]=e;return}function Z(){return (s[763]|0)!=0|0}function _(){return t[56]|0}function ee(e){e=e|0;n=e+992+15&-16;return 992}return {su:ee,ai:G,e:_,ee:R,es:W,f:Z,id:P,ie:H,ip:X,is:V,p:b,re:K,ri:J,sa:x,se:F,ses:Y,ss:Q}}("undefined"!=typeof self?self:global,{},a),r=e.su(s-(2<<17));}const h=c$1.length+1;e.ses(r),e.sa(h-1),i(c$1,new Uint16Array(a,r,h)),e.p()||(n=e.e(),o());const w=[],d=[];for(;e.ri();){const a=e.is(),r=e.ie(),s=e.ai(),i=e.id(),t=e.ss(),f=e.se();let n;e.ip()&&(n=b(-1===i?a:a+1,c$1.charCodeAt(-1===i?a-1:a))),w.push({n:n,s:a,e:r,ss:t,se:f,d:i,a:s});}for(;e.re();){const a=e.es(),r=c$1.charCodeAt(a);d.push(34===r||39===r?b(a+1,r):c$1.slice(e.es(),e.ee()));}return [w,d,!!e.f()]}function b(e,a){n=e;let r="",s=n;for(;;){n>=c$1.length&&o();const e=c$1.charCodeAt(n);if(e===a)break;92===e?(r+=c$1.slice(s,n),r+=k(),s=n):(8232===e||8233===e||u(e)&&o(),++n);}return r+=c$1.slice(s,n++),r}function k(){let e=c$1.charCodeAt(++n);switch(++n,e){case 110:return "\n";case 114:return "\r";case 120:return String.fromCharCode(l(2));case 117:return function(){let e;123===c$1.charCodeAt(n)?(++n,e=l(c$1.indexOf("}",n)-n),++n,e>1114111&&o()):e=l(4);return e<=65535?String.fromCharCode(e):(e-=65536,String.fromCharCode(55296+(e>>10),56320+(1023&e)))}();case 116:return "\t";case 98:return "\b";case 118:return "\v";case 102:return "\f";case 13:10===c$1.charCodeAt(n)&&++n;case 10:return "";case 56:case 57:o();default:if(e>=48&&e<=55){let a=c$1.substr(n-1,3).match(/^[0-7]+/)[0],r=parseInt(a,8);return r>255&&(a=a.slice(0,-1),r=parseInt(a,8)),n+=a.length-1,e=c$1.charCodeAt(n),"0"===a&&56!==e&&57!==e||o(),String.fromCharCode(r)}return u(e)?"":String.fromCharCode(e)}}function l(e){const a=n;let r=0,s=0;for(let a=0;a<e;++a,++n){let e,i=c$1.charCodeAt(n);if(95!==i){if(i>=97)e=i-97+10;else if(i>=65)e=i-65+10;else {if(!(i>=48&&i<=57))break;e=i-48;}if(e>=16)break;s=i,r=16*r+e;}else 95!==s&&0!==a||o(),s=i;}return 95!==s&&n-a===e||o(),r}function u(e){return 13===e||10===e}function o(){throw Object.assign(Error(`Parse error ${f}:${c$1.slice(0,n).split("\n").length}:${n-c$1.lastIndexOf("\n",n-1)}`),{idx:n})}

  async function _resolve (id, parentUrl) {
    const urlResolved = resolveIfNotPlainOrUrl(id, parentUrl);
    return {
      r: resolveImportMap(importMap, urlResolved || id, parentUrl) || throwUnresolved(id, parentUrl),
      // b = bare specifier
      b: !urlResolved && !isURL(id)
    };
  }

  const resolve = resolveHook ? async (id, parentUrl) => {
    let result = resolveHook(id, parentUrl, defaultResolve);
    // will be deprecated in next major
    if (result && result.then)
      result = await result;
    return result ? { r: result, b: !resolveIfNotPlainOrUrl(id, parentUrl) && !isURL(id) } : _resolve(id, parentUrl);
  } : _resolve;

  // importShim('mod');
  // importShim('mod', { opts });
  // importShim('mod', { opts }, parentUrl);
  // importShim('mod', parentUrl);
  async function importShim (id, ...args) {
    // parentUrl if present will be the last argument
    let parentUrl = args[args.length - 1];
    if (typeof parentUrl !== 'string')
      parentUrl = baseUrl;
    // needed for shim check
    await initPromise;
    if (importHook) await importHook(id, typeof args[1] !== 'string' ? args[1] : {}, parentUrl);
    if (acceptingImportMaps || shimMode || !baselinePassthrough) {
      if (hasDocument)
        processImportMaps();

      if (!shimMode)
        acceptingImportMaps = false;
    }
    await importMapPromise;
    return topLevelLoad((await resolve(id, parentUrl)).r, { credentials: 'same-origin' });
  }

  self.importShim = importShim;

  function defaultResolve (id, parentUrl) {
    return resolveImportMap(importMap, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl) || throwUnresolved(id, parentUrl);
  }

  function throwUnresolved (id, parentUrl) {
    throw Error(`Unable to resolve specifier '${id}'${fromParent(parentUrl)}`);
  }

  const resolveSync = (id, parentUrl = baseUrl) => {
    parentUrl = `${parentUrl}`;
    const result = resolveHook && resolveHook(id, parentUrl, defaultResolve);
    return result && !result.then ? result : defaultResolve(id, parentUrl);
  };

  function metaResolve (id, parentUrl = this.url) {
    return resolveSync(id, parentUrl);
  }

  importShim.resolve = resolveSync;
  importShim.getImportMap = () => JSON.parse(JSON.stringify(importMap));
  importShim.addImportMap = importMapIn => {
    if (!shimMode) throw new Error('Unsupported in polyfill mode.');
    importMap = resolveAndComposeImportMap(importMapIn, baseUrl, importMap);
  };

  const registry = importShim._r = {};

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
  let baselinePassthrough;

  const initPromise = featureDetectionPromise.then(() => {
    // shim mode is determined on initialization, no late shim mode
    if (!shimMode) {
      if (document.querySelectorAll('script[type=module-shim],script[type=importmap-shim],link[rel=modulepreload-shim]').length) {
        setShimMode();
      }
      else {
        let seenScript = false;
        for (const script of document.querySelectorAll('script[type=module],script[type=importmap]')) {
          if (!seenScript) {
            if (script.type === 'module')
              seenScript = true;
          }
          else if (script.type === 'importmap') {
            importMapSrcOrLazy = true;
            break;
          }
        }
      }
    }
    baselinePassthrough = esmsInitOptions.polyfillEnable !== true && supportsDynamicImport && supportsImportMeta && supportsImportMaps && (!jsonModulesEnabled || supportsJsonAssertions) && (!cssModulesEnabled || supportsCssAssertions) && !importMapSrcOrLazy && !false;
    if (hasDocument) {
      if (!supportsImportMaps) {
        const supports = HTMLScriptElement.supports || (type => type === 'classic' || type === 'module');
        HTMLScriptElement.supports = type => type === 'importmap' || supports(type);
      }

      if (shimMode || !baselinePassthrough) {
        new MutationObserver(mutations => {
          for (const mutation of mutations) {
            if (mutation.type !== 'childList') continue;
            for (const node of mutation.addedNodes) {
              if (node.tagName === 'SCRIPT') {
                if (node.type === (shimMode ? 'module-shim' : 'module'))
                  processScript(node);
                if (node.type === (shimMode ? 'importmap-shim' : 'importmap'))
                  processImportMap(node);
              }
              else if (node.tagName === 'LINK' && node.rel === (shimMode ? 'modulepreload-shim' : 'modulepreload'))
                processPreload(node);
            }
          }
        }).observe(document, {childList: true, subtree: true});
        processImportMaps();
        processScriptsAndPreloads();
        if (document.readyState === 'complete') {
          readyStateCompleteCheck();
        }
        else {
          async function readyListener() {
            await initPromise;
            processImportMaps();
            if (document.readyState === 'complete') {
              readyStateCompleteCheck();
              document.removeEventListener('readystatechange', readyListener);
            }
          }
          document.addEventListener('readystatechange', readyListener);
        }
      }
    }
    return undefined;
  });
  let importMapPromise = initPromise;
  let firstPolyfillLoad = true;
  let acceptingImportMaps = true;

  async function topLevelLoad (url, fetchOpts, source, nativelyLoaded, lastStaticLoadPromise) {
    if (!shimMode)
      acceptingImportMaps = false;
    await importMapPromise;
    if (importHook) await importHook(id, typeof args[1] !== 'string' ? args[1] : {}, parentUrl);
    // early analysis opt-out - no need to even fetch if we have feature support
    if (!shimMode && baselinePassthrough) {
      // for polyfill case, only dynamic import needs a return value here, and dynamic import will never pass nativelyLoaded
      if (nativelyLoaded)
        return null;
      await lastStaticLoadPromise;
      return dynamicImport(source ? createBlob(source) : url, { errUrl: url || source });
    }
    const load = getOrCreateLoad(url, fetchOpts, null, source);
    const seen = {};
    await loadAll(load, seen);
    lastLoad = undefined;
    resolveDeps(load, seen);
    await lastStaticLoadPromise;
    if (source && !shimMode && !load.n && !false) {
      const module = await dynamicImport(createBlob(source), { errUrl: source });
      if (revokeBlobURLs) revokeObjectURLs(Object.keys(seen));
      return module;
    }
    if (firstPolyfillLoad && !shimMode && load.n && nativelyLoaded) {
      onpolyfill();
      firstPolyfillLoad = false;
    }
    const module = await dynamicImport(!shimMode && !load.n && nativelyLoaded ? load.u : load.b, { errUrl: load.u });
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
      let lastIndex = 0, depIndex = 0, dynamicImportEndStack = [];
      function pushStringTo (originalIndex) {
        while (dynamicImportEndStack[dynamicImportEndStack.length - 1] < originalIndex) {
          const dynamicImportEnd = dynamicImportEndStack.pop();
          resolvedSource += `${source.slice(lastIndex, dynamicImportEnd)}, ${urlJsString(load.r)}`;
          lastIndex = dynamicImportEnd;
        }
        resolvedSource += source.slice(lastIndex, originalIndex);
        lastIndex = originalIndex;
      }
      for (const { s: start, ss: statementStart, se: statementEnd, d: dynamicImportIndex } of imports) {
        // dependency source replacements
        if (dynamicImportIndex === -1) {
          let depLoad = load.d[depIndex++], blobUrl = depLoad.b, cycleShell = !blobUrl;
          if (cycleShell) {
            // circular shell creation
            if (!(blobUrl = depLoad.s)) {
              blobUrl = depLoad.s = createBlob(`export function u$_(m){${
              depLoad.a[1].map(
                name => name === 'default' ? `d$_=m.default` : `${name}=m.${name}`
              ).join(',')
            }}${
              depLoad.a[1].map(name =>
                name === 'default' ? `let d$_;export{d$_ as default}` : `export let ${name}`
              ).join(';')
            }\n//# sourceURL=${depLoad.r}?cycle`);
            }
          }

          pushStringTo(start - 1);
          resolvedSource += `/*${source.slice(start - 1, statementEnd)}*/${urlJsString(blobUrl)}`;

          // circular shell execution
          if (!cycleShell && depLoad.s) {
            resolvedSource += `;import*as m$_${depIndex} from'${depLoad.b}';import{u$_ as u$_${depIndex}}from'${depLoad.s}';u$_${depIndex}(m$_${depIndex})`;
            depLoad.s = undefined;
          }
          lastIndex = statementEnd;
        }
        // import.meta
        else if (dynamicImportIndex === -2) {
          load.m = { url: load.r, resolve: metaResolve };
          metaHook(load.m, load.u);
          pushStringTo(start);
          resolvedSource += `importShim._r[${urlJsString(load.u)}].m`;
          lastIndex = statementEnd;
        }
        // dynamic import
        else {
          pushStringTo(statementStart + 6);
          resolvedSource += `Shim(`;
          dynamicImportEndStack.push(statementEnd - 1);
          lastIndex = start;
        }
      }

      pushStringTo(source.length);
    }

    let hasSourceURL = false;
    resolvedSource = resolvedSource.replace(sourceMapURLRegEx, (match, isMapping, url) => (hasSourceURL = !isMapping, match.replace(url, () => new URL(url, load.r))));
    if (!hasSourceURL)
      resolvedSource += '\n//# sourceURL=' + load.r;

    load.b = lastLoad = createBlob(resolvedSource);
    load.S = undefined;
  }

  // ; and // trailer support added for Ruby on Rails 7 source maps compatibility
  // https://github.com/guybedford/es-module-shims/issues/228
  const sourceMapURLRegEx = /\n\/\/# source(Mapping)?URL=([^\n]+)\s*((;|\/\/[^#][^\n]*)\s*)*$/;

  const jsContentType = /^(text|application)\/(x-)?javascript(;|$)/;
  const jsonContentType = /^(text|application)\/json(;|$)/;
  const cssContentType = /^(text|application)\/css(;|$)/;

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

  async function doFetch (url, fetchOpts, parent) {
    if (enforceIntegrity && !fetchOpts.integrity)
      throw Error(`No integrity for ${url}${fromParent(parent)}.`);
    const poolQueue = pushFetchPool();
    if (poolQueue) await poolQueue;
    try {
      var res = await fetchHook(url, fetchOpts);
    }
    catch (e) {
      e.message = `Unable to fetch ${url}${fromParent(parent)} - see network log for details.\n` + e.message;
      throw e;
    }
    finally {
      popFetchPool();
    }
    if (!res.ok)
      throw Error(`${res.status} ${res.statusText} ${res.url}${fromParent(parent)}`);
    return res;
  }

  async function fetchModule (url, fetchOpts, parent) {
    const res = await doFetch(url, fetchOpts, parent);
    const contentType = res.headers.get('content-type');
    if (jsContentType.test(contentType))
      return { r: res.url, s: await res.text(), t: 'js' };
    else if (jsonContentType.test(contentType))
      return { r: res.url, s: `export default ${await res.text()}`, t: 'json' };
    else if (cssContentType.test(contentType)) {
      return { r: res.url, s: `var s=new CSSStyleSheet();s.replaceSync(${
        JSON.stringify((await res.text()).replace(cssUrlRegEx, (_match, quotes = '', relUrl1, relUrl2) => `url(${quotes}${resolveUrl(relUrl1 || relUrl2, url)}${quotes})`))
      });export default s;`, t: 'css' };
    }
    else
      throw Error(`Unsupported Content-Type "${contentType}" loading ${url}${fromParent(parent)}. Modules must be served with a valid MIME type like application/javascript.`);
  }

  function getOrCreateLoad (url, fetchOpts, parent, source) {
    let load = registry[url];
    if (load && !source)
      return load;

    load = {
      // url
      u: url,
      // response url
      r: source ? url : undefined,
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
      t: null,
      // meta
      m: null
    };
    if (registry[url]) {
      let i = 0;
      while (registry[load.u + ++i]);
      load.u += i;
    }
    registry[load.u] = load;

    load.f = (async () => {
      if (!source) {
        // preload fetch options override fetch options (race)
        let t;
        ({ r: load.r, s: source, t } = await (fetchCache[url] || fetchModule(url, fetchOpts, parent)));
        if (t && !shimMode) {
          if (t === 'css' && !cssModulesEnabled || t === 'json' && !jsonModulesEnabled)
            throw Error(`${t}-modules require <script type="esms-options">{ "polyfillEnable": ["${t}-modules"] }<${''}/script>`);
          if (t === 'css' && !supportsCssAssertions || t === 'json' && !supportsJsonAssertions)
            load.n = true;
        }
      }
      try {
        load.a = parse(source, load.u);
      }
      catch (e) {
        throwError(e);
        load.a = [[], [], false];
      }
      load.S = source;
      return load;
    })();

    load.L = load.f.then(async () => {
      let childFetchOpts = fetchOpts;
      load.d = (await Promise.all(load.a[0].map(async ({ n, d }) => {
        if (d >= 0 && !supportsDynamicImport || d === -2 && !supportsImportMeta)
          load.n = true;
        if (d !== -1 || !n) return;
        const { r, b } = await resolve(n, load.r || load.u);
        if (b && (!supportsImportMaps || importMapSrcOrLazy))
          load.n = true;
        if (skip && skip.test(r)) return { b: r };
        if (childFetchOpts.integrity)
          childFetchOpts = Object.assign({}, childFetchOpts, { integrity: undefined });
        return getOrCreateLoad(r, childFetchOpts, load.r).f;
      }))).filter(l => l);
    });

    return load;
  }

  function processScriptsAndPreloads () {
    for (const script of document.querySelectorAll(shimMode ? 'script[type=module-shim]' : 'script[type=module]'))
      processScript(script);
    for (const link of document.querySelectorAll(shimMode ? 'link[rel=modulepreload-shim]' : 'link[rel=modulepreload]'))
      processPreload(link);
  }

  function processImportMaps () {
    for (const script of document.querySelectorAll(shimMode ? 'script[type="importmap-shim"]' : 'script[type="importmap"]'))
      processImportMap(script);
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
  if (hasDocument) {
    document.addEventListener('DOMContentLoaded', async () => {
      await initPromise;
      domContentLoadedCheck();
      if (shimMode || !baselinePassthrough) {
        processImportMaps();
        processScriptsAndPreloads();
      }
    });
  }

  let readyStateCompleteCnt = 1;
  function readyStateCompleteCheck () {
    if (--readyStateCompleteCnt === 0 && !noLoadEventRetriggers)
      document.dispatchEvent(new Event('readystatechange'));
  }

  function processImportMap (script) {
    if (script.ep) // ep marker = script processed
      return;
    // empty inline scripts sometimes show before domready
    if (!script.src && !script.innerHTML)
      return;
    script.ep = true;
    // we dont currently support multiple, external or dynamic imports maps in polyfill mode to match native
    if (script.src) {
      if (!shimMode)
        return;
      importMapSrcOrLazy = true;
    }
    if (acceptingImportMaps) {
      importMapPromise = importMapPromise
        .then(async () => {
          importMap = resolveAndComposeImportMap(script.src ? await (await doFetch(script.src, getFetchOpts(script))).json() : JSON.parse(script.innerHTML), script.src || baseUrl, importMap);
        })
        .catch(throwError);
      if (!shimMode)
        acceptingImportMaps = false;
    }
  }

  function processScript (script) {
    if (script.ep) // ep marker = script processed
      return;
    if (script.getAttribute('noshim') !== null)
      return;
    // empty inline scripts sometimes show before domready
    if (!script.src && !script.innerHTML)
      return;
    script.ep = true;
    // does this load block readystate complete
    const isBlockingReadyScript = script.getAttribute('async') === null && readyStateCompleteCnt > 0;
    // does this load block DOMContentLoaded
    const isDomContentLoadedScript = domContentLoadedCnt > 0;
    if (isBlockingReadyScript) readyStateCompleteCnt++;
    if (isDomContentLoadedScript) domContentLoadedCnt++;
    const loadPromise = topLevelLoad(script.src || baseUrl, getFetchOpts(script), !script.src && script.innerHTML, !shimMode, isBlockingReadyScript && lastStaticLoadPromise).catch(throwError);
    if (isBlockingReadyScript)
      lastStaticLoadPromise = loadPromise.then(readyStateCompleteCheck);
    if (isDomContentLoadedScript)
      loadPromise.then(domContentLoadedCheck);
  }

  const fetchCache = {};
  function processPreload (link) {
    if (link.ep) // ep marker = processed
      return;
    link.ep = true;
    if (fetchCache[link.href])
      return;
    fetchCache[link.href] = fetchModule(link.href, getFetchOpts(link));
  }

})();
