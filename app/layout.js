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

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* PWA meta tags for iPhone */}
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

        {/* Step 1: Register service worker */}
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

        {/* Step 2: Ask for push permission after 12 seconds */}
        <Script
          id="push-subscribe"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              function urlBase64ToUint8Array(base64String) {
                var padding = '='.repeat((4 - base64String.length % 4) % 4);
                var base64 = (base64String + padding)
                  .replace(/-/g, '+')
                  .replace(/_/g, '/');
                var rawData = window.atob(base64);
                var outputArray = new Uint8Array(rawData.length);
                for (var i = 0; i < rawData.length; ++i) {
                  outputArray[i] = rawData.charCodeAt(i);
                }
                return outputArray;
              }

              async function setupPush() {
                try {
                  if (!('Notification' in window)) {
                    console.log('Notifications not supported');
                    return;
                  }
                  if (!('serviceWorker' in navigator)) {
                    console.log('Service workers not supported');
                    return;
                  }
                  if (!('PushManager' in window)) {
                    console.log('Push not supported on this browser');
                    return;
                  }

                  if (Notification.permission === 'denied') {
                    console.log('Notifications blocked by user');
                    return;
                  }

                  // If already granted, just ensure subscription exists
                  if (Notification.permission === 'granted') {
                    var reg = await navigator.serviceWorker.ready;
                    var existing = await reg.pushManager.getSubscription();
                    if (existing) {
                      console.log('Already subscribed');
                      return;
                    }
                  }

                  // Request permission
                  var permission = await Notification.requestPermission();
                  console.log('Permission result:', permission);
                  if (permission !== 'granted') return;

                  // Wait for SW to be ready
                  var registration = await navigator.serviceWorker.ready;

                  var existingSub = await registration.pushManager.getSubscription();
                  if (existingSub) {
                    console.log('Already subscribed');
                    return;
                  }

                  var vapidKey = '${VAPID_KEY}';
                  if (!vapidKey) {
                    console.log('VAPID key missing — check NEXT_PUBLIC_VAPID_PUBLIC_KEY');
                    return;
                  }

                  var subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidKey)
                  });

                  var response = await fetch('/api/push-subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(subscription)
                  });

                  if (response.ok) {
                    console.log('Push subscription saved successfully');
                  } else {
                    console.log('Failed to save subscription:', response.status);
                  }

                } catch (e) {
                  console.log('Push setup error:', e.message);
                }
              }

              // On mobile: wait for user interaction before asking
              // On desktop: ask after 12 seconds automatically
              var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

              if (isMobile) {
                // On mobile, only ask after user taps something
                // This avoids browsers silently blocking auto-prompts
                document.addEventListener('click', function onFirstClick() {
                  document.removeEventListener('click', onFirstClick);
                  setTimeout(setupPush, 3000); // 3 sec after first tap
                }, { once: true });
              } else {
                // Desktop: auto-ask after 12 seconds
                setTimeout(setupPush, 12000);
              }
            `
          }}
        />

        <Analytics />
      </body>
    </html>
  );
}