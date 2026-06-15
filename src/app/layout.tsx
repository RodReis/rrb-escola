import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

// Geist (corpo) e Geist Mono vêm do pacote `geist` (self-hosted): o Next 14
// não expõe essas famílias em next/font/google. Mapeamos as CSS vars do DS
// (--font-sans / --font-mono) para as vars do pacote no <html> (style).
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"]
});

const fontVars = {
  "--font-sans": "var(--font-geist-sans)",
  "--font-mono": "var(--font-geist-mono)"
} as React.CSSProperties;

export const metadata: Metadata = {
  title: "CRM Escola",
  description: "Gestao financeira escolar"
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${display.variable}`}
      style={fontVars}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased font-sans">
        <ConfirmProvider>
          {children}
          <Toaster />
        </ConfirmProvider>
      </body>
    </html>
  );
}
