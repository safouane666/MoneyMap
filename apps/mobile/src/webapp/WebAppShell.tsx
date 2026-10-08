import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { colors, radius, space } from '../theme/tokens';

WebBrowser.maybeCompleteAuthSession();

const DEFAULT_WEB = 'https://moneymap.phronexus-ai.com';
/** In-app entry — skips marketing landing at `/`. */
const APP_ENTRY_PATH = '/app/boot';

/** Same product UI as web — no parallel native design. */
export function getWebAppUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const api = process.env.EXPO_PUBLIC_API_URL?.trim() || '';
  const derived = api.replace(/\/cm-api\/?$/, '').replace(/\/$/, '');
  return derived || DEFAULT_WEB;
}

function getAppEntryUrl(): string {
  return `${getWebAppUrl()}${APP_ENTRY_PATH}`;
}

function isOurOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === new URL(origin).origin;
  } catch {
    return url.startsWith(origin);
  }
}

function isGoogleAuthUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === 'accounts.google.com' ||
      host.endsWith('.google.com') ||
      host === 'googleapis.com' ||
      host.endsWith('.googleapis.com')
    );
  } catch {
    return /accounts\.google\.com|google\.com\/(?:o\/)?oauth/i.test(url);
  }
}

/**
 * Expo Go always enables New Architecture and does not ship a working RNCWebView
 * for this project. Embedded WebView requires a real APK / dev client build.
 */
function isExpoGo(): boolean {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === 'storeClient'
  );
}

const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';

const DETECT_GOOGLE_BLOCK = `
(function () {
  try {
    var t = (document.title || '') + ' ' + (document.body && document.body.innerText ? document.body.innerText.slice(0, 800) : '');
    if (/disallowed_useragent|403.*error|Access blocked|This browser or app may not be secure/i.test(t)) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'google_blocked', href: location.href }));
    }
  } catch (e) {}
  true;
})();
`;

/**
 * Expo Go cannot mount RNCWebView (New Arch). Live-test the real product URL
 * in an in-app browser instead — same setup / auth / skip / guest flows.
 */
function ExpoGoLivePreview({ entryUrl }: { entryUrl: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openedOnce = useRef(false);

  const openLive = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(entryUrl, {
        enableBarCollapsing: true,
        showInRecents: true,
        ...(Platform.OS === 'ios'
          ? { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN }
          : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open Penny');
    } finally {
      setBusy(false);
    }
  }, [entryUrl]);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
    if (openedOnce.current) return;
    openedOnce.current = true;
    void openLive();
  }, [openLive]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Penny</Text>
        <Text style={styles.fallbackBody}>
          Expo Go can’t embed the app (WebView). Opening the live product for
          testing — same setup, sign-in / skip, and guest flows as production.
        </Text>
        {busy ? <ActivityIndicator size="large" color={colors.brand} /> : null}
        {error ? <Text style={styles.bannerText}>{error}</Text> : null}
        <Pressable style={styles.cta} onPress={() => void openLive()}>
          <Text style={styles.ctaText}>{busy ? 'Opening…' : 'Open live app'}</Text>
        </Pressable>
        <Text style={styles.fallbackHint}>
          For the real embedded shell, install the APK build.
        </Text>
      </View>
    </SafeAreaView>
  );
}

/**
 * Full-screen embedded shell of the production Penny web app.
 * Expo Go: live-tests via in-app browser. APK/IPA: native WebView.
 */
export function WebAppShell() {
  const origin = useMemo(() => getWebAppUrl(), []);
  const entryUrl = useMemo(() => getAppEntryUrl(), []);
  const expoGo = isExpoGo();
  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  /** Only the first cold start — never cover the UI again after content appears. */
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const lastGoogleUrl = useRef<string | null>(null);
  const bootedRef = useRef(false);

  const finishBoot = useCallback(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    setBooting(false);
  }, []);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || expoGo) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, expoGo]);

  const openGoogleInSystemBrowser = useCallback(
    async (url: string) => {
      if (authBusy) return;
      setAuthBusy(true);
      setError(null);
      try {
        const result = await WebBrowser.openAuthSessionAsync(url, origin);
        if (result.type === 'success' && result.url) {
          webRef.current?.injectJavaScript(
            `window.location.replace(${JSON.stringify(result.url)}); true;`,
          );
        } else {
          webRef.current?.injectJavaScript(
            `window.location.replace(${JSON.stringify(`${origin}/auth/sign-in`)}); true;`,
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Google sign-in failed');
      } finally {
        setAuthBusy(false);
      }
    },
    [authBusy, origin],
  );

  if (expoGo) {
    return (
      <ExpoGoLivePreview entryUrl={entryUrl} />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
          <Pressable
            onPress={() => {
              setError(null);
              bootedRef.current = false;
              setBooting(true);
              webRef.current?.reload();
            }}
          >
            <Text style={styles.bannerAction}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.webWrap}>
        <WebView
          ref={webRef}
          source={{ uri: entryUrl }}
          style={styles.web}
          injectedJavaScriptBeforeContentLoaded={`
            try { localStorage.setItem('cm.mobileShell','1'); } catch (e) {}
            true;
          `}
          onLoadEnd={() => {
            finishBoot();
            webRef.current?.injectJavaScript(DETECT_GOOGLE_BLOCK);
            // Never leave users on the public marketing page inside the app.
            webRef.current?.injectJavaScript(`
              (function () {
                try {
                  var path = location.pathname || '/';
                  if (path === '/' || path === '') {
                    location.replace(${JSON.stringify(entryUrl)});
                  }
                } catch (e) {}
                true;
              })();
            `);
          }}
          onLoadProgress={({ nativeEvent }) => {
            // Content often paints before onLoadEnd — drop the veil early.
            if (nativeEvent.progress >= 0.6) finishBoot();
          }}
          onNavigationStateChange={(nav: WebViewNavigation) => {
            setCanGoBack(nav.canGoBack);
            if (isGoogleAuthUrl(nav.url)) lastGoogleUrl.current = nav.url;
            // SPA / soft navigations should never resurrect the boot overlay.
            if (nav.loading === false && isOurOrigin(nav.url, origin)) {
              finishBoot();
            }
            try {
              const path = new URL(nav.url).pathname;
              if (path === '/' || path === '') {
                webRef.current?.injectJavaScript(
                  `window.location.replace(${JSON.stringify(entryUrl)}); true;`,
                );
              }
            } catch {
              /* ignore */
            }
          }}
          onShouldStartLoadWithRequest={(request) => {
            const { url } = request;
            if (!url || url === 'about:blank') return true;
            try {
              const u = new URL(url);
              if (isOurOrigin(url, origin) && (u.pathname === '/' || u.pathname === '')) {
                webRef.current?.injectJavaScript(
                  `window.location.replace(${JSON.stringify(entryUrl)}); true;`,
                );
                return false;
              }
            } catch {
              /* ignore */
            }
            if (isOurOrigin(url, origin) || url.includes('/cm-api/')) return true;
            if (isGoogleAuthUrl(url)) {
              lastGoogleUrl.current = url;
              return true;
            }
            void WebBrowser.openBrowserAsync(url).catch(() => undefined);
            return false;
          }}
          onMessage={(event: WebViewMessageEvent) => {
            try {
              const data = JSON.parse(event.nativeEvent.data) as {
                type?: string;
                href?: string;
              };
              if (data.type === 'google_blocked') {
                const target = lastGoogleUrl.current || data.href;
                if (target && isGoogleAuthUrl(target)) {
                  void openGoogleInSystemBrowser(target);
                }
              }
            } catch {
              /* ignore */
            }
          }}
          onError={(e) => {
            finishBoot();
            setError(e.nativeEvent.description || 'Failed to load Penny');
          }}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 500) {
              finishBoot();
              setError(`Server error ${e.nativeEvent.statusCode}`);
            }
          }}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          userAgent={Platform.OS === 'android' ? ANDROID_CHROME_UA : undefined}
          applicationNameForUserAgent="PennyApp"
          pullToRefreshEnabled
        />

        {booting ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.loadingText}>Loading Penny…</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  webWrap: { flex: 1 },
  web: { flex: 1, backgroundColor: colors.canvas },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247,248,250,0.92)',
    gap: space[3],
  },
  loadingText: { color: colors.inkSecondary, fontSize: 14 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    backgroundColor: '#FEE4E2',
  },
  bannerText: { flex: 1, color: colors.expense, fontSize: 13 },
  bannerAction: {
    color: colors.brand,
    fontWeight: '700',
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.sm,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[6],
    gap: space[4],
  },
  fallbackTitle: { fontSize: 28, fontWeight: '700', color: colors.ink },
  fallbackBody: {
    textAlign: 'center',
    color: colors.inkSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  fallbackHint: {
    textAlign: 'center',
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  cta: {
    marginTop: space[2],
    backgroundColor: colors.brand,
    paddingHorizontal: space[6],
    paddingVertical: space[3],
    borderRadius: radius.control,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
