import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Genome Evidence Audit', description: 'Audit exact sequence retention before and after assembly filtering. Research files are processed on your device.' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
