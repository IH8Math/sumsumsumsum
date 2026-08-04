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
import LoadingScreen from './components/LoadingScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin'>('dashboard');
  const [appState, setAppState] = useState<AppState>({
    staff: [],
    requiredTrainings: [],
    completedTrainings: []
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch initial data or refresh
  const fetchData = async (isBackground = false) => {
    if (!isBackground) {
      if (appState.staff.length === 0 && appState.requiredTrainings.length === 0) {
        setIsInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }
    } else {
      setIsRefreshing(true);
    }

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
      
      const rawTrainings = data?.requiredTrainings || [];
      const formattedTrainings = rawTrainings.map((t: any, index: number) => ({
        ...t,
        id: (t.id && String(t.id).trim() !== '') ? String(t.id).trim() : `train_row_${index}`
      }));

      setAppState({
        staff: data?.staff || [],
        requiredTrainings: formattedTrainings,
        completedTrainings: (data?.completedTrainings || []).map((c: any) => ({
          ...c,
          name: c.name || c.staffName || '',
          completedAt: c.completedAt || c.date || ''
        }))
      });
    } catch (err: any) {
      toast.error(err.message || '데이터 불러오기 중 오류가 발생했습니다.');
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteTrainingLocal = (targetId: string, targetCourseName?: string) => {
    setAppState(prev => {
      let removed = false;
      const updatedTrainings = prev.requiredTrainings.filter(t => {
        if (removed) return true; // 이미 1개 지웠으면 이후 동일 조건 객체들은 살림
        
        const isIdMatch = targetId && String(t.id) === String(targetId);
        const isNameMatch = !targetId && targetCourseName && String(t.courseName).trim() === String(targetCourseName).trim();
        
        if (isIdMatch || isNameMatch) {
          removed = true;
          return false;
        }
        return true;
      });

      return {
        ...prev,
        requiredTrainings: updatedTrainings
      };
    });
  };

  const handleDeleteCompletionLocal = (id: string, courseName: string, name: string) => {
    setAppState(prev => ({
      ...prev,
      completedTrainings: prev.completedTrainings.filter(c => {
        const isIdMatch = c.id && String(c.id) === String(id);
        const targetName = c.name || c.staffName;
        const isNameCourseMatch = targetName && c.courseName && 
          String(targetName).trim() === String(name).trim() && 
          String(c.courseName).trim() === String(courseName).trim();
        return !isIdMatch && !isNameCourseMatch;
      })
    }));
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans overflow-hidden">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
              교직원 연수 관리 포털
              {isRefreshing && (
                <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-full animate-pulse">
                  🔄 데이터 동기화 중...
                </span>
              )}
            </h1>
          </div>
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
        {isInitialLoading ? (
          <LoadingScreen onRetry={() => fetchData(false)} />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard 
                appState={appState} 
                onRefresh={fetchData}
                onDeleteCompletionLocal={handleDeleteCompletionLocal}
              />
            )}
            {activeTab === 'admin' && (
              <AdminPanel 
                appState={appState} 
                onRefresh={fetchData} 
                onDeleteTrainingLocal={handleDeleteTrainingLocal}
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
