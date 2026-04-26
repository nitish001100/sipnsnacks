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
      </head>
      <body className="min-h-screen">
        {/* Blurred logo background */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div
            className="absolute inset-0 bg-repeat opacity-[0.04]"
            style={{
              backgroundImage: 'url(/logo.png)',
              backgroundSize: '120px 120px',
              filter: 'blur(1px)',
            }}
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
