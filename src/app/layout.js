import { Inter, Fira_Code } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-fira-code',
  display: 'swap',
});

export const metadata = {
  title: 'ObsidianNode - Minecraft Server Dashboard',
  description: 'Control, monitor, and manage your local Minecraft server nodes in real-time.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${firaCode.variable}`}>
      <body className="bg-obsidian-950 text-slate-200 antialiased selection:bg-mcgreen-500 selection:text-obsidian-950 min-h-screen">
        {children}
      </body>
    </html>
  );
}
