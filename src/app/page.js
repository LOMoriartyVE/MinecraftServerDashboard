'use client';

import dynamic from 'next/dynamic';

// Dynamically import the dashboard with server-side rendering disabled
// to avoid any hydration mismatches since it interacts with localStorage and browser APIs.
const Dashboard = dynamic(() => import('../components/Dashboard'), { ssr: false });

export default function Home() {
  return <Dashboard />;
}
