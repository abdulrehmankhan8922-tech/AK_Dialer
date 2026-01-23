import type { Metadata } from 'next'
import './globals.css'
import ThemeInitializer from '@/components/shared/ThemeInitializer'

export const metadata: Metadata = {
  title: 'Dialer System',
  description: 'Professional dialer solution',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeInitializer />
        {children}
      </body>
    </html>
  )
}
