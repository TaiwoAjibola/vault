import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Keyhold — Every login, under one lock",
    template: "%s · Keyhold",
  },
  description:
    "An encrypted credential vault for the web. Save, search, and autofill logins with a Chrome and Edge extension.",
  applicationName: "Keyhold",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-forest focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
        >
          Skip to content
        </a>
        {children}
        <div className="grain" aria-hidden="true" />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#14231b",
              color: "#f1eee4",
              border: "1px solid rgba(241,238,228,0.14)",
              borderRadius: "14px",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
