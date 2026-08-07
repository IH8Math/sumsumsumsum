import React, { useState, useEffect } from 'react';
import { Loader2, Database, ShieldAlert, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';

interface LoadingScreenProps {
  onRetry?: () => void;
  statusText?: string;
}

export default function LoadingScreen({ onRetry, statusText }: LoadingScreenProps) {
  const [progress, setProgress] = useState(15);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { label: 'Google Sheets 데이터베이스 서버 접속 중...', tip: '구글 앱스 스크립트(GAS) 연동 웹앱으로 보안 통신을 시도합니다.' },
    { label: '교직원 인적사항 및 필수 연수 목록 수신 중...', tip: '등록된 전체 교직원 명단과 시트 데이터를 동기화합니다.' },
    { label: '이수 완료 내역 분석 및 매칭 연산 수행 중...', tip: 'PDF 추출 기록과 필수 연수의 유사도 매칭을 계산합니다.' },
    { label: '대시보드 화면 구성 및 시각화 준비 중...', tip: '곧 대시보드가 열립니다!' }
  ];

  useEffect(() => {
    // Game style progress simulation
    const timer1 = setTimeout(() => { setProgress(45); setCurrentStep(1); }, 800);
    const timer2 = setTimeout(() => { setProgress(75); setCurrentStep(2); }, 2200);
    const timer3 = setTimeout(() => { setProgress(90); setCurrentStep(3); }, 4500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Animated Geometric Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse pointer-events-none" />

      <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-xl border-2 border-slate-700/80 rounded-3xl p-8 shadow-2xl relative z-10 space-y-8 text-center">
        
        {/* App Badge Icon */}
        <div className="relative inline-block">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mx-auto">
            <ShieldAlert className="w-10 h-10 text-white animate-bounce" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-1.5 rounded-xl border-2 border-slate-800">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">교직원 연수 관리 포털</h1>
          <p className="text-indigo-300 text-sm font-bold mt-1">시스템 데이터 동기화 진행 중</p>
        </div>

        {/* Game-style Progress Bar */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-slate-300">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <Database className="w-3.5 h-3.5 animate-spin" />
              {statusText || steps[currentStep]?.label}
            </span>
            <span className="text-indigo-300 font-mono text-sm">{progress}%</span>
          </div>

          <div className="w-full h-4 bg-slate-900 rounded-full p-1 border border-slate-700 relative overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-700 shadow-md relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            </div>
          </div>
        </div>

        {/* Tip Box */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-700/50 text-xs text-slate-300 space-y-1 text-left">
          <span className="font-bold text-amber-400 flex items-center gap-1">
            💡 로딩 팁 (TIP)
          </span>
          <p className="leading-relaxed">
            {steps[currentStep]?.tip || '구글 앱스 스크립트 연결 상태에 따라 로딩 속도가 차이날 수 있습니다.'}
          </p>
        </div>

      </div>
    </div>
  );
}
