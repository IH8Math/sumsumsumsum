import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Sparkles, UploadCloud, Loader2, CheckCircle2, AlertTriangle, 
  User, BookOpen, Clock, Calendar, Trash2, Users, AlertCircle, 
  ChevronDown, ChevronUp, FileText, Check, X 
} from 'lucide-react';
import type { AppState, RequiredTraining, CompletionRecord } from '../types';
import { isTrainingMatched } from '../utils/matcher';

interface DashboardProps {
  appState: AppState;
  onRefresh: () => void;
}

export default function Dashboard({ appState, onRefresh }: DashboardProps) {
  // --- Form State (Manual / AI Fill) ---
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isAiFilled, setIsAiFilled] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    courseName: '',
    hours: 15,
    year: new Date().getFullYear(),
    date: new Date().toISOString().split('T')[0]
  });

  // Selected training details view modal or expand state
  const [expandedTrainingId, setExpandedTrainingId] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<'all' | 'uncompleted' | 'completed'>('all');

  // --- Process PDF with Gemini AI ---
  const processPdfFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('PDF 파일만 업로드 가능합니다.');
      return;
    }

    setIsProcessingPdf(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;
        
        const res = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 })
        });
        
        if (!res.ok) throw new Error('AI 분석 중 오류가 발생했습니다.');
        
        const data = await res.json();
        
        setFormData(prev => ({
          name: data.name || prev.name,
          courseName: data.courseName || prev.courseName,
          hours: Number(data.hours) || prev.hours,
          year: Number(data.year) || prev.year,
          date: prev.date
        }));

        setIsAiFilled(true);
        toast.success('✨ AI가 이수증 정보를 자동으로 입력했습니다! 아래 양식을 확인해 주세요.');
        setIsProcessingPdf(false);
      };
    } catch (error: any) {
      toast.error(error.message || '파일 처리 중 오류가 발생했습니다.');
      setIsProcessingPdf(false);
    }
  };

  // --- Real-time duplicate check ---
  const existingRecords = String(formData.name || '').trim() && String(formData.courseName || '').trim()
    ? appState.completedTrainings.filter(c => 
        String(c.name || c.staffName || '').trim() === String(formData.name || '').trim() && 
        isTrainingMatched(c.courseName, formData.courseName)
      )
    : [];

  // --- Handle Save Completion ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('성명을 입력해 주세요.');
      return;
    }
    if (!formData.courseName.trim()) {
      toast.error('연수 과정명을 입력해 주세요.');
      return;
    }

    setIsSaving(true);

    const record = {
      id: `comp_${Date.now()}`,
      courseName: formData.courseName.trim(),
      name: formData.name.trim(),
      staffName: formData.name.trim(),
      hours: Number(formData.hours) || 0,
      year: Number(formData.year) || new Date().getFullYear(),
      completedAt: new Date(formData.date).toISOString(),
      date: formData.date
    };

    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_completion', payload: record })
      });
      
      const resData = await res.json();
      if (!res.ok || resData.error) {
        throw new Error(resData.error || '이수증 등록에 실패했습니다.');
      }
      
      toast.success('이수 내역이 성공적으로 등록되었습니다!');
      // Reset form
      setFormData({
        name: '',
        courseName: '',
        hours: 15,
        year: new Date().getFullYear(),
        date: new Date().toISOString().split('T')[0]
      });
      setIsAiFilled(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Handle Delete Completion Record ---
  const handleDeleteCompletion = async (id: string, courseName: string, name: string) => {
    if (!window.confirm(`'${name}' 선생님의 '${courseName}' 이수 기록을 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_completion', payload: { id, courseName, name } })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("이수 내역이 삭제되었습니다.");
        onRefresh();
      } else {
        throw new Error(data.error || "삭제에 실패했습니다.");
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // --- Calculate Urgent Trainings (Urgency score) ---
  const totalStaffCount = appState.staff.length || 1;
  const urgentTrainings = appState.requiredTrainings
    .map(t => {
      const completedStaff = appState.staff.filter(s => 
        appState.completedTrainings.some(c => 
          String(c.name || c.staffName || '').trim() === String(s.name || '').trim() && 
          isTrainingMatched(c.courseName, t.courseName)
        )
      );
      const rate = Math.round((completedStaff.length / totalStaffCount) * 100);
      const uncompletedCount = totalStaffCount - completedStaff.length;

      return {
        ...t,
        completedCount: completedStaff.length,
        uncompletedCount,
        rate
      };
    })
    .filter(t => t.rate < 100) // Show only incomplete ones in urgent banner
    .sort((a, b) => a.rate - b.rate); // Sort by lowest completion rate

  return (
    <div className="space-y-8 pb-12">
      
      {/* 1. Urgent Trainings Alert Banner */}
      {urgentTrainings.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl">
              <AlertTriangle className="w-6 h-6 text-yellow-200 animate-bounce" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">🚨 이수 마감 임박 및 주의 연수</h2>
              <p className="text-amber-100 text-sm font-medium">전체 교직원 완수가 필요한 주요 필수 연수의 현재 이수율 현황입니다.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {urgentTrainings.slice(0, 3).map(t => (
              <div key={t.id} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold bg-white/20 text-white px-2.5 py-1 rounded-lg">
                      기한: {t.deadline}
                    </span>
                    <span className="text-xs font-bold bg-rose-950/40 text-rose-200 px-2.5 py-1 rounded-lg">
                      미이수 {t.uncompletedCount}명
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-white line-clamp-1">{t.courseName}</h3>
                  <p className="text-xs text-amber-100 font-medium mt-1">주관부서: {t.department}</p>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span>이수율</span>
                    <span>{t.completedCount} / {totalStaffCount}명 ({t.rate}%)</span>
                  </div>
                  <div className="w-full h-2.5 bg-black/20 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${t.rate < 50 ? 'bg-rose-300' : 'bg-amber-300'}`}
                      style={{ width: `${t.rate}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Main Content Grid: Left (Registration Form) / Right (Trainings Progress) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN (5 cols): Inline Registration Form */}
        <div className="lg:col-span-5 bg-white rounded-3xl border-2 border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" />
              이수증 등록
            </h2>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              수기로 직접 입력하거나, PDF 파일 업로드로 자동 채우기를 실행하세요.
            </p>
          </div>

          {/* AI PDF Upload Zone */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1 text-indigo-600">
                <Sparkles className="w-4 h-4" /> PDF 자동 채우기
              </span>
              {isAiFilled && (
                <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> AI 추출 완료
                </span>
              )}
            </label>

            <label 
              className={`flex flex-col items-center justify-center w-full p-5 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                isDragging 
                  ? 'border-indigo-500 bg-indigo-50' 
                  : isAiFilled
                  ? 'border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/70'
                  : 'border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/70'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) processPdfFile(file);
              }}
            >
              {isProcessingPdf ? (
                <div className="py-3 flex items-center gap-3">
                  <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                  <span className="text-sm font-bold text-indigo-900">PDF 정보를 분석 중입니다...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white rounded-xl shadow-sm border border-indigo-100 shrink-0">
                    <UploadCloud className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-700">PDF 끌어놓기 또는 클릭 선택</p>
                    <p className="text-xs text-slate-400">자동 추출 후 아래 폼에서 수정 가능합니다.</p>
                  </div>
                </div>
              )}
              <input 
                type="file" 
                className="hidden" 
                accept="application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processPdfFile(file);
                }}
                disabled={isProcessingPdf}
              />
            </label>
          </div>

          {/* Quick Select Buttons for Required Trainings */}
          {appState.requiredTrainings.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                ⚡ 필수 연수 명칭 빠른 선택
              </label>
              <div className="flex flex-wrap gap-1.5">
                {appState.requiredTrainings.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, courseName: t.courseName }))}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    + {t.courseName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSave} className="space-y-4">
            {/* Staff Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" /> 성명 <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                list="staff-list-main"
                placeholder="예: 홍길동 (교직원 명단 선택 가능)"
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                required
              />
              <datalist id="staff-list-main">
                {appState.staff.map(s => (
                  <option key={s.id || s.name} value={s.name}>{s.department} {s.position}</option>
                ))}
              </datalist>
            </div>

            {/* Course Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" /> 연수 과정명 <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                placeholder="예: 2024학년도 교직원 폭력예방 통합교육"
                value={formData.courseName} 
                onChange={e => setFormData({ ...formData, courseName: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                required
              />
            </div>

            {/* Hours, Year, Date */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> 시간
                </label>
                <input 
                  type="number" 
                  min="1"
                  value={formData.hours} 
                  onChange={e => setFormData({ ...formData, hours: Number(e.target.value) })}
                  className="w-full px-3 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> 연도
                </label>
                <input 
                  type="number" 
                  min="2000"
                  max="2100"
                  value={formData.year} 
                  onChange={e => setFormData({ ...formData, year: Number(e.target.value) })}
                  className="w-full px-3 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> 이수일자
                </label>
                <input 
                  type="date" 
                  value={formData.date} 
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Duplicate Check Warning Alert */}
            {existingRecords.length > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-800 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">중복 등록 주의</p>
                  <p className="mt-0.5 text-amber-700">
                    <strong>{formData.name}</strong> 선생님은 이미 해당 과정의 이수 내역이 {existingRecords.length}건 있습니다.
                  </p>
                </div>
              </div>
            )}

            {/* Submit Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button 
                type="button"
                onClick={() => {
                  setFormData({
                    name: '',
                    courseName: '',
                    hours: 15,
                    year: new Date().getFullYear(),
                    date: new Date().toISOString().split('T')[0]
                  });
                  setIsAiFilled(false);
                }}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                초기화
              </button>
              <button 
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  '이수 내역 등록하기'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN (7 cols): Trainings Progress & Completion Details */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex justify-between items-center bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm">
            <div>
              <h2 className="text-2xl font-black text-slate-800">연수별 이수 현황</h2>
              <p className="text-slate-500 text-sm font-medium mt-0.5">
                등록된 필수 연수별 전체 교직원 이수 상태를 확인합니다.
              </p>
            </div>
            <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full">
              총 {appState.requiredTrainings.length}개 필수 과정
            </span>
          </div>

          {/* Trainings Cards List */}
          {appState.requiredTrainings.length === 0 ? (
            <div className="p-12 bg-white rounded-3xl border-2 border-slate-200 text-center text-slate-400 font-bold">
              등록된 필수 연수가 없습니다. [관리자 메뉴]에서 필수 연수를 먼저 등록해 주세요.
            </div>
          ) : (
            <div className="space-y-4">
              {appState.requiredTrainings.map(training => {
                const completedStaffList = appState.staff.filter(s => 
                  appState.completedTrainings.some(c => 
                    String(c.name || c.staffName || '').trim() === String(s.name || '').trim() && 
                    isTrainingMatched(c.courseName, training.courseName)
                  )
                );
                const uncompletedStaffList = appState.staff.filter(s => 
                  !completedStaffList.some(cs => cs.name === s.name)
                );
                
                const completedCount = completedStaffList.length;
                const totalCount = appState.staff.length || 1;
                const percentage = Math.round((completedCount / totalCount) * 100);

                // Specific completion records for this training
                const matchingRecords = appState.completedTrainings.filter(c => 
                  isTrainingMatched(c.courseName, training.courseName)
                );

                const isExpanded = expandedTrainingId === training.id;

                return (
                  <div 
                    key={training.id} 
                    className="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-sm hover:border-indigo-200 transition-colors"
                  >
                    {/* Header Summary */}
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md">
                              {training.department}
                            </span>
                            <span className="text-xs font-bold bg-rose-50 text-rose-600 px-2.5 py-0.5 rounded-md">
                              기한: {training.deadline}
                            </span>
                          </div>
                          <h3 className="text-xl font-extrabold text-slate-800 mt-2">{training.courseName}</h3>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-2xl font-black ${percentage === 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                            {percentage}%
                          </span>
                          <p className="text-xs text-slate-400 font-bold">{completedCount} / {totalCount}명 이수</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${percentage === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Toggle Expand Details Button */}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                        <div className="flex gap-2 text-xs font-bold">
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 이수 {completedCount}명
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="text-rose-500 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> 미이수 {uncompletedStaffList.length}명
                          </span>
                        </div>

                        <button
                          onClick={() => setExpandedTrainingId(isExpanded ? null : training.id)}
                          className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                        >
                          {isExpanded ? '상세 명단 닫기' : '명단 및 이수 내역 관리'}
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="bg-slate-50 border-t-2 border-slate-100 p-6 space-y-6">
                        
                        {/* Uncompleted Staff List */}
                        {uncompletedStaffList.length > 0 && (
                          <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-4">
                            <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 text-rose-600" />
                              미이수 교직원 명단 ({uncompletedStaffList.length}명)
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {uncompletedStaffList.map(s => (
                                <span 
                                  key={s.id || s.name} 
                                  className="px-3 py-1 bg-white border border-rose-200 text-rose-700 font-bold text-xs rounded-lg shadow-2xs"
                                >
                                  {s.name} <span className="text-rose-400 text-[10px]">({s.department})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Completed Records List & Delete Option */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              등록된 이수 내역 ({matchingRecords.length}건)
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">잘못 등록된 경우 삭제가 가능합니다.</span>
                          </h4>

                          {matchingRecords.length === 0 ? (
                            <p className="text-xs text-slate-400 font-medium italic">아직 등록된 이수 내역이 없습니다.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {matchingRecords.map(rec => (
                                <div 
                                  key={rec.id} 
                                  className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs group hover:border-rose-300 transition-colors"
                                >
                                  <div>
                                    <p className="font-bold text-sm text-slate-800">{rec.name || rec.staffName}</p>
                                    <p className="text-xs text-slate-400 font-medium">
                                      {rec.year}년 · {rec.hours}시간 · {rec.date || rec.completedAt?.split('T')[0]}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteCompletion(rec.id, rec.courseName, rec.name || rec.staffName || '')}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="이수 내역 삭제"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
