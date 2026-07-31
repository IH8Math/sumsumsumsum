import React, { useState } from 'react';
import { Search, Upload, CheckCircle2, Circle } from 'lucide-react';
import type { AppState, RequiredTraining, CompletionRecord } from '../types';

export default function Dashboard({ appState, onOpenUpload }: { appState: AppState, onOpenUpload: () => void }) {
  const [searchName, setSearchName] = useState('');
  const [searched, setSearched] = useState(false);

  // Computed state
  const myCompleted = appState.completedTrainings.filter(c => (c.name || '').trim() === (searchName || '').trim());
  
  const getTrainingStatus = (training: RequiredTraining) => {
    return myCompleted.some(c => c.courseName.includes(training.courseName) || training.courseName.includes(c.courseName));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchName.trim()) setSearched(true);
  };

  const incompleteTrainings = appState.requiredTrainings.filter(t => !getTrainingStatus(t));
  const completionRate = appState.requiredTrainings.length > 0 
    ? Math.round(((appState.requiredTrainings.length - incompleteTrainings.length) / appState.requiredTrainings.length) * 100) 
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
      {/* Left Sidebar: Search & Quick Access */}
      <aside className="col-span-1 lg:col-span-4 flex flex-col gap-6">
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-sm">
          <label className="block text-slate-500 text-sm font-bold uppercase tracking-wider mb-3">연수 현황 조회</label>
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="이름을 입력하세요 (예: 홍길동)"
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-6 py-5 text-xl font-medium focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-300"
              value={searchName}
              onChange={(e) => {
                setSearchName(e.target.value);
                setSearched(false);
              }}
            />
            <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors">검색</button>
          </form>
        </div>

        <div className="bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden flex-1 min-h-[300px] flex flex-col justify-center">
          <div className="relative z-10 text-center md:text-left">
            <h2 className="text-3xl font-bold mb-2">이수증 등록하기</h2>
            <p className="text-indigo-200 text-lg mb-8 leading-relaxed">PDF 파일을 올리시면 AI가<br/>정보를 자동으로 입력합니다.</p>
            <button onClick={onOpenUpload} className="w-full border-2 border-dashed border-indigo-400/50 hover:border-indigo-400 hover:bg-indigo-800/80 transition-colors rounded-2xl p-10 flex flex-col items-center justify-center bg-indigo-800/50 cursor-pointer">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">📄</span>
              </div>
              <span className="font-bold text-lg">파일 업로드 (PDF)</span>
            </button>
          </div>
          {/* Decorative geometry */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full"></div>
        </div>
      </aside>

      {/* Main Content: Status Board */}
      <section className="col-span-1 lg:col-span-8 flex flex-col gap-6">
        {searched ? (
          <>
            <div className="flex items-end justify-between px-2 shrink-0">
              <div>
                <h3 className="text-3xl font-extrabold text-slate-800">내 연수 현황판</h3>
                <p className="text-slate-500 text-lg">{searchName} 선생님의 실시간 정보입니다.</p>
              </div>
              <div className="text-right">
                <span className="text-5xl font-black text-indigo-600">{completionRate}%</span>
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">필수 이수율</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
              {/* Required Tasks */}
              <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 flex flex-col overflow-hidden max-h-[600px]">
                <div className="flex items-center justify-between mb-6 shrink-0">
                  <h4 className="text-xl font-bold text-red-500 flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-500 rounded-full"></span> 미이수 필수 연수
                  </h4>
                  <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-sm font-bold">{incompleteTrainings.length}건</span>
                </div>
                <div className="space-y-4 overflow-y-auto pr-2 flex-1">
                  {incompleteTrainings.length === 0 ? (
                    <div className="p-5 text-center text-slate-400 font-medium">모든 필수 연수를 이수했습니다!</div>
                  ) : (
                    incompleteTrainings.map(training => (
                      <div key={training.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-slate-400 text-sm font-bold">기한: {training.deadline}</p>
                        <h5 className="text-lg font-bold text-slate-800">{training.courseName}</h5>
                        <p className="text-slate-500">
                          {training.department}
                          {training.managerName ? ` · 담당자: ${training.managerName}` : ''}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Completed Tasks */}
              <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 flex flex-col overflow-hidden max-h-[600px]">
                <div className="flex items-center justify-between mb-6 shrink-0">
                  <h4 className="text-xl font-bold text-emerald-500 flex items-center gap-2">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full"></span> 완료된 연수
                  </h4>
                  <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-sm font-bold">{myCompleted.length}건</span>
                </div>
                <div className="space-y-4 overflow-y-auto pr-2 flex-1">
                  {myCompleted.length === 0 ? (
                    <div className="p-5 text-center text-slate-400 font-medium">이수 완료된 연수가 없습니다.</div>
                  ) : (
                    myCompleted.map(c => {
                      const isRequired = appState.requiredTrainings.some(t => t.courseName.includes(c.courseName) || c.courseName.includes(t.courseName));
                      return (
                        <div key={c.id} className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 relative opacity-80">
                          <h5 className="text-lg font-bold text-slate-800">{c.courseName}</h5>
                          <p className="text-slate-500">{c.year}년 · {c.hours}시간 {isRequired ? '· 필수과정' : ''}</p>
                          <span className="absolute top-4 right-4 text-emerald-500 font-bold text-xl">✓</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full bg-white border-2 border-slate-200 rounded-3xl p-10 min-h-[400px]">
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200">
                <Search className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-800 mb-2">이름을 검색해주세요</h3>
              <p className="text-slate-500 text-lg font-medium">왼쪽 검색창에 성명을 입력하고 조회하면<br/>연수 현황을 확인할 수 있습니다.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
