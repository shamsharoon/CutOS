import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/components/auth-provider"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        <AuthProvider>
        {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
