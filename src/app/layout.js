import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "StudieMate — Din AI-studieassistent",
  description:
    "Ladda upp studiematerial, matcha mot Skolverkets ämnesplan och studera smartare med AI. Nå ditt drömbetyg.",
  keywords: ["studiehjälp", "gymnasiet", "AI", "lärande", "betyg", "ämnesplan"],
  openGraph: {
    title: "StudieMate — AI-studieassistent för gymnasiet",
    description: "Studera smartare. Nå betyg A med AI-driven hjälp.",
    locale: "sv_SE",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="sv" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
