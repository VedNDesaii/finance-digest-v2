import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "Finance Digest",
  description: "Simple explanations for complex news",
};

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {children}

        <Script id="register-sw" strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(reg) { console.log('SW registered', reg); })
                  .catch(function(err) { console.log('SW failed:', err); })
              })
            }

            setTimeout(async function() {
              try {
                if (!('Notification' in window)) { console.log('No notification support'); return }
                if (!('serviceWorker' in navigator)) { console.log('No SW support'); return }

                console.log('Notification permission:', Notification.permission)

                if (Notification.permission === 'denied') { console.log('Notifications blocked by user'); return }

                const permission = await Notification.requestPermission()
                console.log('Permission result:', permission)
                if (permission !== 'granted') return

                const reg = await navigator.serviceWorker.ready
                const existing = await reg.pushManager.getSubscription()
                if (existing) { console.log('Already subscribed'); return }

                const sub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: '${VAPID_KEY}'
                })

                const res = await fetch('/api/push-subscribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(sub)
                })
                console.log('Subscription saved:', res.ok)
              } catch (e) {
                console.log('Push setup failed:', e)
              }
            }, 5000)
          `}}
        />
      </body>
    </html>
  );
}