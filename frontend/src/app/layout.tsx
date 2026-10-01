import type { Metadata } from 'next';
import './globals.css';
import { ConsoleBanner } from '@/components/ConsoleBanner';

export const metadata: Metadata = {
  title: 'Axxela TTX | Trade Transfer',
  description: 'Institutional Multi-Account Position Transfer & Excel Converter',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Anti-Flicker Pre-Paint Theme Initialization */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{var s=null;try{s=localStorage.getItem("trade_theme")}catch(e){}var d=s!=="light";document.documentElement.classList.toggle("dark",d);document.documentElement.classList.toggle("light",!d);document.documentElement.setAttribute("data-theme",d?"dark":"light");document.documentElement.style.colorScheme=d?"dark":"light";})();`,
          }}
        />
      </head>
      <body className="h-full flex flex-col bg-[var(--canvas-bg)] text-[var(--text-main)] antialiased" suppressHydrationWarning>
        <ConsoleBanner />
        {children}
      </body>
    </html>
  );
}
