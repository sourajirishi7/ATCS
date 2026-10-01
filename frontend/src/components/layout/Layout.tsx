import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { AIAssistantDrawer } from '../ai/AIAssistantDrawer';

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Pinned Top Navigation Bar */}
      <Navbar />

      {/* Main Layout Area */}
      <div className="flex pt-16">
        {/* Pinned Left Sidebar (constant across all scrolling pages) */}
        <Sidebar />

        {/* Scrollable Main Content Container */}
        <main className="flex-1 ml-64 p-6 md:p-8 min-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Floating Gemini AI Agent Drawer */}
      <AIAssistantDrawer />
    </div>
  );
};
