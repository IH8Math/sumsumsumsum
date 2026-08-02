import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { X, UploadCloud, Loader2, CheckCircle2, AlertTriangle, Sparkles, User, BookOpen, Clock, Calendar } from 'lucide-react';
import type { AppState, CompletionRecord } from '../types';
import { isTrainingMatched } from '../utils/matcher';

interface UploadPDFModalProps {
  appState: AppState;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadPDFModal({ appState, onClose, onSuccess }: UploadPDFModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isAiFilled, setIsAiFilled] = useState(false);

  // Form State (Manual / Auto-filled)
  const [formData, setFormData] = useState({
    name: '',
    courseName: '',
    hours: 15,
    year: new Date().getFullYear(),
    date: new Date().toISOString().split('T')[0]
  });

  // AI PDF Processing
  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('PDF 파일만 업로드 가능합니다.');
      return;
    }

    setIsProcessing(true);
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
        toast.success('✨ AI가 이수증 정보를 자동으로 입력했습니다! 내용을 확인해 주세요.');
        setIsProcessing(false);
      };
    } catch (error: any) {
      toast.error(error.message || '파일 처리 중 오류가 발생했습니다.');
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // Real-time duplicate check
  const existingRecords = formData.name.trim() && formData.courseName.trim()
    ? appState.completedTrainings.filter(c => 
        (c.name || '').trim() === formData.name.trim() && 
        isTrainingMatched(c.courseName, formData.courseName)
      )
    : [];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('성명을 입력해 주세요.');
      return;
    }
    if (!formData.courseName.trim()) {
      toast.error('과정명을 입력해 주세요.');
      return;
    }

    setIsSaving(true);

    const record = {
      id: `comp_${Date.now()}`,
      courseName: formData.courseName.trim(),
      name: formData.name.trim(),
      staffName: formData.name.trim(), // For GAS compatibility
      hours: Number(formData.hours) || 0,
      year: Number(formData.year) || new Date().getFullYear(),
      completedAt: new Date(formData.date).toISOString(),
      date: formData.date // For GAS
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
      
      toast.success('이수 내역이 성공적으로 등록되었습니다.');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden my-8 border-2 border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b-2 border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
              <span>📄 이수증 등록</span>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold">수기/AI 선택 가능</span>
            </h2>
            <p className="text-slate-500 text-sm mt-1">PDF 파일 업로드 시 자동 채우기되거나, 수기로 직접 입력할 수 있습니다.</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto">
          
          {/* Section 1: AI PDF Auto-fill Zone */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                AI 자동 채우기 (PDF 업로드)
              </label>
              {isAiFilled && (
                <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-emerald-100">
                  <CheckCircle2 className="w-3.5 h-3.5" /> AI 추출 완료 (수정 가능)
                </span>
              )}
            </div>

            <label 
              className={`flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                isDragging 
                  ? 'border-indigo-500 bg-indigo-100/50' 
                  : isAiFilled
                  ? 'border-emerald-300 bg-emerald-50/30 hover:bg-emerald-50/60'
                  : 'border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/70'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) processFile(file);
              }}
            >
              <div className="flex flex-col items-center justify-center text-center">
                {isProcessing ? (
                  <div className="py-2 flex items-center gap-3">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    <p className="text-md font-bold text-indigo-900">AI가 PDF에서 정보를 읽고 있습니다...</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-indigo-100 flex items-center justify-center shrink-0">
                      <UploadCloud className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-md font-bold text-slate-700">이수증 PDF 파일 끌어놓기 또는 클릭하여 선택</p>
                      <p className="text-xs text-slate-400 font-medium">업로드 시 성명, 연수명, 시간, 연도가 아래 폼에 자동 입력됩니다.</p>
                    </div>
                  </div>
                )}
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept="application/pdf"
                onChange={handleFileChange}
                disabled={isProcessing}
              />
            </label>
          </div>

          <hr className="border-slate-100" />

          {/* Section 2: Form Fields */}
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Quick Fill Buttons for Required Trainings */}
            {appState.requiredTrainings.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  ⚡ 주요 필수 연수 빠른 선택
                </label>
                <div className="flex flex-wrap gap-2">
                  {appState.requiredTrainings.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, courseName: t.courseName }))}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      + {t.courseName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Inputs */}
            <div className="space-y-4">
              
              {/* Name */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-400" /> 성명 <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  list="staff-list"
                  placeholder="예: 홍길동 (목록에서 선택 가능)"
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-md font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                  required
                />
                <datalist id="staff-list">
                  {appState.staff.map(s => (
                    <option key={s.id || s.name} value={s.name}>{s.department} {s.position}</option>
                  ))}
                </datalist>
              </div>

              {/* Course Name */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-slate-400" /> 연수 과정명 <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="예: 2024학년도 교직원 폭력예방 통합교육"
                  value={formData.courseName} 
                  onChange={e => setFormData({ ...formData, courseName: e.target.value })}
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-md font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              {/* Hours, Year, Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" /> 이수시간 (시간)
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    value={formData.hours} 
                    onChange={e => setFormData({ ...formData, hours: Number(e.target.value) })}
                    className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-md font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" /> 이수년도
                  </label>
                  <input 
                    type="number" 
                    min="2000"
                    max="2100"
                    value={formData.year} 
                    onChange={e => setFormData({ ...formData, year: Number(e.target.value) })}
                    className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-md font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" /> 이수일자
                  </label>
                  <input 
                    type="date" 
                    value={formData.date} 
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-md font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>
              </div>

            </div>

            {/* Duplicate Check Warning Alert */}
            {existingRecords.length > 0 && (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold">⚠️ 중복 이수 내역 안내</p>
                  <p className="text-amber-700 mt-0.5">
                    <strong>{formData.name}</strong> 선생님은 이미 관련된 연수(<u>{existingRecords[0].courseName}</u>)를 이수한 기록이 {existingRecords.length}건 존재합니다. 그래도 등록하시겠습니까?
                  </p>
                </div>
              </div>
            )}

            {/* Submit Action Buttons */}
            <div className="flex gap-4 pt-2">
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
                className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-md rounded-xl transition-colors cursor-pointer"
              >
                초기화
              </button>
              <button 
                type="submit"
                disabled={isSaving}
                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-xl transition-colors border-2 border-transparent shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  '최종 등록하기'
                )}
              </button>
            </div>

          </form>

        </div>
      </div>
    </div>
  );
}
