import type { Metadata } from 'next';

import './globals.css';

const themeInitScript = `
  (() => {
    try {
      const storedTheme = window.localStorage.getItem('dashboard:theme');
      document.documentElement.dataset.theme = storedTheme === 'dark' ? 'dark' : 'light';
    } catch {
      document.documentElement.dataset.theme = 'light';
    }
  })();
`;

export const metadata: Metadata = {
  title: 'Marketplace Dashboard MVP',
  description: 'Unified dashboard for Wildberries and Ozon products',
  icons: {
    icon: '/icon'
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
