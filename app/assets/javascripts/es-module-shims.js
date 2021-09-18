/* ES Module Shims CSP 0.15.0 */
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

  function dynamicImport (url, { errUrl = url } = {}) {
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
          reject(new Error(`Error loading or executing the graph of ${errUrl} (check the console for ${src}).`));
        }
      }
    });
    document.head.appendChild(s);
    return p;
  }

  const supportsDynamicImportCheck = dynamicImport(createBlob('0&&import("")')).catch(noop);

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
      dynamicImport(createBlob('import.meta')).then(() => supportsImportMeta = true, noop).
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

  let source, pos, end,
    openTokenDepth,
    lastTokenPos,
    openTokenPosStack,
    openClassPosStack,
    curDynamicImport,
    templateStackDepth,
    facade,
    lastSlashWasDivision,
    nextBraceIsClass,
    templateDepth,
    templateStack,
    imports,
    exports$1,
    name;

  function addImport (ss, s, e, d) {
    const impt = { ss, se: d === -2 ? e : d === -1 ? e + 1 : 0, s, e, d, a: -1, n: undefined };
    imports.push(impt);
    return impt;
  }

  function readName (impt) {
    let { d, s } = impt;
    if (d !== -1)
      s++;
    impt.n = readString(s, source.charCodeAt(s - 1));
  }

  // Note: parsing is based on the _assumption_ that the source is already valid
  function parse (_source, _name) {
    openTokenDepth = 0;
    curDynamicImport = null;
    templateDepth = -1;
    lastTokenPos = -1;
    lastSlashWasDivision = false;
    templateStack = Array(1024);
    templateStackDepth = 0;
    openTokenPosStack = Array(1024);
    openClassPosStack = Array(1024);
    nextBraceIsClass = false;
    facade = true;
    name = _name || '@';

    imports = [];
    exports$1 = new Set();

    source = _source;
    pos = -1;
    end = source.length - 1;
    let ch = 0;

    // start with a pure "module-only" parser
    m: while (pos++ < end) {
      ch = source.charCodeAt(pos);

      if (ch === 32 || ch < 14 && ch > 8)
        continue;

      switch (ch) {
        case 101/*e*/:
          if (openTokenDepth === 0 && keywordStart(pos) && source.startsWith('xport', pos + 1)) {
            tryParseExportStatement();
            // export might have been a non-pure declaration
            if (!facade) {
              lastTokenPos = pos;
              break m;
            }
          }
          break;
        case 105/*i*/:
          if (keywordStart(pos) && source.startsWith('mport', pos + 1))
            tryParseImportStatement();
          break;
        case 59/*;*/:
          break;
        case 47/*/*/: {
          const next_ch = source.charCodeAt(pos + 1);
          if (next_ch === 47/*/*/) {
            lineComment();
            // dont update lastToken
            continue;
          }
          else if (next_ch === 42/***/) {
            blockComment(true);
            // dont update lastToken
            continue;
          }
          // fallthrough
        }
        default:
          // as soon as we hit a non-module token, we go to main parser
          facade = false;
          pos--;
          break m;
      }
      lastTokenPos = pos;
    }

    while (pos++ < end) {
      ch = source.charCodeAt(pos);

      if (ch === 32 || ch < 14 && ch > 8)
        continue;

      switch (ch) {
        case 101/*e*/:
          if (openTokenDepth === 0 && keywordStart(pos) && source.startsWith('xport', pos + 1))
            tryParseExportStatement();
          break;
        case 105/*i*/:
          if (keywordStart(pos) && source.startsWith('mport', pos + 1))
            tryParseImportStatement();
          break;
        case 99/*c*/:
          if (keywordStart(pos) && source.startsWith('lass', pos + 1) && isBrOrWs(source.charCodeAt(pos + 5)))
            nextBraceIsClass = true;
          break;
        case 40/*(*/:
          openTokenPosStack[openTokenDepth++] = lastTokenPos;
          break;
        case 41/*)*/:
          if (openTokenDepth === 0)
            syntaxError();
          openTokenDepth--;
          if (curDynamicImport && curDynamicImport.d === openTokenPosStack[openTokenDepth]) {
            if (curDynamicImport.e === 0)
              curDynamicImport.e = pos;
            curDynamicImport.se = pos;
            curDynamicImport = null;
          }
          break;
        case 123/*{*/:
          // dynamic import followed by { is not a dynamic import (so remove)
          // this is a sneaky way to get around { import () {} } v { import () }
          // block / object ambiguity without a parser (assuming source is valid)
          if (source.charCodeAt(lastTokenPos) === 41/*)*/ && imports.length && imports[imports.length - 1].e === lastTokenPos) {
            imports.pop();
          }
          openClassPosStack[openTokenDepth] = nextBraceIsClass;
          nextBraceIsClass = false;
          openTokenPosStack[openTokenDepth++] = lastTokenPos;
          break;
        case 125/*}*/:
          if (openTokenDepth === 0)
            syntaxError();
          if (openTokenDepth-- === templateDepth) {
            templateDepth = templateStack[--templateStackDepth];
            templateString();
          }
          else {
            if (templateDepth !== -1 && openTokenDepth < templateDepth)
              syntaxError();
          }
          break;
        case 39/*'*/:
        case 34/*"*/:
          stringLiteral(ch);
          break;
        case 47/*/*/: {
          const next_ch = source.charCodeAt(pos + 1);
          if (next_ch === 47/*/*/) {
            lineComment();
            // dont update lastToken
            continue;
          }
          else if (next_ch === 42/***/) {
            blockComment(true);
            // dont update lastToken
            continue;
          }
          else {
            // Division / regex ambiguity handling based on checking backtrack analysis of:
            // - what token came previously (lastToken)
            // - if a closing brace or paren, what token came before the corresponding
            //   opening brace or paren (lastOpenTokenIndex)
            const lastToken = source.charCodeAt(lastTokenPos);
            if (isExpressionPunctuator(lastToken) &&
                !(lastToken === 46/*.*/ && (source.charCodeAt(lastTokenPos - 1) >= 48/*0*/ && source.charCodeAt(lastTokenPos - 1) <= 57/*9*/)) &&
                !(lastToken === 43/*+*/ && source.charCodeAt(lastTokenPos - 1) === 43/*+*/) && !(lastToken === 45/*-*/ && source.charCodeAt(lastTokenPos - 1) === 45/*-*/) ||
                lastToken === 41/*)*/ && isParenKeyword(openTokenPosStack[openTokenDepth]) ||
                lastToken === 125/*}*/ && (isExpressionTerminator(openTokenPosStack[openTokenDepth]) || openClassPosStack[openTokenDepth]) ||
                lastToken === 47/*/*/ && lastSlashWasDivision ||
                isExpressionKeyword(lastTokenPos) ||
                !lastToken) {
              regularExpression();
              lastSlashWasDivision = false;
            }
            else {
              lastSlashWasDivision = true;
            }
          }
          break;
        }
        case 96/*`*/:
          templateString();
          break;
      }
      lastTokenPos = pos;
    }

    if (templateDepth !== -1 || openTokenDepth)
      syntaxError();

    return [imports, [...exports$1], facade];
  }

  function tryParseImportStatement () {
    const startPos = pos;

    pos += 6;

    let ch = commentWhitespace(true);
    
    switch (ch) {
      // dynamic import
      case 40/*(*/:
        openTokenPosStack[openTokenDepth++] = startPos;
        if (source.charCodeAt(lastTokenPos) === 46/*.*/)
          return;
        // dynamic import indicated by positive d
        const impt = addImport(startPos, pos + 1, 0, startPos);
        curDynamicImport = impt;
        // try parse a string, to record a safe dynamic import string
        pos++;
        ch = commentWhitespace(true);
        if (ch === 39/*'*/ || ch === 34/*"*/) {
          stringLiteral(ch);
        }
        else {
          pos--;
          return;
        }
        pos++;
        ch = commentWhitespace(true);
        if (ch === 44/*,*/) {
          impt.e = pos;
          pos++;
          ch = commentWhitespace(true);
          impt.a = pos;
          readName(impt);
          pos--;
        }
        else if (ch === 41/*)*/) {
          openTokenDepth--;
          impt.e = pos;
          impt.se = pos;
          readName(impt);
        }
        else {
          pos--;
        }
        return;
      // import.meta
      case 46/*.*/:
        pos++;
        ch = commentWhitespace(true);
        // import.meta indicated by d === -2
        if (ch === 109/*m*/ && source.startsWith('eta', pos + 1) && source.charCodeAt(lastTokenPos) !== 46/*.*/)
          addImport(startPos, startPos, pos + 4, -2);
        return;
      
      default:
        // no space after "import" -> not an import keyword
        if (pos === startPos + 6)
          break;
      case 34/*"*/:
      case 39/*'*/:
      case 123/*{*/:
      case 42/***/:
        // import statement only permitted at base-level
        if (openTokenDepth !== 0) {
          pos--;
          return;
        }
        while (pos < end) {
          ch = source.charCodeAt(pos);
          if (ch === 39/*'*/ || ch === 34/*"*/) {
            readImportString(startPos, ch);
            return;
          }
          pos++;
        }
        syntaxError();
    }
  }

  function tryParseExportStatement () {
    const sStartPos = pos;

    pos += 6;

    const curPos = pos;

    let ch = commentWhitespace(true);

    if (pos === curPos && !isPunctuator(ch))
      return;

    switch (ch) {
      // export default ...
      case 100/*d*/:
        exports$1.add(source.slice(pos, pos + 7));
        return;

      // export async? function*? name () {
      case 97/*a*/:
        pos += 5;
        commentWhitespace(true);
      // fallthrough
      case 102/*f*/:
        pos += 8;
        ch = commentWhitespace(true);
        if (ch === 42/***/) {
          pos++;
          ch = commentWhitespace(true);
        }
        const startPos = pos;
        ch = readToWsOrPunctuator(ch);
        exports$1.add(source.slice(startPos, pos));
        pos--;
        return;

      case 99/*c*/:
        if (source.startsWith('lass', pos + 1) && isBrOrWsOrPunctuatorNotDot(source.charCodeAt(pos + 5))) {
          pos += 5;
          ch = commentWhitespace(true);
          const startPos = pos;
          ch = readToWsOrPunctuator(ch);
          exports$1.add(source.slice(startPos, pos));
          pos--;
          return;
        }
        pos += 2;
      // fallthrough

      // export var/let/const name = ...(, name = ...)+
      case 118/*v*/:
      case 109/*l*/:
        // destructured initializations not currently supported (skipped for { or [)
        // also, lexing names after variable equals is skipped (export var p = function () { ... }, q = 5 skips "q")
        pos += 2;
        facade = false;
        do {
          pos++;
          ch = commentWhitespace(true);
          const startPos = pos;
          ch = readToWsOrPunctuator(ch);
          // dont yet handle [ { destructurings
          if (ch === 123/*{*/ || ch === 91/*[*/) {
            pos--;
            return;
          }
          if (pos === startPos)
            return;
          exports$1.add(source.slice(startPos, pos));
          ch = commentWhitespace(true);
          if (ch === 61/*=*/) {
            pos--;
            return;
          }
        } while (ch === 44/*,*/);
        pos--;
        return;


      // export {...}
      case 123/*{*/:
        pos++;
        ch = commentWhitespace(true);
        while (true) {
          const startPos = pos;
          readToWsOrPunctuator(ch);
          const endPos = pos;
          commentWhitespace(true);
          ch = readExportAs(startPos, endPos);
          // ,
          if (ch === 44/*,*/) {
            pos++;
            ch = commentWhitespace(true);
          }
          if (ch === 125/*}*/)
            break;
          if (pos === startPos)
            return syntaxError(); 
          if (pos > end)
            return syntaxError();
        }
        pos++;
        ch = commentWhitespace(true);
      break;
      
      // export *
      // export * as X
      case 42/***/:
        pos++;
        commentWhitespace(true);
        ch = readExportAs(pos, pos);
        ch = commentWhitespace(true);
      break;
    }

    // from ...
    if (ch === 102/*f*/ && source.startsWith('rom', pos + 1)) {
      pos += 4;
      readImportString(sStartPos, commentWhitespace(true));
    }
    else {
      pos--;
    }
  }

  /*
   * Ported from Acorn
   *   
   * MIT License

   * Copyright (C) 2012-2020 by various contributors (see AUTHORS)

   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:

   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.

   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  let acornPos;
  function readString (start, quote) {
    acornPos = start;
    let out = '', chunkStart = acornPos;
    for (;;) {
      if (acornPos >= source.length) syntaxError();
      const ch = source.charCodeAt(acornPos);
      if (ch === quote) break;
      if (ch === 92) { // '\'
        out += source.slice(chunkStart, acornPos);
        out += readEscapedChar();
        chunkStart = acornPos;
      }
      else if (ch === 0x2028 || ch === 0x2029) {
        ++acornPos;
      }
      else {
        if (isBr(ch)) syntaxError();
        ++acornPos;
      }
    }
    out += source.slice(chunkStart, acornPos++);
    return out;
  }

  // Used to read escaped characters

  function readEscapedChar () {
    let ch = source.charCodeAt(++acornPos);
    ++acornPos;
    switch (ch) {
      case 110: return '\n'; // 'n' -> '\n'
      case 114: return '\r'; // 'r' -> '\r'
      case 120: return String.fromCharCode(readHexChar(2)); // 'x'
      case 117: return readCodePointToString(); // 'u'
      case 116: return '\t'; // 't' -> '\t'
      case 98: return '\b'; // 'b' -> '\b'
      case 118: return '\u000b'; // 'v' -> '\u000b'
      case 102: return '\f'; // 'f' -> '\f'
      case 13: if (source.charCodeAt(acornPos) === 10) ++acornPos; // '\r\n'
      case 10: // ' \n'
        return '';
      case 56:
      case 57:
        syntaxError();
      default:
        if (ch >= 48 && ch <= 55) {
          let octalStr = source.substr(acornPos - 1, 3).match(/^[0-7]+/)[0];
          let octal = parseInt(octalStr, 8);
          if (octal > 255) {
            octalStr = octalStr.slice(0, -1);
            octal = parseInt(octalStr, 8);
          }
          acornPos += octalStr.length - 1;
          ch = source.charCodeAt(acornPos);
          if (octalStr !== '0' || ch === 56 || ch === 57)
            syntaxError();
          return String.fromCharCode(octal);
        }
        if (isBr(ch)) {
          // Unicode new line characters after \ get removed from output in both
          // template literals and strings
          return '';
        }
        return String.fromCharCode(ch);
    }
  }

  // Used to read character escape sequences ('\x', '\u', '\U').

  function readHexChar (len) {
    const start = acornPos;
    let total = 0, lastCode = 0;
    for (let i = 0; i < len; ++i, ++acornPos) {
      let code = source.charCodeAt(acornPos), val;

      if (code === 95) {
        if (lastCode === 95 || i === 0) syntaxError();
        lastCode = code;
        continue;
      }

      if (code >= 97) val = code - 97 + 10; // a
      else if (code >= 65) val = code - 65 + 10; // A
      else if (code >= 48 && code <= 57) val = code - 48; // 0-9
      else break;
      if (val >= 16) break;
      lastCode = code;
      total = total * 16 + val;
    }

    if (lastCode === 95 || acornPos - start !== len) syntaxError();

    return total;
  }

  // Read a string value, interpreting backslash-escapes.

  function readCodePointToString () {
    const ch = source.charCodeAt(acornPos);
    let code;
    if (ch === 123) { // '{'
      ++acornPos;
      code = readHexChar(source.indexOf('}', acornPos) - acornPos);
      ++acornPos;
      if (code > 0x10FFFF) syntaxError();
    } else {
      code = readHexChar(4);
    }
    // UTF-16 Decoding
    if (code <= 0xFFFF) return String.fromCharCode(code);
    code -= 0x10000;
    return String.fromCharCode((code >> 10) + 0xD800, (code & 1023) + 0xDC00);
  }

  /*
   * </ Acorn Port>
   */

  function readExportAs (startPos, endPos) {
    let ch = source.charCodeAt(pos);
    if (ch === 97 /*a*/) {
      pos += 2;
      ch = commentWhitespace(true);
      startPos = pos;
      readToWsOrPunctuator(ch);
      endPos = pos;
      ch = commentWhitespace(true);
    }
    if (pos !== startPos)
      exports$1.add(source.slice(startPos, endPos));
    return ch;
  }

  function readImportString (ss, ch) {
    const startPos = pos + 1;
    if (ch === 39/*'*/ || ch === 34/*"*/) {
      stringLiteral(ch);
    }
    else {
      syntaxError();
      return;
    }
    const impt = addImport(ss, startPos, pos, -1);
    readName(impt);
    pos++;
    ch = commentWhitespace(false);
    if (ch !== 97/*a*/ || !source.startsWith('ssert', pos + 1)) {
      pos--;
      return;
    }
    const assertIndex = pos;

    pos += 6;
    ch = commentWhitespace(true);
    if (ch !== 123/*{*/) {
      pos = assertIndex;
      return;
    }
    const assertStart = pos;
    do {
      pos++;
      ch = commentWhitespace(true);
      if (ch === 39/*'*/ || ch === 34/*"*/) {
        stringLiteral(ch);
        pos++;
        ch = commentWhitespace(true);
      }
      else {
        ch = readToWsOrPunctuator(ch);
      }
      if (ch !== 58/*:*/) {
        pos = assertIndex;
        return;
      }
      pos++;
      ch = commentWhitespace(true);
      if (ch === 39/*'*/ || ch === 34/*"*/) {
        stringLiteral(ch);
      }
      else {
        pos = assertIndex;
        return;
      }
      pos++;
      ch = commentWhitespace(true);
      if (ch === 44/*,*/) {
        pos++;
        ch = commentWhitespace(true);
        if (ch === 125/*}*/)
          break;
        continue;
      }
      if (ch === 125/*}*/)
        break;
      pos = assertIndex;
      return;
    } while (true);
    impt.a = assertStart;
    impt.se = pos + 1;
  }

  function commentWhitespace (br) {
    let ch;
    do {
      ch = source.charCodeAt(pos);
      if (ch === 47/*/*/) {
        const next_ch = source.charCodeAt(pos + 1);
        if (next_ch === 47/*/*/)
          lineComment();
        else if (next_ch === 42/***/)
          blockComment(br);
        else
          return ch;
      }
      else if (br ? !isBrOrWs(ch): !isWsNotBr(ch)) {
        return ch;
      }
    } while (pos++ < end);
    return ch;
  }

  function templateString () {
    while (pos++ < end) {
      const ch = source.charCodeAt(pos);
      if (ch === 36/*$*/ && source.charCodeAt(pos + 1) === 123/*{*/) {
        pos++;
        templateStack[templateStackDepth++] = templateDepth;
        templateDepth = ++openTokenDepth;
        return;
      }
      if (ch === 96/*`*/)
        return;
      if (ch === 92/*\*/)
        pos++;
    }
    syntaxError();
  }

  function blockComment (br) {
    pos++;
    while (pos++ < end) {
      const ch = source.charCodeAt(pos);
      if (!br && isBr(ch))
        return;
      if (ch === 42/***/ && source.charCodeAt(pos + 1) === 47/*/*/) {
        pos++;
        return;
      }
    }
  }

  function lineComment () {
    while (pos++ < end) {
      const ch = source.charCodeAt(pos);
      if (ch === 10/*\n*/ || ch === 13/*\r*/)
        return;
    }
  }

  function stringLiteral (quote) {
    while (pos++ < end) {
      let ch = source.charCodeAt(pos);
      if (ch === quote)
        return;
      if (ch === 92/*\*/) {
        ch = source.charCodeAt(++pos);
        if (ch === 13/*\r*/ && source.charCodeAt(pos + 1) === 10/*\n*/)
          pos++;
      }
      else if (isBr(ch))
        break;
    }
    syntaxError();
  }

  function regexCharacterClass () {
    while (pos++ < end) {
      let ch = source.charCodeAt(pos);
      if (ch === 93/*]*/)
        return ch;
      if (ch === 92/*\*/)
        pos++;
      else if (ch === 10/*\n*/ || ch === 13/*\r*/)
        break;
    }
    syntaxError();
  }

  function regularExpression () {
    while (pos++ < end) {
      let ch = source.charCodeAt(pos);
      if (ch === 47/*/*/)
        return;
      if (ch === 91/*[*/)
        ch = regexCharacterClass();
      else if (ch === 92/*\*/)
        pos++;
      else if (ch === 10/*\n*/ || ch === 13/*\r*/)
        break;
    }
    syntaxError();
  }

  function readToWsOrPunctuator (ch) {
    do {
      if (isBrOrWs(ch) || isPunctuator(ch))
        return ch;
    } while (ch = source.charCodeAt(++pos));
    return ch;
  }

  // Note: non-asii BR and whitespace checks omitted for perf / footprint
  // if there is a significant user need this can be reconsidered
  function isBr (c) {
    return c === 13/*\r*/ || c === 10/*\n*/;
  }

  function isWsNotBr (c) {
    return c === 9 || c === 11 || c === 12 || c === 32 || c === 160;
  }

  function isBrOrWs (c) {
    return c > 8 && c < 14 || c === 32 || c === 160;
  }

  function isBrOrWsOrPunctuatorNotDot (c) {
    return c > 8 && c < 14 || c === 32 || c === 160 || isPunctuator(c) && c !== 46/*.*/;
  }

  function keywordStart (pos) {
    return pos === 0 || isBrOrWsOrPunctuatorNotDot(source.charCodeAt(pos - 1));
  }

  function readPrecedingKeyword (pos, match) {
    if (pos < match.length - 1)
      return false;
    return source.startsWith(match, pos - match.length + 1) && (pos === 0 || isBrOrWsOrPunctuatorNotDot(source.charCodeAt(pos - match.length)));
  }

  function readPrecedingKeyword1 (pos, ch) {
    return source.charCodeAt(pos) === ch && (pos === 0 || isBrOrWsOrPunctuatorNotDot(source.charCodeAt(pos - 1)));
  }

  // Detects one of case, debugger, delete, do, else, in, instanceof, new,
  //   return, throw, typeof, void, yield, await
  function isExpressionKeyword (pos) {
    switch (source.charCodeAt(pos)) {
      case 100/*d*/:
        switch (source.charCodeAt(pos - 1)) {
          case 105/*i*/:
            // void
            return readPrecedingKeyword(pos - 2, 'vo');
          case 108/*l*/:
            // yield
            return readPrecedingKeyword(pos - 2, 'yie');
          default:
            return false;
        }
      case 101/*e*/:
        switch (source.charCodeAt(pos - 1)) {
          case 115/*s*/:
            switch (source.charCodeAt(pos - 2)) {
              case 108/*l*/:
                // else
                return readPrecedingKeyword1(pos - 3, 101/*e*/);
              case 97/*a*/:
                // case
                return readPrecedingKeyword1(pos - 3, 99/*c*/);
              default:
                return false;
            }
          case 116/*t*/:
            // delete
            return readPrecedingKeyword(pos - 2, 'dele');
          default:
            return false;
        }
      case 102/*f*/:
        if (source.charCodeAt(pos - 1) !== 111/*o*/ || source.charCodeAt(pos - 2) !== 101/*e*/)
          return false;
        switch (source.charCodeAt(pos - 3)) {
          case 99/*c*/:
            // instanceof
            return readPrecedingKeyword(pos - 4, 'instan');
          case 112/*p*/:
            // typeof
            return readPrecedingKeyword(pos - 4, 'ty');
          default:
            return false;
        }
      case 110/*n*/:
        // in, return
        return readPrecedingKeyword1(pos - 1, 105/*i*/) || readPrecedingKeyword(pos - 1, 'retur');
      case 111/*o*/:
        // do
        return readPrecedingKeyword1(pos - 1, 100/*d*/);
      case 114/*r*/:
        // debugger
        return readPrecedingKeyword(pos - 1, 'debugge');
      case 116/*t*/:
        // await
        return readPrecedingKeyword(pos - 1, 'awai');
      case 119/*w*/:
        switch (source.charCodeAt(pos - 1)) {
          case 101/*e*/:
            // new
            return readPrecedingKeyword1(pos - 2, 110/*n*/);
          case 111/*o*/:
            // throw
            return readPrecedingKeyword(pos - 2, 'thr');
          default:
            return false;
        }
    }
    return false;
  }

  function isParenKeyword (curPos) {
    return source.charCodeAt(curPos) === 101/*e*/ && source.startsWith('whil', curPos - 4) ||
        source.charCodeAt(curPos) === 114/*r*/ && source.startsWith('fo', curPos - 2) ||
        source.charCodeAt(curPos - 1) === 105/*i*/ && source.charCodeAt(curPos) === 102/*f*/;
  }

  function isPunctuator (ch) {
    // 23 possible punctuator endings: !%&()*+,-./:;<=>?[]^{}|~
    return ch === 33/*!*/ || ch === 37/*%*/ || ch === 38/*&*/ ||
      ch > 39 && ch < 48 || ch > 57 && ch < 64 ||
      ch === 91/*[*/ || ch === 93/*]*/ || ch === 94/*^*/ ||
      ch > 122 && ch < 127;
  }

  function isExpressionPunctuator (ch) {
    // 20 possible expression endings: !%&(*+,-.:;<=>?[^{|~
    return ch === 33/*!*/ || ch === 37/*%*/ || ch === 38/*&*/ ||
      ch > 39 && ch < 47 && ch !== 41 || ch > 57 && ch < 64 ||
      ch === 91/*[*/ || ch === 94/*^*/ || ch > 122 && ch < 127 && ch !== 125/*}*/;
  }

  function isExpressionTerminator (curPos) {
    // detects:
    // => ; ) finally catch else
    // as all of these followed by a { will indicate a statement brace
    switch (source.charCodeAt(curPos)) {
      case 62/*>*/:
        return source.charCodeAt(curPos - 1) === 61/*=*/;
      case 59/*;*/:
      case 41/*)*/:
        return true;
      case 104/*h*/:
        return source.startsWith('catc', curPos - 4);
      case 121/*y*/:
        return source.startsWith('finall', curPos - 6);
      case 101/*e*/:
        return source.startsWith('els', curPos - 3);
    }
    return false;
  }

  function syntaxError () {
    throw Object.assign(new Error(`Parse error ${name}:${source.slice(0, pos).split('\n').length}:${pos - source.lastIndexOf('\n', pos - 1)}`), { idx: pos });
  }

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
    await undefined;
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