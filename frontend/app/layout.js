import './globals.css'

export const metadata = {
  title: 'Servicios Tamika 0302, C.A.',
  description: 'Panel Financiero y Administrativo',
  icons: {
    icon: '/logo.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  )
}
