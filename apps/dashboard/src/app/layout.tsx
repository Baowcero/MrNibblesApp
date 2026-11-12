import type { Metadata } from 'next';
import { Figtree } from 'next/font/google';
import './globals.css';

// One simple, friendly sans for the whole dashboard.
const sans = Figtree({ variable: '--font-figtree', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Mr Nibbles Staff',
  description: 'Orders, deliveries, production and stock for Mr Nibbles',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${sans.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
