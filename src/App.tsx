/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { Search, Upload, FileText, Settings, ShieldAlert, CheckCircle2, Circle } from 'lucide-react';
import type { Staff, RequiredTraining, CompletionRecord, AppState } from './types';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin'>('dashboard');
  const [appState, setAppState] = useState<AppState>({
    staff: [],
    requiredTrainings: [],
    completedTrainings: []
  });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_all' })
      });
      const data = await res.json().catch(() => null);
      
      if (!res.ok) {
        throw new Error(data?.error || '데이터를 불러오는데 실패했습니다.');
      }
      
      setAppState({
        staff: data?.staff || [],
        requiredTrainings: data?.requiredTrainings || [],
        completedTrainings: (data?.completedTrainings || []).map((c: any) => ({
          ...c,
          name: c.name || c.staffName || '',
          completedAt: c.completedAt || c.date || ''
        }))
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans overflow-hidden">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">교직원 연수 관리 포털</h1>
        </div>
        <nav className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-2 rounded-lg font-bold text-lg transition-colors ${
              activeTab === 'dashboard' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            교사 전용
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-6 py-2 rounded-lg font-bold text-lg transition-colors ${
              activeTab === 'admin' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            관리자 모드
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center py-20 text-xl font-bold text-slate-500">데이터를 불러오는 중입니다...</div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard 
                appState={appState} 
                onRefresh={fetchData}
              />
            )}
            {activeTab === 'admin' && (
              <AdminPanel 
                appState={appState} 
                onRefresh={fetchData} 
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="h-10 bg-white border-t border-slate-200 px-10 flex items-center justify-between shrink-0">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic">School Administration Management System v2.4</p>
        <div className="flex gap-6">
          <span className="text-slate-400 text-xs font-bold">Server: Healthy</span>
          <span className="text-slate-400 text-xs font-bold">AI Analysis: Active</span>
        </div>
      </footer>
    </div>
  );
}
