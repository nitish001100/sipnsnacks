import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sip n Snacks - Cafe POS',
  description: 'Sip n Snacks - Cafe, Refreshments & Bites. Point of Sale management system.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F59E0B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Kitchen" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="min-h-screen">
        {/* Single centered watermark logo */}
        <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center" aria-hidden="true">
          <img
            src="/logo.png"
            alt=""
            className="w-[60vmin] h-[60vmin] max-w-[500px] max-h-[500px] object-contain opacity-[0.06]"
            style={{ filter: 'blur(2px) grayscale(30%)' }}
          />
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              borderRadius: '12px',
            },
          }}
        />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
