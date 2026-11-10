import type { Metadata } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({ variable: '--font-bricolage', subsets: ['latin'] });
const body = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Mr Nibbles Staff',
  description: 'Orders, deliveries, production and stock for Mr Nibbles',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
