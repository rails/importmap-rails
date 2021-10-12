/* ES Module Shims 1.2.0 */
(function () {

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
  const resolveHook = globalHook(shimMode && esmsInitOptions$1.resolve);

  const skip = esmsInitOptions$1.skip ? new RegExp(esmsInitOptions$1.skip) : null;

  let nonce = esmsInitOptions$1.nonce;

  if (!nonce) {
    const nonceElement = document.querySelector('script[nonce]');
    if (nonceElement)
      nonce = nonceElement.getAttribute('nonce');
  }

  const onerror = globalHook(esmsInitOptions$1.onerror || noop);
  const onpolyfill = globalHook(esmsInitOptions$1.onpolyfill || noop);

  const { revokeBlobURLs, noLoadEventRetriggers } = esmsInitOptions$1;

  const fetchHook = esmsInitOptions$1.fetch ? globalHook(esmsInitOptions$1.fetch) : fetch;

  function globalHook (name) {
    return typeof name === 'string' ? self[name] : name;
  }

  const enable = Array.isArray(esmsInitOptions$1.polyfillEnable) ? esmsInitOptions$1.polyfillEnable : [];
  const cssModulesEnabled = enable.includes('css-modules');
  const jsonModulesEnabled = enable.includes('json-modules');

  function setShimMode () {
    shimMode = true;
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

      function cb () {
        document.head.removeChild(s);
        if (self._esmsi) {
          resolve(self._esmsi, baseUrl);
          self._esmsi = undefined;
        }
        else {
          reject(err.error || new Error(`Error loading or executing the graph of ${errUrl} (check the console for ${src}).`));
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
          document.head.removeChild(iframe);
          if (v) supportsImportMaps = true;
          delete self._$s;
          resolve();
        };
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.head.appendChild(iframe);
        // we use document.write here because eg Weixin built-in browser doesn't support setting srcdoc
        iframe.contentWindow.document.write(`<script type=importmap nonce="${nonce}">{"imports":{"x":"data:text/javascript,"}}<${''}/script><script nonce="${nonce}">import('x').then(()=>1,()=>0).then(v=>parent._$s(v))<${''}/script>`);
      })
    ]);
  });

  let e,r,a,s=4194304;const i=1===new Uint8Array(new Uint16Array([1]).buffer)[0];let t,c$1;function parse(c,b="@"){if(t=c,t.length>s||!e){for(;t.length>s;)s*=2;r=new ArrayBuffer(4*s),e=function(e,r,a){"use asm";var s=new e.Int8Array(a),i=new e.Int16Array(a),t=new e.Int32Array(a),c=new e.Uint8Array(a),f=new e.Uint16Array(a),n=816;function u(e){e=e|0;var r=0,a=0,c=0,u=0,l=0;l=n;n=n+14336|0;u=l;s[589]=1;i[291]=0;i[292]=0;i[293]=-1;t[15]=t[2];s[590]=0;t[14]=0;s[588]=0;t[16]=l+10240;t[17]=l+2048;s[591]=0;e=(t[3]|0)+-2|0;t[18]=e;r=e+(t[12]<<1)|0;t[19]=r;e:while(1){a=e+2|0;t[18]=a;if(e>>>0>=r>>>0){c=18;break}r:do{switch(i[a>>1]|0){case 9:case 10:case 11:case 12:case 13:case 32:break;case 101:{if((((i[292]|0)==0?T(a)|0:0)?B(e+4|0,120,112,111,114,116)|0:0)?(b(),(s[589]|0)==0):0){c=9;break e}else c=17;break}case 105:{if(T(a)|0?B(e+4|0,109,112,111,114,116)|0:0){k();c=17;}else c=17;break}case 59:{c=17;break}case 47:switch(i[e+4>>1]|0){case 47:{H();break r}case 42:{p(1);break r}default:{c=16;break e}}default:{c=16;break e}}}while(0);if((c|0)==17){c=0;t[15]=t[18];}e=t[18]|0;r=t[19]|0;}if((c|0)==9){e=t[18]|0;t[15]=e;c=19;}else if((c|0)==16){s[589]=0;t[18]=e;c=19;}else if((c|0)==18)if(!(s[588]|0)){e=a;c=19;}else e=0;do{if((c|0)==19){e:while(1){r=e+2|0;t[18]=r;a=r;if(e>>>0>=(t[19]|0)>>>0){c=75;break}r:do{switch(i[r>>1]|0){case 9:case 10:case 11:case 12:case 13:case 32:break;case 101:{if(((i[292]|0)==0?T(r)|0:0)?B(e+4|0,120,112,111,114,116)|0:0){b();c=74;}else c=74;break}case 105:{if(T(r)|0?B(e+4|0,109,112,111,114,116)|0:0){k();c=74;}else c=74;break}case 99:{if((T(r)|0?D(e+4|0,108,97,115,115)|0:0)?_(i[e+12>>1]|0)|0:0){s[591]=1;c=74;}else c=74;break}case 40:{r=t[15]|0;a=t[17]|0;c=i[292]|0;i[292]=c+1<<16>>16;t[a+((c&65535)<<2)>>2]=r;c=74;break}case 41:{e=i[292]|0;if(!(e<<16>>16)){c=36;break e}c=e+-1<<16>>16;i[292]=c;e=t[11]|0;if((e|0)!=0?(t[e+20>>2]|0)==(t[(t[17]|0)+((c&65535)<<2)>>2]|0):0){r=e+4|0;if(!(t[r>>2]|0))t[r>>2]=a;t[e+12>>2]=a;t[11]=0;c=74;}else c=74;break}case 123:{c=t[15]|0;a=t[8]|0;e=c;do{if((i[c>>1]|0)==41&(a|0)!=0?(t[a+4>>2]|0)==(c|0):0){r=t[9]|0;t[8]=r;if(!r){t[4]=0;break}else {t[r+28>>2]=0;break}}}while(0);r=i[292]|0;c=r&65535;s[u+c>>0]=s[591]|0;s[591]=0;a=t[17]|0;i[292]=r+1<<16>>16;t[a+(c<<2)>>2]=e;c=74;break}case 125:{e=i[292]|0;if(!(e<<16>>16)){c=49;break e}a=e+-1<<16>>16;i[292]=a;r=i[293]|0;if(e<<16>>16!=r<<16>>16)if(r<<16>>16!=-1&(a&65535)<(r&65535)){c=53;break e}else {c=74;break r}else {a=t[16]|0;c=(i[291]|0)+-1<<16>>16;i[291]=c;i[293]=i[a+((c&65535)<<1)>>1]|0;h();c=74;break r}}case 39:{d();c=74;break}case 34:{v();c=74;break}case 47:switch(i[e+4>>1]|0){case 47:{H();break r}case 42:{p(1);break r}default:{r=t[15]|0;a=i[r>>1]|0;a:do{if(!(m(a)|0)){switch(a<<16>>16){case 41:if(M(t[(t[17]|0)+(f[292]<<2)>>2]|0)|0){c=71;break a}else {c=68;break a}case 125:break;default:{c=68;break a}}e=f[292]|0;if(!(g(t[(t[17]|0)+(e<<2)>>2]|0)|0)?(s[u+e>>0]|0)==0:0)c=68;else c=71;}else switch(a<<16>>16){case 46:if(((i[r+-2>>1]|0)+-48&65535)<10){c=68;break a}else {c=71;break a}case 43:if((i[r+-2>>1]|0)==43){c=68;break a}else {c=71;break a}case 45:if((i[r+-2>>1]|0)==45){c=68;break a}else {c=71;break a}default:{c=71;break a}}}while(0);a:do{if((c|0)==68){c=0;if(!(o(r)|0)){switch(a<<16>>16){case 0:{c=71;break a}case 47:break;default:{e=1;break a}}if(!(s[590]|0))e=1;else c=71;}else c=71;}}while(0);if((c|0)==71){I();e=0;}s[590]=e;c=74;break r}}case 96:{h();c=74;break}default:c=74;}}while(0);if((c|0)==74){c=0;t[15]=t[18];}e=t[18]|0;}if((c|0)==36){Z();e=0;break}else if((c|0)==49){Z();e=0;break}else if((c|0)==53){Z();e=0;break}else if((c|0)==75){e=(i[293]|0)==-1&(i[292]|0)==0&(s[588]|0)==0;break}}}while(0);n=l;return e|0}function b(){var e=0,r=0,a=0,c=0,f=0,n=0;f=t[18]|0;n=f+12|0;t[18]=n;r=w(1)|0;e=t[18]|0;if(!((e|0)==(n|0)?!(E(r)|0):0))c=3;e:do{if((c|0)==3){r:do{switch(r<<16>>16){case 100:{K(e,e+14|0);break e}case 97:{t[18]=e+10;w(1)|0;e=t[18]|0;c=6;break}case 102:{c=6;break}case 99:{if(D(e+2|0,108,97,115,115)|0?(a=e+10|0,G(i[a>>1]|0)|0):0){t[18]=a;f=w(1)|0;n=t[18]|0;J(f)|0;K(n,t[18]|0);t[18]=(t[18]|0)+-2;break e}e=e+4|0;t[18]=e;c=13;break}case 108:case 118:{c=13;break}case 123:{t[18]=e+2;e=w(1)|0;a=t[18]|0;while(1){J(e)|0;e=t[18]|0;w(1)|0;e=$(a,e)|0;if(e<<16>>16==44){t[18]=(t[18]|0)+2;e=w(1)|0;}r=a;a=t[18]|0;if(e<<16>>16==125){c=29;break}if((a|0)==(r|0)){c=26;break}if(a>>>0>(t[19]|0)>>>0){c=28;break}}if((c|0)==26){Z();break e}else if((c|0)==28){Z();break e}else if((c|0)==29){t[18]=a+2;c=31;break r}break}case 42:{t[18]=e+2;w(1)|0;c=t[18]|0;$(c,c)|0;c=31;break}default:{}}}while(0);if((c|0)==6){t[18]=e+16;e=w(1)|0;if(e<<16>>16==42){t[18]=(t[18]|0)+2;e=w(1)|0;}n=t[18]|0;J(e)|0;K(n,t[18]|0);t[18]=(t[18]|0)+-2;break}else if((c|0)==13){e=e+4|0;t[18]=e;s[589]=0;r:while(1){t[18]=e+2;n=w(1)|0;e=t[18]|0;switch((J(n)|0)<<16>>16){case 91:case 123:{c=15;break r}default:{}}r=t[18]|0;if((r|0)==(e|0))break e;K(e,r);switch((w(1)|0)<<16>>16){case 61:{c=19;break r}case 44:break;default:{c=20;break r}}e=t[18]|0;}if((c|0)==15){t[18]=(t[18]|0)+-2;break}else if((c|0)==19){t[18]=(t[18]|0)+-2;break}else if((c|0)==20){t[18]=(t[18]|0)+-2;break}}else if((c|0)==31)r=w(1)|0;e=t[18]|0;if(r<<16>>16==102?L(e+2|0,114,111,109)|0:0){t[18]=e+8;l(f,w(1)|0);break}t[18]=e+-2;}}while(0);return}function k(){var e=0,r=0,a=0,c=0,f=0;f=t[18]|0;r=f+12|0;t[18]=r;e:do{switch((w(1)|0)<<16>>16){case 40:{r=t[17]|0;a=i[292]|0;i[292]=a+1<<16>>16;t[r+((a&65535)<<2)>>2]=f;if((i[t[15]>>1]|0)!=46){A(f,(t[18]|0)+2|0,0,f);t[11]=t[8];t[18]=(t[18]|0)+2;switch((w(1)|0)<<16>>16){case 39:{d();break}case 34:{v();break}default:{t[18]=(t[18]|0)+-2;break e}}t[18]=(t[18]|0)+2;switch((w(1)|0)<<16>>16){case 44:{f=t[18]|0;t[(t[8]|0)+4>>2]=f;t[18]=f+2;w(1)|0;f=t[18]|0;a=t[8]|0;t[a+16>>2]=f;s[a+24>>0]=1;t[18]=f+-2;break e}case 41:{i[292]=(i[292]|0)+-1<<16>>16;a=t[18]|0;f=t[8]|0;t[f+4>>2]=a;t[f+12>>2]=a;s[f+24>>0]=1;break e}default:{t[18]=(t[18]|0)+-2;break e}}}break}case 46:{t[18]=(t[18]|0)+2;if(((w(1)|0)<<16>>16==109?(e=t[18]|0,L(e+2|0,101,116,97)|0):0)?(i[t[15]>>1]|0)!=46:0)A(f,f,e+8|0,2);break}case 42:case 123:case 39:case 34:{c=16;break}default:if((t[18]|0)!=(r|0))c=16;}}while(0);do{if((c|0)==16){if(i[292]|0){t[18]=(t[18]|0)+-2;break}e=t[19]|0;r=t[18]|0;e:while(1){if(r>>>0>=e>>>0){c=23;break}a=i[r>>1]|0;switch(a<<16>>16){case 34:case 39:{c=21;break e}default:{}}c=r+2|0;t[18]=c;r=c;}if((c|0)==21){l(f,a);break}else if((c|0)==23){Z();break}}}while(0);return}function l(e,r){e=e|0;r=r|0;var a=0,s=0;a=(t[18]|0)+2|0;switch(r<<16>>16){case 39:{d();s=5;break}case 34:{v();s=5;break}default:Z();}do{if((s|0)==5){A(e,a,t[18]|0,1);t[18]=(t[18]|0)+2;s=(w(0)|0)<<16>>16==97;r=t[18]|0;if(s?B(r+2|0,115,115,101,114,116)|0:0){t[18]=r+12;if((w(1)|0)<<16>>16!=123){t[18]=r;break}e=t[18]|0;a=e;e:while(1){t[18]=a+2;a=w(1)|0;switch(a<<16>>16){case 39:{d();t[18]=(t[18]|0)+2;a=w(1)|0;break}case 34:{v();t[18]=(t[18]|0)+2;a=w(1)|0;break}default:a=J(a)|0;}if(a<<16>>16!=58){s=16;break}t[18]=(t[18]|0)+2;switch((w(1)|0)<<16>>16){case 39:{d();break}case 34:{v();break}default:{s=20;break e}}t[18]=(t[18]|0)+2;switch((w(1)|0)<<16>>16){case 125:{s=25;break e}case 44:break;default:{s=24;break e}}t[18]=(t[18]|0)+2;if((w(1)|0)<<16>>16==125){s=25;break}a=t[18]|0;}if((s|0)==16){t[18]=r;break}else if((s|0)==20){t[18]=r;break}else if((s|0)==24){t[18]=r;break}else if((s|0)==25){s=t[8]|0;t[s+16>>2]=e;t[s+12>>2]=(t[18]|0)+2;break}}t[18]=r+-2;}}while(0);return}function o(e){e=e|0;e:do{switch(i[e>>1]|0){case 100:switch(i[e+-2>>1]|0){case 105:{e=z(e+-4|0,118,111)|0;break e}case 108:{e=q(e+-4|0,121,105,101)|0;break e}default:{e=0;break e}}case 101:{switch(i[e+-2>>1]|0){case 115:break;case 116:{e=P(e+-4|0,100,101,108,101)|0;break e}default:{e=0;break e}}switch(i[e+-4>>1]|0){case 108:{e=F(e+-6|0,101)|0;break e}case 97:{e=F(e+-6|0,99)|0;break e}default:{e=0;break e}}}case 102:{if((i[e+-2>>1]|0)==111?(i[e+-4>>1]|0)==101:0)switch(i[e+-6>>1]|0){case 99:{e=S(e+-8|0,105,110,115,116,97,110)|0;break e}case 112:{e=z(e+-8|0,116,121)|0;break e}default:{e=0;break e}}else e=0;break}case 110:{e=e+-2|0;if(F(e,105)|0)e=1;else e=O(e,114,101,116,117,114)|0;break}case 111:{e=F(e+-2|0,100)|0;break}case 114:{e=U(e+-2|0,100,101,98,117,103,103,101)|0;break}case 116:{e=P(e+-2|0,97,119,97,105)|0;break}case 119:switch(i[e+-2>>1]|0){case 101:{e=F(e+-4|0,110)|0;break e}case 111:{e=q(e+-4|0,116,104,114)|0;break e}default:{e=0;break e}}default:e=0;}}while(0);return e|0}function h(){var e=0,r=0,a=0;r=t[19]|0;a=t[18]|0;e:while(1){e=a+2|0;if(a>>>0>=r>>>0){r=8;break}switch(i[e>>1]|0){case 96:{r=9;break e}case 36:{if((i[a+4>>1]|0)==123){r=6;break e}break}case 92:{e=a+4|0;break}default:{}}a=e;}if((r|0)==6){t[18]=a+4;e=i[293]|0;r=t[16]|0;a=i[291]|0;i[291]=a+1<<16>>16;i[r+((a&65535)<<1)>>1]=e;a=(i[292]|0)+1<<16>>16;i[292]=a;i[293]=a;}else if((r|0)==8){t[18]=e;Z();}else if((r|0)==9)t[18]=e;return}function w(e){e=e|0;var r=0,a=0,s=0;a=t[18]|0;e:do{r=i[a>>1]|0;r:do{if(r<<16>>16!=47)if(e)if(_(r)|0)break;else break e;else if(R(r)|0)break;else break e;else switch(i[a+2>>1]|0){case 47:{H();break r}case 42:{p(e);break r}default:{r=47;break e}}}while(0);s=t[18]|0;a=s+2|0;t[18]=a;}while(s>>>0<(t[19]|0)>>>0);return r|0}function d(){var e=0,r=0,a=0,s=0;s=t[19]|0;e=t[18]|0;e:while(1){a=e+2|0;if(e>>>0>=s>>>0){e=8;break}r=i[a>>1]|0;switch(r<<16>>16){case 39:{e=9;break e}case 92:{r=e+4|0;if((i[r>>1]|0)==13){e=e+6|0;e=(i[e>>1]|0)==10?e:r;}else e=r;break}default:if(ae(r)|0){e=8;break e}else e=a;}}if((e|0)==8){t[18]=a;Z();}else if((e|0)==9)t[18]=a;return}function v(){var e=0,r=0,a=0,s=0;s=t[19]|0;e=t[18]|0;e:while(1){a=e+2|0;if(e>>>0>=s>>>0){e=8;break}r=i[a>>1]|0;switch(r<<16>>16){case 34:{e=9;break e}case 92:{r=e+4|0;if((i[r>>1]|0)==13){e=e+6|0;e=(i[e>>1]|0)==10?e:r;}else e=r;break}default:if(ae(r)|0){e=8;break e}else e=a;}}if((e|0)==8){t[18]=a;Z();}else if((e|0)==9)t[18]=a;return}function A(e,r,a,i){e=e|0;r=r|0;a=a|0;i=i|0;var c=0,f=0;c=t[13]|0;t[13]=c+32;f=t[8]|0;t[((f|0)==0?16:f+28|0)>>2]=c;t[9]=f;t[8]=c;t[c+8>>2]=e;do{if(2!=(i|0))if(1==(i|0)){t[c+12>>2]=a+2;break}else {t[c+12>>2]=t[3];break}else t[c+12>>2]=a;}while(0);t[c>>2]=r;t[c+4>>2]=a;t[c+16>>2]=0;t[c+20>>2]=i;s[c+24>>0]=1==(i|0)&1;t[c+28>>2]=0;return}function y(){var e=0,r=0,a=0;a=t[19]|0;r=t[18]|0;e:while(1){e=r+2|0;if(r>>>0>=a>>>0){r=6;break}switch(i[e>>1]|0){case 13:case 10:{r=6;break e}case 93:{r=7;break e}case 92:{e=r+4|0;break}default:{}}r=e;}if((r|0)==6){t[18]=e;Z();e=0;}else if((r|0)==7){t[18]=e;e=93;}return e|0}function C(e,r,a,s,t,c,f,n){e=e|0;r=r|0;a=a|0;s=s|0;t=t|0;c=c|0;f=f|0;n=n|0;if((((((i[e+12>>1]|0)==n<<16>>16?(i[e+10>>1]|0)==f<<16>>16:0)?(i[e+8>>1]|0)==c<<16>>16:0)?(i[e+6>>1]|0)==t<<16>>16:0)?(i[e+4>>1]|0)==s<<16>>16:0)?(i[e+2>>1]|0)==a<<16>>16:0)r=(i[e>>1]|0)==r<<16>>16;else r=0;return r|0}function g(e){e=e|0;switch(i[e>>1]|0){case 62:{e=(i[e+-2>>1]|0)==61;break}case 41:case 59:{e=1;break}case 104:{e=P(e+-2|0,99,97,116,99)|0;break}case 121:{e=S(e+-2|0,102,105,110,97,108,108)|0;break}case 101:{e=q(e+-2|0,101,108,115)|0;break}default:e=0;}return e|0}function I(){var e=0,r=0,a=0;e:while(1){e=t[18]|0;r=e+2|0;t[18]=r;if(e>>>0>=(t[19]|0)>>>0){a=7;break}switch(i[r>>1]|0){case 13:case 10:{a=7;break e}case 47:break e;case 91:{y()|0;break}case 92:{t[18]=e+4;break}default:{}}}if((a|0)==7)Z();return}function p(e){e=e|0;var r=0,a=0,s=0,c=0,f=0;c=(t[18]|0)+2|0;t[18]=c;a=t[19]|0;while(1){r=c+2|0;if(c>>>0>=a>>>0)break;s=i[r>>1]|0;if(!e?ae(s)|0:0)break;if(s<<16>>16==42?(i[c+4>>1]|0)==47:0){f=8;break}c=r;}if((f|0)==8){t[18]=r;r=c+4|0;}t[18]=r;return}function x(e,r,a,s,t,c,f){e=e|0;r=r|0;a=a|0;s=s|0;t=t|0;c=c|0;f=f|0;if(((((i[e+10>>1]|0)==f<<16>>16?(i[e+8>>1]|0)==c<<16>>16:0)?(i[e+6>>1]|0)==t<<16>>16:0)?(i[e+4>>1]|0)==s<<16>>16:0)?(i[e+2>>1]|0)==a<<16>>16:0)r=(i[e>>1]|0)==r<<16>>16;else r=0;return r|0}function U(e,r,a,s,c,f,n,u){e=e|0;r=r|0;a=a|0;s=s|0;c=c|0;f=f|0;n=n|0;u=u|0;var b=0,k=0;k=e+-12|0;b=t[3]|0;if(k>>>0>=b>>>0?C(k,r,a,s,c,f,n,u)|0:0)if((k|0)==(b|0))b=1;else b=G(i[e+-14>>1]|0)|0;else b=0;return b|0}function E(e){e=e|0;e:do{switch(e<<16>>16){case 38:case 37:case 33:{e=1;break}default:if((e&-8)<<16>>16==40|(e+-58&65535)<6)e=1;else {switch(e<<16>>16){case 91:case 93:case 94:{e=1;break e}default:{}}e=(e+-123&65535)<4;}}}while(0);return e|0}function m(e){e=e|0;e:do{switch(e<<16>>16){case 38:case 37:case 33:break;default:if(!((e+-58&65535)<6|(e+-40&65535)<7&e<<16>>16!=41)){switch(e<<16>>16){case 91:case 94:break e;default:{}}return e<<16>>16!=125&(e+-123&65535)<4|0}}}while(0);return 1}function S(e,r,a,s,c,f,n){e=e|0;r=r|0;a=a|0;s=s|0;c=c|0;f=f|0;n=n|0;var u=0,b=0;b=e+-10|0;u=t[3]|0;if(b>>>0>=u>>>0?x(b,r,a,s,c,f,n)|0:0)if((b|0)==(u|0))u=1;else u=G(i[e+-12>>1]|0)|0;else u=0;return u|0}function O(e,r,a,s,c,f){e=e|0;r=r|0;a=a|0;s=s|0;c=c|0;f=f|0;var n=0,u=0;u=e+-8|0;n=t[3]|0;if(u>>>0>=n>>>0?B(u,r,a,s,c,f)|0:0)if((u|0)==(n|0))n=1;else n=G(i[e+-10>>1]|0)|0;else n=0;return n|0}function $(e,r){e=e|0;r=r|0;var a=0,s=0;a=t[18]|0;s=i[a>>1]|0;if(s<<16>>16==97){t[18]=a+4;r=w(1)|0;e=t[18]|0;J(r)|0;r=t[18]|0;s=w(1)|0;a=t[18]|0;}if((a|0)!=(e|0))K(e,r);return s|0}function j(e){e=e|0;var r=0,a=0,s=0,c=0;a=n;n=n+16|0;s=a;t[s>>2]=0;t[12]=e;r=t[3]|0;c=r+(e<<1)|0;e=c+2|0;i[c>>1]=0;t[s>>2]=e;t[13]=e;t[4]=0;t[8]=0;t[6]=0;t[5]=0;t[10]=0;t[7]=0;n=a;return r|0}function B(e,r,a,s,t,c){e=e|0;r=r|0;a=a|0;s=s|0;t=t|0;c=c|0;if((((i[e+8>>1]|0)==c<<16>>16?(i[e+6>>1]|0)==t<<16>>16:0)?(i[e+4>>1]|0)==s<<16>>16:0)?(i[e+2>>1]|0)==a<<16>>16:0)r=(i[e>>1]|0)==r<<16>>16;else r=0;return r|0}function P(e,r,a,s,c){e=e|0;r=r|0;a=a|0;s=s|0;c=c|0;var f=0,n=0;n=e+-6|0;f=t[3]|0;if(n>>>0>=f>>>0?D(n,r,a,s,c)|0:0)if((n|0)==(f|0))f=1;else f=G(i[e+-8>>1]|0)|0;else f=0;return f|0}function q(e,r,a,s){e=e|0;r=r|0;a=a|0;s=s|0;var c=0,f=0;f=e+-4|0;c=t[3]|0;if(f>>>0>=c>>>0?L(f,r,a,s)|0:0)if((f|0)==(c|0))c=1;else c=G(i[e+-6>>1]|0)|0;else c=0;return c|0}function z(e,r,a){e=e|0;r=r|0;a=a|0;var s=0,c=0;c=e+-2|0;s=t[3]|0;if(c>>>0>=s>>>0?Q(c,r,a)|0:0)if((c|0)==(s|0))s=1;else s=G(i[e+-4>>1]|0)|0;else s=0;return s|0}function D(e,r,a,s,t){e=e|0;r=r|0;a=a|0;s=s|0;t=t|0;if(((i[e+6>>1]|0)==t<<16>>16?(i[e+4>>1]|0)==s<<16>>16:0)?(i[e+2>>1]|0)==a<<16>>16:0)r=(i[e>>1]|0)==r<<16>>16;else r=0;return r|0}function F(e,r){e=e|0;r=r|0;var a=0;a=t[3]|0;if(a>>>0<=e>>>0?(i[e>>1]|0)==r<<16>>16:0)if((a|0)==(e|0))a=1;else a=G(i[e+-2>>1]|0)|0;else a=0;return a|0}function G(e){e=e|0;e:do{if((e+-9&65535)<5)e=1;else {switch(e<<16>>16){case 32:case 160:{e=1;break e}default:{}}e=e<<16>>16!=46&(E(e)|0);}}while(0);return e|0}function H(){var e=0,r=0,a=0;e=t[19]|0;a=t[18]|0;e:while(1){r=a+2|0;if(a>>>0>=e>>>0)break;switch(i[r>>1]|0){case 13:case 10:break e;default:a=r;}}t[18]=r;return}function J(e){e=e|0;while(1){if(_(e)|0)break;if(E(e)|0)break;e=(t[18]|0)+2|0;t[18]=e;e=i[e>>1]|0;if(!(e<<16>>16)){e=0;break}}return e|0}function K(e,r){e=e|0;r=r|0;var a=0,s=0;a=t[13]|0;t[13]=a+12;s=t[10]|0;t[((s|0)==0?20:s+8|0)>>2]=a;t[10]=a;t[a>>2]=e;t[a+4>>2]=r;t[a+8>>2]=0;return}function L(e,r,a,s){e=e|0;r=r|0;a=a|0;s=s|0;if((i[e+4>>1]|0)==s<<16>>16?(i[e+2>>1]|0)==a<<16>>16:0)r=(i[e>>1]|0)==r<<16>>16;else r=0;return r|0}function M(e){e=e|0;if(!(O(e,119,104,105,108,101)|0)?!(q(e,102,111,114)|0):0)e=z(e,105,102)|0;else e=1;return e|0}function N(){var e=0;e=t[(t[6]|0)+20>>2]|0;switch(e|0){case 1:{e=-1;break}case 2:{e=-2;break}default:e=e-(t[3]|0)>>1;}return e|0}function Q(e,r,a){e=e|0;r=r|0;a=a|0;if((i[e+2>>1]|0)==a<<16>>16)r=(i[e>>1]|0)==r<<16>>16;else r=0;return r|0}function R(e){e=e|0;switch(e<<16>>16){case 160:case 32:case 12:case 11:case 9:{e=1;break}default:e=0;}return e|0}function T(e){e=e|0;if((t[3]|0)==(e|0))e=1;else e=G(i[e+-2>>1]|0)|0;return e|0}function V(){var e=0;e=t[(t[6]|0)+16>>2]|0;if(!e)e=-1;else e=e-(t[3]|0)>>1;return e|0}function W(){var e=0;e=t[6]|0;e=t[((e|0)==0?16:e+28|0)>>2]|0;t[6]=e;return (e|0)!=0|0}function X(){var e=0;e=t[7]|0;e=t[((e|0)==0?20:e+8|0)>>2]|0;t[7]=e;return (e|0)!=0|0}function Y(e){e=e|0;var r=0;r=n;n=n+e|0;n=n+15&-16;return r|0}function Z(){s[588]=1;t[14]=(t[18]|0)-(t[3]|0)>>1;t[18]=(t[19]|0)+2;return}function _(e){e=e|0;return (e|128)<<16>>16==160|(e+-9&65535)<5|0}function ee(){return (t[(t[6]|0)+12>>2]|0)-(t[3]|0)>>1|0}function re(){return (t[(t[6]|0)+8>>2]|0)-(t[3]|0)>>1|0}function ae(e){e=e|0;return e<<16>>16==13|e<<16>>16==10|0}function se(){return (t[(t[6]|0)+4>>2]|0)-(t[3]|0)>>1|0}function ie(){return (t[(t[7]|0)+4>>2]|0)-(t[3]|0)>>1|0}function te(){return (t[t[6]>>2]|0)-(t[3]|0)>>1|0}function ce(){return (t[t[7]>>2]|0)-(t[3]|0)>>1|0}function fe(){return c[(t[6]|0)+24>>0]|0|0}function ne(e){e=e|0;t[3]=e;return}function ue(){return (s[589]|0)!=0|0}function be(){return t[14]|0}return {ai:V,e:be,ee:ie,es:ce,f:ue,id:N,ie:se,ip:fe,is:te,p:u,re:X,ri:W,sa:j,se:ee,ses:ne,ss:re,sta:Y}}({Int8Array:Int8Array,Int16Array:Int16Array,Int32Array:Int32Array,Uint8Array:Uint8Array,Uint16Array:Uint16Array},{},r),a=e.sta(2*s);}const k=t.length+1;if(e.ses(a),e.sa(k-1),(i?n:f)(t,new Uint16Array(r,a,k)),!e.p())throw Object.assign(new Error(`Parse error ${b}:${t.slice(0,e.e()).split("\n").length}:${e.e()-t.lastIndexOf("\n",e.e()-1)}`),{idx:e.e()});const l=[],o=[];for(;e.ri();){const r=e.is(),a=e.ie(),s=e.ai(),i=e.id(),c=e.ss(),f=e.se();let n;e.ip()&&(n=u(-1===i?r:r+1,t.charCodeAt(-1===i?r-1:r))),l.push({n:n,s:r,e:a,ss:c,se:f,d:i,a:s});}for(;e.re();)o.push(t.slice(e.es(),e.ee()));return [l,o,!!e.f()]}function f(e,r){const a=e.length;let s=0;for(;s<a;){const a=e.charCodeAt(s);r[s++]=(255&a)<<8|a>>>8;}}function n(e,r){const a=e.length;let s=0;for(;s<a;)r[s]=e.charCodeAt(s++);}function u(e,r){c$1=e;let a="",s=c$1;for(;;){c$1>=t.length&&syntaxError();const e=t.charCodeAt(c$1);if(e===r)break;92===e?(a+=t.slice(s,c$1),a+=b(),s=c$1):(8232===e||8233===e||l(e)&&syntaxError(),++c$1);}return a+=t.slice(s,c$1++),a}function b(){let e=t.charCodeAt(++c$1);switch(++c$1,e){case 110:return "\n";case 114:return "\r";case 120:return String.fromCharCode(k(2));case 117:return function(){let e;123===t.charCodeAt(c$1)?(++c$1,e=k(t.indexOf("}",c$1)-c$1),++c$1,e>1114111&&syntaxError()):e=k(4);return e<=65535?String.fromCharCode(e):(e-=65536,String.fromCharCode(55296+(e>>10),56320+(1023&e)))}();case 116:return "\t";case 98:return "\b";case 118:return "\v";case 102:return "\f";case 13:10===t.charCodeAt(c$1)&&++c$1;case 10:return "";case 56:case 57:syntaxError();default:if(e>=48&&e<=55){let r=t.substr(c$1-1,3).match(/^[0-7]+/)[0],a=parseInt(r,8);return a>255&&(r=r.slice(0,-1),a=parseInt(r,8)),c$1+=r.length-1,e=t.charCodeAt(c$1),"0"===r&&56!==e&&57!==e||syntaxError(),String.fromCharCode(a)}return l(e)?"":String.fromCharCode(e)}}function k(e){const r=c$1;let a=0,s=0;for(let r=0;r<e;++r,++c$1){let e,i=t.charCodeAt(c$1);if(95!==i){if(i>=97)e=i-97+10;else if(i>=65)e=i-65+10;else {if(!(i>=48&&i<=57))break;e=i-48;}if(e>=16)break;s=i,a=16*a+e;}else 95!==s&&0!==r||syntaxError(),s=i;}return 95!==s&&c$1-r===e||syntaxError(),a}function l(e){return 13===e||10===e}

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
  let baselinePassthrough;

  const initPromise = featureDetectionPromise.then(() => {
    // shim mode is determined on initialization, no late shim mode
    if (!shimMode) {
      let seenScript = false;
      for (const script of document.querySelectorAll('script[type="module-shim"],script[type="importmap-shim"],script[type="module"],script[type="importmap"]')) {
        if (!seenScript && script.type === 'module')
          seenScript = true;
        if (script.type.endsWith('-shim')) {
          setShimMode();
          break;
        }
        if (seenScript && script.type === 'importmap') {
          importMapSrcOrLazy = true;
          break;
        }
      }
    }
    baselinePassthrough = supportsDynamicImport && supportsImportMeta && supportsImportMaps && (!jsonModulesEnabled || supportsJsonAssertions) && (!cssModulesEnabled || supportsCssAssertions) && !importMapSrcOrLazy && !false;
    if (!baselinePassthrough) onpolyfill();
    if (shimMode || !baselinePassthrough) {
      new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.type !== 'childList') continue;
          for (const node of mutation.addedNodes) {
            if (node.tagName === 'SCRIPT') {
              if (!shimMode && node.type === 'module' || shimMode && node.type === 'module-shim')
                processScript(node);
              if (!shimMode && node.type === 'importmap' || shimMode && node.type === 'importmap-shim')
                processImportMap(node);
            }
            else if (node.tagName === 'LINK' && node.rel === 'modulepreload')
              processPreload(node);
          }
        }
      }).observe(document, { childList: true, subtree: true });
      processImportMaps();
      processScriptsAndPreloads();
      return undefined;
    }
  });
  let importMapPromise = initPromise;

  let acceptingImportMaps = true;
  async function topLevelLoad (url, fetchOpts, source, nativelyLoaded, lastStaticLoadPromise) {
    if (!shimMode)
      acceptingImportMaps = false;
    await importMapPromise;
    // early analysis opt-out - no need to even fetch if we have feature support
    if (!shimMode && baselinePassthrough) {
      // for polyfill case, only dynamic import needs a return value here, and dynamic import will never pass nativelyLoaded
      if (nativelyLoaded)
        return null;
      await lastStaticLoadPromise;
      return dynamicImport(source ? createBlob(source) : url, { errUrl: url || source });
    }
    const load = getOrCreateLoad(url, fetchOpts, source);
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
    // needed for shim check
    await initPromise;
    if (acceptingImportMaps || shimMode || !baselinePassthrough) {
      processImportMaps();
      if (!shimMode)
        acceptingImportMaps = false;
    }
    await importMapPromise;
    return topLevelLoad((await resolve(id, parentUrl)).r || throwUnresolved(id, parentUrl), { credentials: 'same-origin' });
  }

  self.importShim = importShim;

  const meta = {};

  async function importMetaResolve (id, parentUrl = this.url) {
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

    resolvedSource = resolvedSource.replace(/\/\/# sourceMappingURL=(.*)\s*$/, (match, url) => match.replace(url, () => new URL(url, load.r)));
    let hasSourceURL = false;
    resolvedSource = resolvedSource.replace(/\/\/# sourceURL=(.*)\s*$/, (match, url) => (hasSourceURL = true, match.replace(url, () => new URL(url, load.r))));
    if (!hasSourceURL)
      resolvedSource += '\n//# sourceURL=' + load.r;

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
        if (b && (!supportsImportMaps || importMapSrcOrLazy))
          load.n = true;
        if (d !== -1) return;
        if (!r)
          throwUnresolved(n, load.r || load.u);
        if (skip && skip.test(r)) return { b: r };
        if (childFetchOpts.integrity)
          childFetchOpts = Object.assign({}, childFetchOpts, { integrity: undefined });
        return getOrCreateLoad(r, childFetchOpts).f;
      }))).filter(l => l);
    });

    return load;
  }

  function processScriptsAndPreloads () {
    for (const script of document.querySelectorAll(shimMode ? 'script[type="module-shim"]' : 'script[type="module"]'))
      processScript(script);
    for (const link of document.querySelectorAll('link[rel="modulepreload"]'))
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
  document.addEventListener('DOMContentLoaded', async () => {
    await initPromise;
    domContentLoadedCheck();
    if (shimMode || !baselinePassthrough) {
      processImportMaps();
      processScriptsAndPreloads();
    }
  });

  let readyStateCompleteCnt = 1;
  if (document.readyState === 'complete') {
    readyStateCompleteCheck();
  }
  else {
    document.addEventListener('readystatechange', async () => {
      processImportMaps();
      await initPromise;
      readyStateCompleteCheck();
    });
  }
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
      importMapPromise = importMapPromise.then(async () => {
        importMap = resolveAndComposeImportMap(script.src ? await (await fetchHook(script.src)).json() : JSON.parse(script.innerHTML), script.src || baseUrl, importMap);
      });
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
    const isReadyScript = readyStateCompleteCnt > 0;
    // does this load block DOMContentLoaded
    const isDomContentLoadedScript = domContentLoadedCnt > 0;
    if (isReadyScript) readyStateCompleteCnt++;
    if (isDomContentLoadedScript) domContentLoadedCnt++;
    const loadPromise = topLevelLoad(script.src || `${baseUrl}?${id++}`, getFetchOpts(script), !script.src && script.innerHTML, !shimMode, isReadyScript && lastStaticLoadPromise).catch(e => {
      setTimeout(() => { throw e });
      onerror(e);
    });
    if (isReadyScript)
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
    fetchCache[link.href] = doFetch(link.href, getFetchOpts(link));
  }

  function throwUnresolved (id, parentUrl) {
    throw Error("Unable to resolve specifier '" + id + (parentUrl ? "' from " + parentUrl : "'"));
  }

}());
