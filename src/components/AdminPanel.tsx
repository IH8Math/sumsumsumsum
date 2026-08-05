import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { Users, FileSpreadsheet, Plus, Copy, AlertCircle, Download, UploadCloud, Trash2, Settings, Link, CheckCircle2, RefreshCw, Code, Check } from 'lucide-react';
import type { AppState, Staff, RequiredTraining } from '../types';
import { isTrainingMatched } from '../utils/matcher';

const LATEST_GAS_SCRIPT = `function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    let action = 'get_all';
    let payload = {};

    if (e && e.parameter && e.parameter.action) {
      action = e.parameter.action;
    }

    if (e && e.postData && e.postData.contents) {
      try {
        const body = JSON.parse(e.postData.contents);
        if (body.action) action = body.action;
        if (body.payload) payload = body.payload;
      } catch(err) {}
    }

    let ss = null;
    const TARGET_SPREADSHEET_ID = "1K9MGNWEm6VsPUz8xxIUtnFMufqj_YX0WZ1IMUsEvoN8";

    try {
      const activeSs = SpreadsheetApp.getActiveSpreadsheet();
      if (activeSs && activeSs.getId() === TARGET_SPREADSHEET_ID) {
        ss = activeSs;
      }
    } catch(err) {}
    
    if (!ss && TARGET_SPREADSHEET_ID) {
      try {
        ss = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
      } catch(err) {}
    }

    if (!ss) {
      try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
      } catch(err) {}
    }

    if (!ss) {
      return ContentService.createTextOutput(JSON.stringify({ 
        error: "연결된 구글 시트를 찾을 수 없습니다. [확인 필요]: 구글 시트 상단 [확장 프로그램] > [Apps Script] 메뉴에서 이 코드를 작성하여 배포해 주세요! (또는 script.google.com 독립 스크립트 이용 시 코드 상단 SPREADSHEET_ID에 구글 시트 ID를 적어주세요)" 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 문자열 공백/대소문자 정규화 함수
    const norm = (str) => String(str || '').replace(/\\s+/g, '').toLowerCase();

    // 스마트 시트 탐색 함수 (시트명 및 헤더 키워드 자동 감지)
    const findSheet = (preferredNames, keywords) => {
      const sheets = ss.getSheets();
      for (let pName of preferredNames) {
        let sheet = ss.getSheetByName(pName);
        if (sheet) return sheet;
      }
      for (let s of sheets) {
        const sName = s.getName();
        for (let kw of keywords) {
          if (sName.toLowerCase().includes(kw.toLowerCase())) return s;
        }
      }
      for (let s of sheets) {
        if (s.getLastRow() > 0) {
          const headers = s.getRange(1, 1, 1, Math.min(s.getLastColumn(), 10)).getValues()[0].map(h => norm(h));
          for (let kw of keywords) {
            if (headers.some(h => h.includes(kw))) return s;
          }
        }
      }
      return ss.insertSheet(preferredNames[0]);
    };

    const getTrainingSheet = () => findSheet(["필수연수", "필수연수목록"], ["연수", "필수"]);
    const getStaffSheet = () => findSheet(["교직원", "인적사항"], ["교직원", "인적", "직원"]);
    const getCompletionSheet = () => findSheet(["이수기록", "이수내역"], ["이수", "기록", "내역"]);

    let result = { success: false };

    if (action === 'save_staff') {
      let sheet = getStaffSheet();
      sheet.clear();
      sheet.appendRow(["ID", "성명", "소속", "직위"]);
      const rows = (payload || []).map(staff => [staff.id, staff.name, staff.department, staff.position]);
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 4).setValues(rows);
      }
      result = { success: true, message: "인적사항 저장 완료" };

    } else if (action === 'save_required_training') {
      let sheet = getTrainingSheet();
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["ID", "연수명", "주관부서", "이수기한", "담당자"]);
      }
      const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(h => norm(h));
      const hasIdCol = headers.some(h => h === 'id');

      if (hasIdCol) {
        sheet.appendRow([payload.id, payload.courseName, payload.department, payload.deadline, payload.managerName || ""]);
      } else {
        sheet.getRange(1, 1, 1, 5).setValues([["ID", "연수명", "주관부서", "이수기한", "담당자"]]);
        sheet.appendRow([payload.id, payload.courseName, payload.department, payload.deadline, payload.managerName || ""]);
      }
      result = { success: true, message: "필수연수 저장 완료" };

    } else if (action === 'save_completion') {
      let sheet = getCompletionSheet();
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["ID", "직원명", "연수명", "이수시간", "연도", "날짜", "PDF_링크"]);
      }
      sheet.appendRow([payload.id, payload.staffName || payload.name, payload.courseName, payload.hours, payload.year, payload.date, ""]);
      result = { success: true, message: "이수기록 저장 완료" };

    } else if (action === 'get_all' || action === 'get_data') {
      // 1. 교직원 인적사항
      let staffSheet = getStaffSheet();
      let staffData = [];
      if (staffSheet.getLastRow() > 1) {
        const rows = staffSheet.getRange(2, 1, staffSheet.getLastRow() - 1, Math.max(staffSheet.getLastColumn(), 4)).getValues();
        staffData = rows.map((row, idx) => ({
          id: String(row[0] || \`staff_\${idx}\`).trim(),
          name: String(row[1] || '').trim(),
          department: String(row[2] || '').trim(),
          position: String(row[3] || '').trim()
        })).filter(s => s.name !== '');
      }

      // 2. 필수 연수 목록
      let trainingSheet = getTrainingSheet();
      let trainingData = [];
      if (trainingSheet.getLastRow() > 1) {
        const rows = trainingSheet.getRange(1, 1, trainingSheet.getLastRow(), Math.max(trainingSheet.getLastColumn(), 5)).getValues();
        const headers = rows[0].map(h => norm(h));
        
        let idIdx = headers.indexOf('id');
        let courseIdx = headers.findIndex(h => h.includes('연수') || h.includes('과정'));
        let deptIdx = headers.findIndex(h => h.includes('부서') || h.includes('소속'));
        let deadlineIdx = headers.findIndex(h => h.includes('기한') || h.includes('날짜'));
        let managerIdx = headers.findIndex(h => h.includes('담당'));

        if (courseIdx === -1) courseIdx = (idIdx === 0) ? 1 : 0;
        if (deptIdx === -1) deptIdx = courseIdx + 1;
        if (deadlineIdx === -1) deadlineIdx = deptIdx + 1;
        if (managerIdx === -1) managerIdx = deadlineIdx + 1;

        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          const course = String(r[courseIdx] || '').trim();
          if (!course) continue;

          const rowId = (idIdx !== -1 && r[idIdx] && String(r[idIdx]).trim() !== '') ? String(r[idIdx]).trim() : \`train_\${i}\`;
          trainingData.push({
            id: rowId,
            courseName: course,
            department: String(r[deptIdx] || '').trim(),
            deadline: String(r[deadlineIdx] || '').trim(),
            managerName: String(r[managerIdx] || '').trim()
          });
        }
      }

      // 3. 이수 기록
      let completionSheet = getCompletionSheet();
      let completionData = [];
      if (completionSheet.getLastRow() > 1) {
        const rows = completionSheet.getRange(2, 1, completionSheet.getLastRow() - 1, Math.max(completionSheet.getLastColumn(), 6)).getValues();
        completionData = rows.map((row, idx) => ({
          id: String(row[0] || \`comp_\${idx}\`).trim(),
          staffName: String(row[1] || '').trim(),
          name: String(row[1] || '').trim(),
          courseName: String(row[2] || '').trim(),
          hours: Number(row[3]) || 0,
          year: Number(row[4]) || new Date().getFullYear(),
          date: String(row[5] || '').trim()
        })).filter(c => c.staffName && c.courseName);
      }

      result = {
        success: true,
        staff: staffData,
        requiredTrainings: trainingData,
        completedTrainings: completionData
      };

    } else if (action === 'delete_required_training') {
      let deletedCount = 0;
      const targetSheets = ss.getSheets();
      const targetIdNorm = norm(payload.id);
      const targetCourseNorm = norm(payload.courseName);

      for (let sheet of targetSheets) {
        const sheetName = sheet.getName();
        if (sheet.getLastRow() <= 1) continue;
        
        if (sheetName.includes('연수') || sheetName.includes('Sheet') || sheetName.includes('시트') || sheetName.includes('목록')) {
          const data = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
          
          for (let i = data.length - 1; i >= 1; i--) {
            const rowValues = data[i].map(v => norm(v));
            
            const isIdMatch = targetIdNorm && !targetIdNorm.startsWith('train_row_') && rowValues.some(cell => cell === targetIdNorm);
            const isCourseMatch = targetCourseNorm && targetCourseNorm !== '' && rowValues.some(cell => cell === targetCourseNorm || cell.includes(targetCourseNorm));

            if (isIdMatch || isCourseMatch) {
              sheet.deleteRow(i + 1);
              deletedCount++;
            }
          }
        }
      }
      result = { success: true, message: \`필수 연수 삭제 완료 (\${deletedCount}건)\` };

    } else if (action === 'delete_completion') {
      let deletedCount = 0;
      const targetSheets = ss.getSheets();
      const targetIdNorm = norm(payload.id);
      const targetNameNorm = norm(payload.name || payload.staffName);
      const targetCourseNorm = norm(payload.courseName);

      for (let sheet of targetSheets) {
        const sheetName = sheet.getName();
        if (sheet.getLastRow() <= 1) continue;

        if (sheetName.includes('이수') || sheetName.includes('기록') || sheetName.includes('내역') || sheetName.includes('Sheet') || sheetName.includes('시트')) {
          const data = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();

          for (let i = data.length - 1; i >= 1; i--) {
            const rowValues = data[i].map(v => norm(v));
            
            const isIdMatch = targetIdNorm && !targetIdNorm.startsWith('comp_') && rowValues.some(cell => cell === targetIdNorm);
            const isNameMatch = targetNameNorm && rowValues.some(cell => cell === targetNameNorm);
            const isCourseMatch = targetCourseNorm && rowValues.some(cell => cell === targetCourseNorm || cell.includes(targetCourseNorm));

            if (isIdMatch || (isNameMatch && isCourseMatch)) {
              sheet.deleteRow(i + 1);
              deletedCount++;
            }
          }
        }
      }
      result = { success: true, message: \`이수 기록 삭제 완료 (\${deletedCount}건)\` };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message, stack: error.stack }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

export default function AdminPanel({ 
  appState, 
  onRefresh,
  onDeleteTrainingLocal 
}: { 
  appState: AppState, 
  onRefresh: () => void,
  onDeleteTrainingLocal?: (id: string, courseName: string) => void
}) {
  const [activeSubTab, setActiveSubTab] = useState<'status' | 'staff' | 'trainings' | 'settings'>('status');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Custom GAS Web App URL state
  const [gasUrlInput, setGasUrlInput] = useState<string>(() => {
    return localStorage.getItem('gas_web_app_url') || '';
  });

  const saveGasUrl = () => {
    const trimmed = gasUrlInput.trim();
    if (!trimmed) {
      localStorage.removeItem('gas_web_app_url');
      toast.success('기본 설정 연동 URL로 초기화되었습니다.');
      onRefresh();
      return;
    }

    if (trimmed.includes('/library/d/')) {
      toast.error('입력하신 주소는 [라이브러리 URL]입니다! [배포] -> [웹앱]에서 생성된 /macros/s/.../exec 형태의 웹앱 URL을 입력해주세요.', { duration: 6000 });
      return;
    }

    if (trimmed.includes('/edit') || trimmed.includes('spreadsheets/d/')) {
      toast.error('스프레드시트/편집기 주소가 아닌, 구글 앱스크립트 [배포 관리]에서 발급된 웹앱 URL을 입력하셔야 합니다.', { duration: 6000 });
      return;
    }

    if (!trimmed.startsWith('https://script.google.com/macros/s/') || !trimmed.endsWith('/exec')) {
      toast.error('올바른 웹앱 URL 형식은 https://script.google.com/macros/s/.../exec 입니다. 끝이 /exec 로 끝나는지 확인하세요.', { duration: 6000 });
      return;
    }

    localStorage.setItem('gas_web_app_url', trimmed);
    toast.success('구글 시트 연동 웹앱 URL이 성공적으로 저장되었습니다.');
    onRefresh();
  };

  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const savedUrl = localStorage.getItem('gas_web_app_url');
    if (savedUrl) headers['x-gas-url'] = savedUrl;
    return headers;
  };

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
        headers: getHeaders(),
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

  const handleSyncCurrentStaffToSheet = async () => {
    if (appState.staff.length === 0) {
      toast.error('전송할 교직원 데이터가 없습니다.');
      return;
    }
    setIsUploading(true);
    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'save_staff', payload: appState.staff })
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok || resData.error) throw new Error(resData.error || '구글 시트 저장 실패');
      
      toast.success(`구글 시트 '교직원' 탭에 ${appState.staff.length}명의 데이터가 정상 저장(동기화)되었습니다!`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || '구글 시트 저장 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSyncCurrentTrainingsToSheet = async () => {
    if (appState.requiredTrainings.length === 0) {
      toast.error('전송할 필수 연수 데이터가 없습니다.');
      return;
    }
    setIsUploading(true);
    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'save_all_required_trainings', payload: appState.requiredTrainings })
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok || resData.error) throw new Error(resData.error || '구글 시트 저장 실패');
      
      toast.success(`구글 시트 '필수연수' 탭에 ${appState.requiredTrainings.length}개의 연수 목록이 정상 저장(동기화)되었습니다!`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || '구글 시트 저장 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
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
        headers: getHeaders(),
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
    if (!window.confirm(`'${courseName}' 연수를 필수 연수 목록에서 삭제하시겠습니까?\n(교직원분들이 이미 업로드한 이수 기록은 삭제되지 않고 안전하게 보존됩니다.)`)) return;

    // 1. Optimistic removal from UI
    onDeleteTrainingLocal?.(id, courseName);

    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'delete_required_training', payload: { id, courseName } })
      });
      
      const resData = await res.json().catch(() => ({}));
      if (res.ok && resData.success) {
        toast.success('구글 시트 필수 연수 목록에서 연수가 정상 삭제되었습니다.');
      } else {
        const errorMsg = resData.error || '구글 Apps Script에 필수 연수 삭제 기능(delete_required_training)이 작성되어있지 않은 구버전 스크립트입니다. [구글 시트 연동 설정] 탭에서 최신 GAS 코드를 복사하여 구글 Apps Script에 [새 배포]를 진행해 주세요.';
        toast.error(`구글 시트 반영 실패: ${errorMsg}`, { duration: 8000 });
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
      <div className="flex flex-wrap items-center justify-between border-b-2 border-slate-200 bg-slate-50 p-4 gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('status')}
            className={`px-5 py-2.5 rounded-xl font-bold text-base transition-colors ${
              activeSubTab === 'status' ? 'bg-white shadow-sm text-indigo-700 border-2 border-indigo-100' : 'text-slate-500 hover:bg-slate-100 border-2 border-transparent'
            }`}
          >
            이수 현황판
          </button>
          <button
            onClick={() => setActiveSubTab('staff')}
            className={`px-5 py-2.5 rounded-xl font-bold text-base transition-colors ${
              activeSubTab === 'staff' ? 'bg-white shadow-sm text-indigo-700 border-2 border-indigo-100' : 'text-slate-500 hover:bg-slate-100 border-2 border-transparent'
            }`}
          >
            인적사항 관리
          </button>
          <button
            onClick={() => setActiveSubTab('trainings')}
            className={`px-5 py-2.5 rounded-xl font-bold text-base transition-colors ${
              activeSubTab === 'trainings' ? 'bg-white shadow-sm text-indigo-700 border-2 border-indigo-100' : 'text-slate-500 hover:bg-slate-100 border-2 border-transparent'
            }`}
          >
            필수 연수 등록
          </button>
          <button
            onClick={() => setActiveSubTab('settings')}
            className={`px-5 py-2.5 rounded-xl font-bold text-base flex items-center gap-2 transition-colors ${
              activeSubTab === 'settings' ? 'bg-white shadow-sm text-indigo-700 border-2 border-indigo-100' : 'text-slate-500 hover:bg-slate-100 border-2 border-transparent'
            }`}
          >
            <Settings className="w-4 h-4" />
            구글 시트 연동 설정
          </button>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
          title="구글 시트 동기화"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          시트 데이터 동기화
        </button>
      </div>

      <div className="p-8 overflow-y-auto flex-1">
        {/* Settings Tab */}
        {activeSubTab === 'settings' && (
          <div className="space-y-8 max-w-4xl mx-auto">
            {/* Extremely Prominent GAS Code Copy Section */}
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg border-2 border-indigo-500/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                    <Code className="w-6 h-6 text-indigo-400" />
                    최신 Google Apps Script (GAS) 코드 복사
                  </h3>
                  <p className="text-xs text-indigo-200 mt-1">
                    삭제 기능 및 신규 API가 지원되는 최신 앱스크립트 코드입니다. 복사 후 구글 Apps Script 편집기에 붙여넣고 [새 배포] 해주세요.
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(LATEST_GAS_SCRIPT);
                    toast.success('최신 GAS 코드가 클립보드에 복사되었습니다! Apps Script 편집기에 붙여넣고 [새 배포]를 진행해 주세요.', { duration: 5000 });
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-500 hover:bg-indigo-400 text-white font-extrabold rounded-xl text-sm transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
                >
                  <Copy className="w-5 h-5" />
                  최신 GAS 코드 복사하기
                </button>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-xl text-xs font-mono max-h-44 overflow-y-auto leading-relaxed border border-slate-800 text-slate-300 select-all">
                <pre>{LATEST_GAS_SCRIPT}</pre>
              </div>
            </div>

            <div className="bg-indigo-50/70 p-6 rounded-2xl border-2 border-indigo-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-extrabold text-indigo-950 flex items-center gap-2">
                  <Link className="w-5 h-5 text-indigo-600" />
                  Google Apps Script 웹앱 URL 연동
                </h3>
                <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 연동 설정 상태
                </span>
              </div>
              
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                현재 기본 구글 시트 ID: <code className="bg-white px-2 py-0.5 rounded font-mono font-bold text-indigo-700 border border-slate-200">1K9MGNWEm6VsPUz8xxIUtnFMufqj_YX0WZ1IMUsEvoN8</code>
                <br />
                직접 배포하신 구글 앱스크립트 웹앱 URL(https://script.google.com/macros/s/.../exec)을 아래에 등록하세요.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/.../exec 입력 후 URL 저장 클릭"
                  value={gasUrlInput}
                  onChange={(e) => setGasUrlInput(e.target.value)}
                  className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={saveGasUrl}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors shrink-0 cursor-pointer"
                >
                  URL 저장
                </button>
                {gasUrlInput && (
                  <button
                    onClick={() => {
                      setGasUrlInput('');
                      localStorage.removeItem('gas_web_app_url');
                      toast.success('기본 연동 URL로 초기화되었습니다.');
                      onRefresh();
                    }}
                    className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm rounded-xl transition-colors shrink-0 cursor-pointer"
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-200 space-y-4">
              <h4 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                ⚠️ 구글 앱스크립트 배포 시 주의사항
              </h4>
              <ul className="text-sm font-medium text-slate-600 space-y-3 list-disc pl-5 leading-relaxed">
                <li className="text-indigo-900 font-bold bg-indigo-50 p-3 rounded-xl border border-indigo-200">
                  📌 <b>배포 URL 끝이 <code className="text-emerald-700 font-mono">/exec</code> 인지 확인</b><br />
                  구글 Apps Script 상단의 [배포] &gt; [배포 관리]에서 발급된 웹앱 주소(<code className="bg-white px-1 py-0.5 border rounded text-emerald-700 font-mono">https://script.google.com/macros/s/.../exec</code>)를 입력해야 합니다.
                </li>
                <li>
                  <b>액세스 권한 설정</b>: 배포 설정 시 <i>[다음 사용자 인증 정보로 실행: 나]</i>, <i>[액세스 권한이 있는 사용자: 모든 사용자(Anyone)]</i>로 배포하셔야 로그인 없이도 구글 시트에 안전하게 저장됩니다.
                </li>
              </ul>
            </div>
          </div>
        )}
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                <h4 className="text-xl font-extrabold text-slate-800 flex items-center gap-3">
                  현재 등록된 교직원
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-sm font-bold">{appState.staff.length}명</span>
                </h4>
                {appState.staff.length > 0 && (
                  <button
                    onClick={handleSyncCurrentStaffToSheet}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <UploadCloud className="w-4 h-4" />
                    구글 시트로 이 명렬표 전송하기
                  </button>
                )}
              </div>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                  <span>현재 필수 연수 목록</span>
                  <span className="text-sm bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full">{appState.requiredTrainings.length}개</span>
                </h3>
                {appState.requiredTrainings.length > 0 && (
                  <button
                    onClick={handleSyncCurrentTrainingsToSheet}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <UploadCloud className="w-4 h-4" />
                    구글 시트로 이 연수목록 전송하기
                  </button>
                )}
              </div>
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
