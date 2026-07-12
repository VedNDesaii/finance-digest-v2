import "./globals.css";
import Script from "next/script";
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: "Finance Digest",
  description: "Simple explanations for complex news",
  manifest: "/manifest.json",
  themeColor: "#0a0a0a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Finance Digest",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Finance Digest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0a0a0a" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        {children}

        {/* OneSignal Web Push */}
        <Script
          src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
          strategy="afterInteractive"
        />
        <Script
          id="onesignal-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.OneSignalDeferred = window.OneSignalDeferred || [];
              OneSignalDeferred.push(async function(OneSignal) {
                await OneSignal.init({
                  appId: "69ae6789-9fde-4774-9065-a924da6a792b",
                  notifyButton: { enable: false },
                  promptOptions: {
                    slidedown: {
                      prompts: [{
                        type: "push",
                        autoPrompt: false,
                        text: {
                          actionMessage: "Get daily market updates & breaking financial news from Finance Digest",
                          acceptButton: "Allow",
                          cancelButton: "No thanks"
                        }
                      }]
                    }
                  }
                });
              });
            `
          }}
        />

        {/* Register service worker */}
        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) { console.log('SW registered', reg.scope); })
                    .catch(function(err) { console.log('SW failed:', err); });
                });
              }
            `
          }}
        />

        <Analytics />
      </body>
    </html>
  );
}