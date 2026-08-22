import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";

// Milestone 2 Correction Pass — Font Decision: switched from next/font/google's
// Inter to the `geist` package's GeistSans (InvoiceFlow's own typeface).
// GeistSans ships as local static font files bundled at install time, so it
// needs no network fetch during `next build` — this also permanently removes
// the CMS's pre-existing Google-Fonts build fragility (the
// NEXT_FONT_GOOGLE_MOCKED_RESPONSES workaround required for webpack builds,
// with no working equivalent under Turbopack). See the Milestone 2 Correction
// Pass completion report ("Font Decision") for the full rationale.



export const metadata: Metadata = {
  title: "After School Club CMS",
  description: "Management system for after school clubs and tuition centres",
  // PWA / home-screen support
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#0e0e0f" },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SprintScale",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'dark';
                  var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.add('light');
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();

              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${GeistSans.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <SessionProvider>
            {children}
        </SessionProvider>
      </body>
    </html>
  );
}
