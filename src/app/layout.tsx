import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
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
  themeColor: '#04070d',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  // The experience is scroll-driven; pinch-zoom stays available for a11y.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
