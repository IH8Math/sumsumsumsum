import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { X, UploadCloud, Loader2, CheckCircle2 } from 'lucide-react';
import type { CompletionRecord } from '../types';

export default function UploadPDFModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<Partial<CompletionRecord> | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('PDF 파일만 업로드 가능합니다.');
      return;
    }

    setIsProcessing(true);
    setParsedData(null);
    try {
      // 1. Convert to Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;
        
        // 2. Send to Backend
        const res = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 })
        });
        
        if (!res.ok) throw new Error('AI 분석 중 오류가 발생했습니다.');
        
        const data = await res.json();
        setParsedData({
          courseName: data.courseName || '',
          name: data.name || '',
          hours: data.hours || 0,
          year: data.year || new Date().getFullYear()
        });
        setIsProcessing(false);
      };
    } catch (error: any) {
      toast.error(error.message);
      setIsProcessing(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleSave = async () => {
    if (!parsedData || !parsedData.courseName || !parsedData.name) {
      toast.error('데이터가 불완전합니다. 다시 확인해주세요.');
      return;
    }

    const record = {
      id: `comp_${Date.now()}`,
      courseName: parsedData.courseName,
      name: parsedData.name,
      staffName: parsedData.name, // For GAS
      hours: parsedData.hours || 0,
      year: parsedData.year || new Date().getFullYear(),
      completedAt: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0] // For GAS
    };

    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_completion', payload: record })
      });
      if (!res.ok) throw new Error('저장 실패');
      
      toast.success('이수증이 정상적으로 등록되었습니다.');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-2 border-slate-200">
        <div className="flex items-center justify-between p-6 border-b-2 border-slate-100 bg-slate-50">
          <h2 className="text-2xl font-extrabold text-slate-800">이수증 PDF 등록</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8">
          {!parsedData ? (
            <div className="space-y-6">
              <label 
                className={`flex flex-col items-center justify-center w-full h-64 border-4 border-dashed rounded-3xl cursor-pointer transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-100' : 'border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) processFile(file);
                }}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                      <p className="text-xl font-bold text-slate-600">AI가 문서를 분석 중입니다...</p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-16 h-16 text-indigo-400 mb-4" />
                      <p className="mb-2 text-2xl font-bold text-slate-700">여기를 눌러 PDF 파일 선택</p>
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">최대 10MB</p>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="application/pdf"
                  onChange={handleFile}
                  disabled={isProcessing}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-indigo-50/50 rounded-3xl p-8 border-2 border-indigo-100">
                <h3 className="text-xl font-extrabold text-indigo-800 mb-6 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                  인식 결과 확인 (수정 가능)
                </h3>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">성명</label>
                    <input 
                      type="text" 
                      value={parsedData.name || ''} 
                      onChange={e => setParsedData({...parsedData, name: e.target.value})}
                      className="w-full px-5 py-4 bg-white border-2 border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">과정명</label>
                    <input 
                      type="text" 
                      value={parsedData.courseName || ''} 
                      onChange={e => setParsedData({...parsedData, courseName: e.target.value})}
                      className="w-full px-5 py-4 bg-white border-2 border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">이수시간 (숫자)</label>
                      <input 
                        type="number" 
                        value={parsedData.hours || 0} 
                        onChange={e => setParsedData({...parsedData, hours: Number(e.target.value)})}
                        className="w-full px-5 py-4 bg-white border-2 border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">이수년도 (숫자)</label>
                      <input 
                        type="number" 
                        value={parsedData.year || 0} 
                        onChange={e => setParsedData({...parsedData, year: Number(e.target.value)})}
                        className="w-full px-5 py-4 bg-white border-2 border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setParsedData(null)}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg rounded-xl transition-colors border-2 border-transparent"
                >
                  다시 올리기
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-xl transition-colors border-2 border-transparent"
                >
                  최종 등록하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
