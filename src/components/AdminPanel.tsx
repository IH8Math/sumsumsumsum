import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { Users, FileSpreadsheet, Plus, Copy, AlertCircle, Download, UploadCloud, Trash2 } from 'lucide-react';
import type { AppState, Staff, RequiredTraining } from '../types';
import { isTrainingMatched } from '../utils/matcher';

export default function AdminPanel({ 
  appState, 
  onRefresh,
  onDeleteTrainingLocal 
}: { 
  appState: AppState, 
  onRefresh: () => void,
  onDeleteTrainingLocal?: (id: string, courseName: string) => void
}) {
  const [activeSubTab, setActiveSubTab] = useState<'staff' | 'trainings' | 'status'>('status');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // New Training Form
  const [courseName, setCourseName] = useState('');
  const [department, setDepartment] = useState('');
  const [deadline, setDeadline] = useState('');
  const [managerName, setManagerName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["성명", "소속", "직위"],
      ["홍길동", "6학년 1반", "정교사"],
      ["김철수", "교무실", "기간제교사"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "인적사항_양식");
    XLSX.writeFile(wb, "교직원_인적사항_양식.xlsx");
  };

  const handleFileProcess = async (file: File) => {
    setIsUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet) as any[];

      const staffData: Staff[] = rows.map((row, index) => ({
        id: `staff_${Date.now()}_${index}`,
        name: row['성명'] || row['이름'] || '',
        department: row['소속'] || row['부서'] || row['교무실'] || '',
        position: row['직위'] || row['직급'] || ''
      })).filter(s => s.name);

      if (staffData.length === 0) {
        throw new Error('올바른 엑셀 양식이 아닙니다. (성명, 소속, 직위 열이 필요합니다)');
      }

      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_staff', payload: staffData })
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok || resData.error) throw new Error(resData.error || '서버 저장 실패');
      
      toast.success(`${staffData.length}명의 인적사항이 업로드되었습니다.`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || '파일 처리 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName || !department || !deadline) {
      toast.error('연수명, 주관 부서, 이수 기한을 모두 입력해주세요.');
      return;
    }

    const newTraining: RequiredTraining = {
      id: `train_${Date.now()}`,
      courseName,
      department,
      deadline,
      managerName
    };

    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_required_training', payload: newTraining })
      });
      
      const resData = await res.json().catch(() => ({}));
      if (!res.ok || resData.error) throw new Error(resData.error || '서버 저장 실패');

      toast.success('필수 연수가 등록되었습니다.');
      setCourseName('');
      setDepartment('');
      setDeadline('');
      setManagerName('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || '등록 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteTraining = async (id: string, courseName: string) => {
    if (!window.confirm(`'${courseName}' 연수를 목록에서 삭제하시겠습니까?`)) return;

    // 1. Optimistic removal from UI
    onDeleteTrainingLocal?.(id, courseName);

    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_required_training', payload: { id, courseName } })
      });
      
      const resData = await res.json().catch(() => ({}));
      if (res.ok && resData.success) {
        toast.success('구글 시트에서 연수가 삭제되었습니다.');
      } else {
        toast.error(`구글 시트 반영 실패: ${resData.error || 'Apps Script를 새 버전으로 배포해야 합니다.'}`, { duration: 5000 });
      }
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || '삭제 중 오류가 발생했습니다.');
      onRefresh();
    }
  };

  // Calculate Missing Trainings
  const getMissingTrainingsText = () => {
    let text = '[필수 연수 미이수자 명단]\n\n';
    appState.requiredTrainings.forEach(training => {
      text += `■ ${training.courseName} (기한: ${training.deadline})\n`;
      const missingStaff = appState.staff.filter(s => {
        const hasCompleted = appState.completedTrainings.some(
          c => String(c.name || c.staffName || '').trim() === String(s.name || '').trim() && isTrainingMatched(c.courseName, training.courseName)
        );
        return !hasCompleted;
      });
      if (missingStaff.length === 0) {
        text += `  - 전원 이수 완료!\n`;
      } else {
        text += `  - 미이수자 (${missingStaff.length}명): ${missingStaff.map(s => s.name).join(', ')}\n`;
      }
      text += '\n';
    });
    return text;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getMissingTrainingsText());
    toast.success('클립보드에 복사되었습니다.');
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden flex flex-col h-full max-h-[800px]">
      {/* Sub Navigation */}
      <div className="flex border-b-2 border-slate-200 bg-slate-50 p-4 gap-3 shrink-0">
        <button
          onClick={() => setActiveSubTab('status')}
          className={`px-6 py-2.5 rounded-xl font-bold text-lg transition-colors ${
            activeSubTab === 'status' ? 'bg-white shadow-sm text-indigo-700 border-2 border-indigo-100' : 'text-slate-500 hover:bg-slate-100 border-2 border-transparent'
          }`}
        >
          이수 현황판
        </button>
        <button
          onClick={() => setActiveSubTab('staff')}
          className={`px-6 py-2.5 rounded-xl font-bold text-lg transition-colors ${
            activeSubTab === 'staff' ? 'bg-white shadow-sm text-indigo-700 border-2 border-indigo-100' : 'text-slate-500 hover:bg-slate-100 border-2 border-transparent'
          }`}
        >
          인적사항 관리
        </button>
        <button
          onClick={() => setActiveSubTab('trainings')}
          className={`px-6 py-2.5 rounded-xl font-bold text-lg transition-colors ${
            activeSubTab === 'trainings' ? 'bg-white shadow-sm text-indigo-700 border-2 border-indigo-100' : 'text-slate-500 hover:bg-slate-100 border-2 border-transparent'
          }`}
        >
          필수 연수 등록
        </button>
      </div>

      <div className="p-10 overflow-y-auto flex-1">
        {/* Status Tab */}
        {activeSubTab === 'status' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-3xl font-extrabold text-slate-800">전체 교직원 미이수 현황</h3>
              <button 
                onClick={handleCopy}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-colors border border-indigo-200"
              >
                <Copy className="w-5 h-5" />
                명단 복사하기
              </button>
            </div>
            
            <div className="bg-slate-50 p-8 rounded-2xl border-2 border-slate-200">
              <pre className="whitespace-pre-wrap font-sans text-lg font-medium leading-relaxed text-slate-700">
                {getMissingTrainingsText()}
              </pre>
            </div>
          </div>
        )}

        {/* Staff Tab */}
        {activeSubTab === 'staff' && (
          <div className="space-y-10">
            <div className="bg-slate-50 rounded-3xl p-8 border-2 border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                <div>
                  <h3 className="text-2xl font-extrabold text-slate-800 mb-3">인적사항 일괄 업로드</h3>
                  <p className="text-slate-500 font-medium text-lg">엑셀 파일(.xlsx)을 업로드하여 교직원 명단을 최신화합니다. (성명, 소속, 직위 열 포함 필수)</p>
                </div>
                <button 
                  onClick={downloadTemplate}
                  className="flex items-center shrink-0 gap-2 px-4 py-2 bg-white border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold rounded-xl transition-colors"
                >
                  <Download className="w-5 h-5" />
                  업로드 양식 다운로드
                </button>
              </div>
              
              <label 
                className={`flex flex-col items-center justify-center w-full h-48 border-4 border-dashed rounded-2xl cursor-pointer transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-100' : 'border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => {
                  e.preventDefault(); 
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileProcess(file);
                }}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className={`w-12 h-12 mb-3 ${isDragging ? 'text-indigo-600' : 'text-indigo-400'}`} />
                  <p className="mb-2 text-xl font-bold text-slate-700">여기를 눌러 엑셀 파일 선택 또는 드래그 앤 드롭</p>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">.xlsx, .csv 파일 지원</p>
                </div>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileProcess(file);
                  }}
                  disabled={isUploading}
                />
              </label>
              {isUploading && <p className="text-center mt-4 font-bold text-indigo-600">업로드 중입니다...</p>}
            </div>

            <div>
              <h4 className="text-xl font-extrabold text-slate-800 mb-4 flex items-center gap-3">
                현재 등록된 교직원
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-sm font-bold">{appState.staff.length}명</span>
              </h4>
              <div className="bg-white rounded-2xl border-2 border-slate-200 max-h-[300px] overflow-y-auto">
                <div className="grid grid-cols-3 gap-4 font-bold text-slate-400 uppercase tracking-widest text-sm p-5 border-b-2 border-slate-100 bg-slate-50 sticky top-0">
                  <div>성명</div>
                  <div>소속</div>
                  <div>직위</div>
                </div>
                {appState.staff.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-medium">등록된 교직원이 없습니다.</div>
                ) : (
                  appState.staff.map((s, i) => (
                    <div key={i} className="grid grid-cols-3 gap-4 px-5 py-4 text-lg font-bold text-slate-700 border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <div>{s.name}</div>
                      <div>{s.department}</div>
                      <div>{s.position}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Trainings Tab */}
        {activeSubTab === 'trainings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="space-y-6 bg-slate-50 p-8 rounded-3xl border-2 border-slate-200">
              <h3 className="text-2xl font-extrabold text-slate-800">새 필수 연수 등록</h3>
              <form onSubmit={handleAddTraining} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">연수명</label>
                  <input 
                    type="text" 
                    value={courseName}
                    onChange={e => setCourseName(e.target.value)}
                    className="w-full px-5 py-4 bg-white border-2 border-slate-200 rounded-xl text-lg font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="예: 폭력예방 통합교육"
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">주관 부서</label>
                    <input 
                      type="text" 
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      className="w-full px-5 py-4 bg-white border-2 border-slate-200 rounded-xl text-lg font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                      placeholder="예: 인성교무부"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">담당자 이름 (선택)</label>
                    <input 
                      type="text" 
                      value={managerName}
                      onChange={e => setManagerName(e.target.value)}
                      className="w-full px-5 py-4 bg-white border-2 border-slate-200 rounded-xl text-lg font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                      placeholder="예: 김철수"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">이수 기한</label>
                  <input 
                    type="text" 
                    value={deadline}
                    onChange={e => setDeadline(e.target.value)}
                    className="w-full px-5 py-4 bg-white border-2 border-slate-200 rounded-xl text-lg font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="예: 2024. 11. 30."
                  />
                </div>
                <button type="submit" className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-xl transition-colors mt-4 cursor-pointer">
                  연수 등록하기
                </button>
              </form>
            </div>

            {/* Registered Trainings List */}
            <div className="space-y-4">
              <h3 className="text-2xl font-extrabold text-slate-800 flex items-center justify-between">
                <span>현재 필수 연수 목록</span>
                <span className="text-sm bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full">{appState.requiredTrainings.length}개</span>
              </h3>
              {appState.requiredTrainings.length === 0 ? (
                <div className="p-8 bg-slate-50 rounded-2xl border-2 border-slate-200 text-center text-slate-400 font-bold">
                  등록된 필수 연수가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {appState.requiredTrainings.map(t => (
                    <div key={t.id} className="p-5 bg-white border-2 border-slate-200 rounded-2xl flex items-center justify-between shadow-sm hover:border-indigo-200 transition-colors">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-lg">{t.courseName}</h4>
                        <div className="flex items-center gap-3 text-sm font-bold text-slate-500 mt-1">
                          <span>부서: {t.department}</span>
                          <span>·</span>
                          <span className="text-rose-600">기한: {t.deadline}</span>
                          {t.managerName && (
                            <>
                              <span>·</span>
                              <span>담당: {t.managerName}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteTraining(t.id, t.courseName)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="연수 삭제"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
