import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import SiteNav from '@/components/ui/SiteNav';
import { DEFAULT_THEME } from '@/lib/design/palette';
import { THEME_ATTRIBUTE, themeScript } from '@/lib/theme';
import '@/styles/globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MedSecure PQC — AI + Post-Quantum Counterfeit Medicine Detection',
  description:
    'An interactive 3D story about how artificial intelligence and post-quantum cryptography combine to detect and prevent counterfeit medicine.',
  keywords: [
    'post-quantum cryptography',
    'counterfeit medicine',
    'pharmaceutical security',
    'ML-KEM',
    'ML-DSA',
    'AI detection',
  ],
  authors: [{ name: 'MedSecure PQC' }],
  openGraph: {
    title: 'MedSecure PQC',
    description:
      'AI-powered, post-quantum cryptography-enabled counterfeit medicine detection.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#06070a' },
  ],
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  // The experience is scroll-driven; pinch-zoom stays available for a11y.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
      `suppressHydrationWarning` because the head script below rewrites
      `data-theme` and `color-scheme` on this element before React ever sees
      it. That is the point of the script -- it is the only way to have the
      right palette on the first paint -- and the resulting difference from the
      server's markup is expected rather than a bug to be reported.
    */
    <html
      lang="en"
      suppressHydrationWarning
      {...{ [THEME_ATTRIBUTE]: DEFAULT_THEME }}
      style={{ colorScheme: DEFAULT_THEME }}
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        {/* Before the first paint, and before any bundle. See `themeScript`. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        {/* Site-wide, so every route carries the same bar and the same way home. */}
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
