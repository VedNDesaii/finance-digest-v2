import "./globals.css";
import Script from "next/script";
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: "Finance Digest",
  description: "Simple explanations for complex news",
};

// Must be read at build time for client-side use
const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {children}

        {/* Step 1: Register service worker immediately on load */}
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

              setTimeout(async function() {
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
                    console.log('Push not supported');
                    return;
                  }

                  // Don't ask again if already decided
                  if (Notification.permission === 'denied') {
                    console.log('Notifications blocked by user');
                    return;
                  }
                  if (Notification.permission === 'granted') {
                    // Already granted — just make sure subscription is saved
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

                  // Wait for service worker to be ready
                  var registration = await navigator.serviceWorker.ready;

                  // Check for existing subscription
                  var existingSub = await registration.pushManager.getSubscription();
                  if (existingSub) {
                    console.log('Already subscribed');
                    return;
                  }

                  // Convert VAPID key and subscribe
                  var vapidKey = '${VAPID_KEY}';
                  if (!vapidKey) {
                    console.log('VAPID key missing');
                    return;
                  }

                  var subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidKey)
                  });

                  // Save subscription to backend
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
              }, 12000); // 12 seconds — gives SW time to be ready
            `
          }}
        />

        <Analytics />
      </body>
    </html>
  );
}