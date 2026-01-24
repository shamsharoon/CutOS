import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Playfair_Display, Space_Mono, Instrument_Serif } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/components/auth-provider"
import { Toaster } from "sonner"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
export const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", style: ["normal", "italic"] })
export const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space-mono" })
export const instrumentSerif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-instrument", style: ["normal", "italic"] })

export const metadata: Metadata = {
  title: "CutOS",
  description: "Professional video editing with AI assistance",
  icons: {
    icon: [
      {
        url: "/cutos_icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/cutos_icon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${playfair.variable} ${spaceMono.variable} ${instrumentSerif.variable}`} suppressHydrationWarning>
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        <AuthProvider>
        {children}
        </AuthProvider>
        <Toaster position="bottom-right" theme="dark" richColors />
        <Analytics />
      </body>
    </html>
  )
}
