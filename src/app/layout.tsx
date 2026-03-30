import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: "After School Club CMS",
  description: "Management system for after school clubs and tuition centres",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <SessionProvider>
            {children}
            <Toaster position="bottom-right" />
        </SessionProvider>
      </body>
    </html>
  );
}
