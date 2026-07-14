import "./globals.css";
import Script from "next/script";
import { Analytics } from '@vercel/analytics/next';
import OneSignalInit from './components/OneSignalInit'

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

        <OneSignalInit />
<Analytics />
      </body>
    </html>
  );
}