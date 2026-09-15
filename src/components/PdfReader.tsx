import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

import {
  escapeForInlineScript,
  loadPdfJsEngine,
  type PdfJsEngineSources,
} from '../services/pdfJsEngine';
import { PageTurnMode } from '../types';

interface Props {
  fileUri: string;
  initialPage: number;
  pageTurnMode: PageTurnMode;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  onAccentColor?: string;
  onPageChange: (pageIndex: number) => void;
  onDocumentLoad: (totalPages: number) => void;
  onHighlightRequest?: (payload: {
    page: number;
    paragraphIndex: number;
    text: string;
  }) => void;
  goToPageRef?: React.MutableRefObject<((page: number) => void) | null>;
  zoomRef?: React.MutableRefObject<((delta: number) => void) | null>;
}

const CHUNK_SIZE = 200_000;

function buildPdfJsHtml(
  bg: string,
  text: string,
  accent: string,
  pageTurnMode: PageTurnMode,
  engine: PdfJsEngineSources,
): string {
  const mode = pageTurnMode === 'flip' ? 'flip' : 'scroll';
  const pdfJsInline = escapeForInlineScript(engine.pdfJs);
  const workerJson = JSON.stringify(engine.worker);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=8, user-scalable=yes" />
  <script>${pdfJsInline}</script>
  <style>
    html, body { margin:0; padding:0; height:100%; background:${bg}; color:${text};
      font-family:-apple-system,BlinkMacSystemFont,sans-serif; overflow:hidden; touch-action:manipulation; }
    #wrap { height:100%; display:flex; flex-direction:column; }
    #status { padding:28px 20px; text-align:center; line-height:1.5; }
    #viewport { flex:1; overflow:auto; -webkit-overflow-scrolling:touch; display:none; padding:12px; text-align:center; }
    #viewport.flip { overflow:auto; display:none; align-items:flex-start; justify-content:center; padding:8px; }
    #pages { display:flex; flex-direction:column; align-items:center; gap:14px; padding-bottom:24px; }
    .pageWrap { position:relative; display:inline-block; max-width:100%; }
    canvas { max-width:100%; height:auto!important; background:#fff; box-shadow:0 8px 28px rgba(0,0,0,.22); border-radius:4px; }
  </style>
</head>
<body>
  <div id="wrap">
    <div id="status">Loading PDF engine…</div>
    <div id="viewport" class="${mode}"><div id="pages"></div></div>
  </div>
  <script>
    (function () {
      var MODE = '${mode}';
      var zoomFactor = 1;
      function post(type, payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {})));
        }
      }
      function setStatus(msg) {
        var s = document.getElementById('status');
        if (s) { s.style.display = 'block'; s.textContent = msg; }
      }

      var pdfDoc = null;
      var pageNum = 1;
      var rendering = false;
      var pending = null;
      var b64Parts = [];
      var flipCanvas = null;
      var flipWrap = null;
      var touchStartX = 0;
      var touchStartY = 0;
      var touchStartAt = 0;
      var lastPostedPage = -1;
      var acceptPagePosts = false;
      var longPressTimer = null;

      window.resetPdfData = function () { b64Parts = []; };
      window.pushPdfChunk = function (chunk) { b64Parts.push(chunk); };

      function postPage(zeroBased, force) {
        if (!acceptPagePosts && !force) return;
        if (zeroBased === lastPostedPage) return;
        lastPostedPage = zeroBased;
        post('page', { page: zeroBased });
      }

      function pageScale(page) {
        var base = page.getViewport({ scale: 1 });
        var dpr = window.devicePixelRatio || 1;
        var pad = MODE === 'flip' ? 16 : 24;
        var fit = Math.min((window.innerWidth - pad) / base.width, 2.6);
        var scale = fit * zoomFactor * dpr;
        return { viewport: page.getViewport({ scale: scale }), dpr: dpr };
      }

      function paintPage(page, canvas) {
        var info = pageScale(page);
        var ctx = canvas.getContext('2d');
        canvas.width = info.viewport.width;
        canvas.height = info.viewport.height;
        canvas.style.width = (info.viewport.width / info.dpr) + 'px';
        canvas.style.height = (info.viewport.height / info.dpr) + 'px';
        return page.render({ canvasContext: ctx, viewport: info.viewport }).promise;
      }

      function excerptFromPage(page, pageZero, paragraphIndex) {
        return page.getTextContent().then(function (tc) {
          var parts = [];
          for (var i = 0; i < tc.items.length; i++) {
            if (tc.items[i].str) parts.push(tc.items[i].str);
          }
          var full = parts.join(' ').replace(/\\s+/g, ' ').trim();
          var text = full.slice(0, 280) || ('Page ' + (pageZero + 1));
          post('highlight', {
            page: pageZero,
            paragraphIndex: paragraphIndex || 0,
            text: text
          });
        }).catch(function () {
          post('highlight', {
            page: pageZero,
            paragraphIndex: paragraphIndex || 0,
            text: 'Page ' + (pageZero + 1)
          });
        });
      }

      function requestHighlightForPage(num) {
        if (!pdfDoc) return;
        pdfDoc.getPage(num).then(function (page) {
          excerptFromPage(page, num - 1, 0);
        });
      }

      function clearLongPress() {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }

      function bindLongPress(el, getPageNum) {
        el.addEventListener('touchstart', function (e) {
          if (!e.changedTouches || !e.changedTouches[0]) return;
          touchStartX = e.changedTouches[0].clientX;
          touchStartY = e.changedTouches[0].clientY;
          touchStartAt = Date.now();
          clearLongPress();
          longPressTimer = setTimeout(function () {
            longPressTimer = null;
            requestHighlightForPage(getPageNum());
          }, 520);
        }, { passive: true });
        el.addEventListener('touchmove', function (e) {
          if (!e.changedTouches || !e.changedTouches[0]) return;
          var dx = e.changedTouches[0].clientX - touchStartX;
          var dy = e.changedTouches[0].clientY - touchStartY;
          if (Math.abs(dx) > 12 || Math.abs(dy) > 12) clearLongPress();
        }, { passive: true });
        el.addEventListener('touchend', function () { clearLongPress(); }, { passive: true });
        el.addEventListener('touchcancel', function () { clearLongPress(); }, { passive: true });
      }

      function renderFlipPage(num) {
        rendering = true;
        pdfDoc.getPage(num).then(function (page) {
          return paintPage(page, flipCanvas).then(function () {
            pageNum = num;
            acceptPagePosts = true;
            postPage(num - 1, true);
          });
        }).catch(function (e) {
          setStatus('Render error: ' + (e && e.message ? e.message : e));
          post('error', { message: String(e && e.message ? e.message : e) });
        }).then(function () {
          rendering = false;
          if (pending != null) { var p = pending; pending = null; queueFlip(p); }
        });
      }

      function queueFlip(num) {
        if (!pdfDoc) return;
        num = Math.max(1, Math.min(pdfDoc.numPages, num));
        if (rendering) { pending = num; return; }
        renderFlipPage(num);
      }

      function setupFlipGestures(viewport) {
        bindLongPress(viewport, function () { return pageNum; });

        viewport.addEventListener('touchstart', function (e) {
          if (!e.changedTouches || !e.changedTouches[0]) return;
          touchStartX = e.changedTouches[0].clientX;
          touchStartY = e.changedTouches[0].clientY;
          touchStartAt = Date.now();
        }, { passive: true });

        viewport.addEventListener('touchend', function (e) {
          if (!e.changedTouches || !e.changedTouches[0]) return;
          var dx = e.changedTouches[0].clientX - touchStartX;
          var dy = e.changedTouches[0].clientY - touchStartY;
          var held = Date.now() - touchStartAt;
          if (held > 450) return;
          if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
          if (dx < 0) queueFlip(pageNum + 1);
          else queueFlip(pageNum - 1);
        }, { passive: true });

        viewport.addEventListener('click', function (e) {
          if (Date.now() - touchStartAt > 450) return;
          var w = window.innerWidth;
          if (e.clientX < w * 0.28) queueFlip(pageNum - 1);
          else if (e.clientX > w * 0.72) queueFlip(pageNum + 1);
        });
      }

      function setupScrollTracking(viewport) {
        var ticking = false;
        function updateFromScroll() {
          ticking = false;
          if (!acceptPagePosts) return;
          // Use page wraps — canvas.offsetTop is relative to the wrap (always ~0)
          var nodes = document.querySelectorAll('#pages [data-slot]');
          if (!nodes.length) {
            nodes = document.querySelectorAll('#pages canvas[data-page]');
          }
          if (!nodes.length) return;
          var mid = viewport.scrollTop + viewport.clientHeight * 0.35;
          var best = pageNum;
          var bestDist = Infinity;
          for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            var pageAttr = el.getAttribute('data-slot') || el.getAttribute('data-page');
            var top = el.offsetTop;
            var dist = Math.abs(top - mid);
            if (dist < bestDist) {
              bestDist = dist;
              best = Number(pageAttr) || best;
            }
          }
          if (best !== pageNum) {
            pageNum = best;
            postPage(best - 1);
          }
        }

        viewport.addEventListener('scroll', function () {
          if (!ticking) {
            ticking = true;
            requestAnimationFrame(updateFromScroll);
          }
        }, { passive: true });
      }

      function jumpToScrollPage(startPage) {
        var pagesEl = document.getElementById('pages');
        var viewport = document.getElementById('viewport');
        var target =
          pagesEl.querySelector('[data-slot="' + startPage + '"]') ||
          pagesEl.querySelector('canvas[data-page="' + startPage + '"]');
        if (target && viewport) {
          viewport.scrollTop = Math.max(0, target.offsetTop - 8);
        }
        pageNum = startPage;
        acceptPagePosts = true;
        postPage(startPage - 1, true);
      }

      function renderScrollPages(startPage) {
        var pagesEl = document.getElementById('pages');
        var viewport = document.getElementById('viewport');
        pagesEl.innerHTML = '';
        acceptPagePosts = false;
        var wraps = {};
        var total = pdfDoc.numPages;

        for (var p = 1; p <= total; p++) {
          (function (num) {
            var wrap = document.createElement('div');
            wrap.className = 'pageWrap';
            wrap.setAttribute('data-slot', String(num));
            wrap.style.minHeight = '240px';
            pagesEl.appendChild(wrap);
            wraps[num] = wrap;
            bindLongPress(wrap, function () { return num; });
          })(p);
        }

        function renderOne(num) {
          return pdfDoc.getPage(num).then(function (page) {
            var wrap = wraps[num];
            var beforeH = wrap.offsetHeight;
            var scrollBefore = viewport ? viewport.scrollTop : 0;
            var canvas = document.createElement('canvas');
            canvas.setAttribute('data-page', String(num));
            wrap.innerHTML = '';
            wrap.appendChild(canvas);
            wrap.style.minHeight = '';
            return paintPage(page, canvas).then(function () {
              // Pages above the current one grow and would push us off — keep place
              if (num < pageNum && viewport) {
                var afterH = wrap.offsetHeight;
                var delta = afterH - beforeH;
                if (delta) viewport.scrollTop = scrollBefore + delta;
              }
            });
          });
        }

        // Resume page first, then fill neighbors without losing place
        renderOne(startPage).then(function () {
          jumpToScrollPage(startPage);
          var order = [];
          for (var d = 1; d < total; d++) {
            if (startPage + d <= total) order.push(startPage + d);
            if (startPage - d >= 1) order.push(startPage - d);
          }
          var i = 0;
          function next() {
            if (i >= order.length) return;
            var n = order[i++];
            renderOne(n).then(function () { setTimeout(next, 0); }).catch(function () {
              setTimeout(next, 0);
            });
          }
          next();
        }).catch(function (e) {
          setStatus('Render error: ' + (e && e.message ? e.message : e));
          post('error', { message: String(e && e.message ? e.message : e) });
        });
      }

      function rerenderCurrent() {
        if (!pdfDoc) return;
        var keep = pageNum;
        acceptPagePosts = false;
        if (MODE === 'flip') {
          queueFlip(keep);
          return;
        }
        renderScrollPages(keep);
      }

      window.setZoomDelta = function (delta) {
        zoomFactor = Math.max(0.7, Math.min(3, zoomFactor + delta));
        post('zoom', { zoom: zoomFactor });
        rerenderCurrent();
      };

      window.goToPage = function (zero) {
        var num = Math.max(1, (zero || 0) + 1);
        if (MODE === 'flip') {
          queueFlip(num);
          return;
        }
        var pagesEl = document.getElementById('pages');
        var viewport = document.getElementById('viewport');
        var target =
          (pagesEl && pagesEl.querySelector('[data-slot="' + num + '"]')) ||
          document.querySelector('canvas[data-page="' + num + '"]');
        if (target && viewport) {
          viewport.scrollTop = Math.max(0, target.offsetTop - 8);
          pageNum = num;
          postPage(num - 1, true);
        }
      };

      window.loadPdfFromChunks = function (startPage) {
        try {
          if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF engine did not load from app bundle.');
          }
          var workerBlob = new Blob([${workerJson}], { type: 'application/javascript' });
          pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
          setStatus('Decoding PDF…');
          var b64 = b64Parts.join('');
          b64Parts = [];
          var raw = atob(b64);
          var bytes = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise.then(function (doc) {
            pdfDoc = doc;
            document.getElementById('status').style.display = 'none';
            var viewport = document.getElementById('viewport');
            viewport.style.display = MODE === 'flip' ? 'flex' : 'block';
            acceptPagePosts = false;
            lastPostedPage = -1;
            post('loaded', { totalPages: doc.numPages });
            var start = Math.max(1, Math.min(doc.numPages, (startPage || 0) + 1));
            if (MODE === 'flip') {
              var pagesEl = document.getElementById('pages');
              pagesEl.innerHTML = '';
              flipWrap = document.createElement('div');
              flipWrap.className = 'pageWrap';
              flipCanvas = document.createElement('canvas');
              flipWrap.appendChild(flipCanvas);
              pagesEl.appendChild(flipWrap);
              setupFlipGestures(viewport);
              queueFlip(start);
            } else {
              setupScrollTracking(viewport);
              renderScrollPages(start);
            }
          }).catch(function (e) {
            setStatus('Could not open PDF: ' + (e && e.message ? e.message : e));
            post('error', { message: String(e && e.message ? e.message : e) });
          });
        } catch (e) {
          setStatus(String(e && e.message ? e.message : e));
          post('error', { message: String(e && e.message ? e.message : e) });
        }
      };

      function boot() {
        if (typeof pdfjsLib === 'undefined') {
          post('error', { message: 'PDF engine failed to initialize from the app bundle.' });
          return;
        }
        post('ready', {});
      }

      if (typeof pdfjsLib !== 'undefined') boot();
      else {
        var tries = 0;
        var t = setInterval(function () {
          tries++;
          if (typeof pdfjsLib !== 'undefined') { clearInterval(t); boot(); }
          else if (tries > 60) {
            clearInterval(t);
            post('error', { message: 'PDF engine timed out while starting. Try again.' });
          }
        }, 100);
      }
    })();
  </script>
</body>
</html>`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function PdfReader({
  fileUri,
  initialPage,
  pageTurnMode,
  backgroundColor,
  textColor,
  accentColor,
  onAccentColor = '#0A0A0A',
  onPageChange,
  onDocumentLoad,
  onHighlightRequest,
  goToPageRef,
  zoomRef,
}: Props) {
  const webRef = useRef<WebView>(null);
  const engineRef = useRef<PdfJsEngineSources | null>(null);
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Opening…');
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const transferStarted = useRef(false);
  const webReady = useRef(false);
  const base64Ref = useRef<string | null>(null);
  const initialPageRef = useRef(initialPage);
  initialPageRef.current = initialPage;

  const onPageChangeRef = useRef(onPageChange);
  const onDocumentLoadRef = useRef(onDocumentLoad);
  const onHighlightRequestRef = useRef(onHighlightRequest);
  onPageChangeRef.current = onPageChange;
  onDocumentLoadRef.current = onDocumentLoad;
  onHighlightRequestRef.current = onHighlightRequest;

  const resetTransferState = useCallback(() => {
    transferStarted.current = false;
    webReady.current = false;
  }, []);

  const tryTransfer = useCallback(async () => {
    const b64 = base64Ref.current;
    const web = webRef.current;
    if (!b64 || !web || !webReady.current || transferStarted.current) return;

    transferStarted.current = true;
    setStatus('Sending PDF to viewer…');
    const startAt = Math.max(0, initialPageRef.current);

    try {
      web.injectJavaScript(
        'window.resetPdfData && window.resetPdfData(); true;',
      );
      await delay(40);

      const total = Math.ceil(b64.length / CHUNK_SIZE) || 1;
      for (let i = 0; i < b64.length; i += CHUNK_SIZE) {
        const chunk = b64.slice(i, i + CHUNK_SIZE);
        const idx = Math.floor(i / CHUNK_SIZE) + 1;
        setStatus(`Loading PDF… ${idx}/${total}`);
        web.injectJavaScript(
          `window.pushPdfChunk && window.pushPdfChunk(${JSON.stringify(chunk)}); true;`,
        );
        // Yield so the UI/WebView can breathe on large files
        await delay(Platform.OS === 'android' ? 16 : 8);
      }

      web.injectJavaScript(
        `window.loadPdfFromChunks && window.loadPdfFromChunks(${startAt}); true;`,
      );
      setStatus('Rendering…');
    } catch (e) {
      transferStarted.current = false;
      setError(
        e instanceof Error ? e.message : 'Failed to load PDF into viewer',
      );
      setLoading(false);
    }
  }, []);

  // Load bundled PDF.js, then rebuild viewer HTML when theme / mode changes
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        resetTransferState();
        setLoading(true);
        setError(null);
        setStatus('Loading PDF engine…');
        setHtml('');

        const engine =
          engineRef.current ?? (await loadPdfJsEngine());
        if (cancelled) return;
        engineRef.current = engine;

        setHtml(
          buildPdfJsHtml(
            backgroundColor,
            textColor,
            accentColor,
            pageTurnMode,
            engine,
          ),
        );
        setStatus('Starting viewer…');
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : 'Could not load the bundled PDF engine',
          );
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    backgroundColor,
    textColor,
    accentColor,
    pageTurnMode,
    reloadToken,
    resetTransferState,
  ]);

  // Read the PDF file into memory
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setError(null);
        setLoading(true);
        setStatus('Reading file…');
        transferStarted.current = false;
        base64Ref.current = null;

        const info = await FileSystem.getInfoAsync(fileUri);
        if (!info.exists) {
          throw new Error('PDF file is missing. Please re-import the book.');
        }

        const size = 'size' in info && typeof info.size === 'number' ? info.size : 0;
        if (size > 45 * 1024 * 1024) {
          throw new Error(
            'This PDF is too large to open in-app (over 45MB). Try a smaller file.',
          );
        }

        setStatus(
          size > 5 * 1024 * 1024
            ? 'Reading large file… this can take a moment'
            : 'Reading file…',
        );

        const b64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!b64) throw new Error('PDF file is empty.');
        if (cancelled) return;

        base64Ref.current = b64;
        setStatus('Starting viewer…');
        // WebView may already be ready — kick transfer either way
        void tryTransfer();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not read PDF');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUri, pageTurnMode, reloadToken, tryTransfer]);

  // If we sit on "Starting viewer" too long, recover
  useEffect(() => {
    if (!loading || error) return;
    if (!status.startsWith('Starting viewer')) return;

    const timer = setTimeout(() => {
      if (transferStarted.current) return;
      if (base64Ref.current && webReady.current) {
        void tryTransfer();
        return;
      }
      if (base64Ref.current && !webReady.current) {
        // File is ready but WebView never said ready — reload HTML
        resetTransferState();
        setReloadToken((t) => t + 1);
        return;
      }
      setError(
        'The viewer got stuck loading this book. Try again.',
      );
      setLoading(false);
    }, 12_000);

    return () => clearTimeout(timer);
  }, [loading, error, status, tryTransfer, resetTransferState]);

  useEffect(() => {
    if (goToPageRef) {
      goToPageRef.current = (page: number) => {
        webRef.current?.injectJavaScript(
          `window.goToPage && window.goToPage(${page}); true;`,
        );
      };
    }
    if (zoomRef) {
      zoomRef.current = (delta: number) => {
        webRef.current?.injectJavaScript(
          `window.setZoomDelta && window.setZoomDelta(${delta}); true;`,
        );
      };
    }
    return () => {
      if (goToPageRef) goToPageRef.current = null;
      if (zoomRef) zoomRef.current = null;
    };
  }, [goToPageRef, zoomRef]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type: string;
        page?: number;
        totalPages?: number;
        message?: string;
        paragraphIndex?: number;
        text?: string;
      };
      if (data.type === 'ready') {
        webReady.current = true;
        void tryTransfer();
      } else if (data.type === 'loaded' && typeof data.totalPages === 'number') {
        onDocumentLoadRef.current(data.totalPages);
        setLoading(false);
        setStatus('');
      } else if (data.type === 'page' && typeof data.page === 'number') {
        onPageChangeRef.current(data.page);
      } else if (data.type === 'highlight' && typeof data.page === 'number') {
        onHighlightRequestRef.current?.({
          page: data.page,
          paragraphIndex: data.paragraphIndex ?? 0,
          text: data.text ?? `Page ${data.page + 1}`,
        });
      } else if (data.type === 'error') {
        setError(data.message ?? 'PDF viewer error');
        setLoading(false);
        transferStarted.current = false;
      }
    } catch {
      // ignore
    }
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    setStatus('Retrying…');
    resetTransferState();
    base64Ref.current = null;
    setReloadToken((t) => t + 1);
  };

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor, padding: 24 }]}>
        <Text style={[styles.title, { color: textColor }]}>Can’t open PDF</Text>
        <Text
          style={{
            color: textColor,
            opacity: 0.75,
            textAlign: 'center',
            marginBottom: 16,
            lineHeight: 22,
          }}
        >
          {error}
        </Text>
        <Pressable
          onPress={retry}
          style={[styles.retryBtn, { backgroundColor: accentColor }]}
        >
          <Text style={{ color: onAccentColor, fontWeight: '700' }}>
            Try again
          </Text>
        </Pressable>
        <Text
          style={{
            color: textColor,
            opacity: 0.55,
            textAlign: 'center',
            marginTop: 16,
          }}
        >
          First open may take a moment while the PDF engine starts. Very large
          files may need a moment to read.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor }]}>
      {html ? (
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        style={styles.flex}
        onLoadEnd={() => {
          // Fallback if postMessage ready was missed
          webRef.current?.injectJavaScript(`
            (function(){
              if (typeof pdfjsLib !== 'undefined' && window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
              }
              true;
            })();
          `);
        }}
        onError={() => {
          setError('WebView failed to load the PDF viewer.');
          setLoading(false);
        }}
      />
      ) : null}
      {!loading ? (
        <View style={styles.zoomStack}>
          <Pressable
            onPress={() =>
              webRef.current?.injectJavaScript(
                'window.setZoomDelta && window.setZoomDelta(0.25); true;',
              )
            }
            style={[styles.zoomBtn, { backgroundColor: accentColor }]}
          >
            <Text style={[styles.zoomText, { color: onAccentColor }]}>+</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              webRef.current?.injectJavaScript(
                'window.setZoomDelta && window.setZoomDelta(-0.25); true;',
              )
            }
            style={[styles.zoomBtn, { backgroundColor: accentColor }]}
          >
            <Text style={[styles.zoomText, { color: onAccentColor }]}>−</Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={[styles.overlay, { backgroundColor }]}>
          <ActivityIndicator color={accentColor} size="large" />
          <Text style={{ color: textColor, marginTop: 12, textAlign: 'center' }}>
            {status || 'Loading…'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  zoomStack: {
    position: 'absolute',
    right: 14,
    bottom: 24,
    gap: 10,
    zIndex: 6,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
});
