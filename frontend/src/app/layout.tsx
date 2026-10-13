import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Nunito } from 'next/font/google';
import { TelegramProvider } from '@/providers/TelegramProvider';
import '@/styles/globals.css';

const nunito = Nunito({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-nunito',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pizza Kuryer',
  description: 'Issiq va mazali pitsa: tez yetkazib berish',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={nunito.variable} suppressHydrationWarning>
      <head>
        {/* Telegram WebApp SDK: ilova kodidan oldin yuklanishi shart */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="font-sans antialiased">
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
