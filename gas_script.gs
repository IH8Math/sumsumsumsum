function doGet(e) {
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
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch(err) {}
    
    // 만약 독립형 Apps Script로 배포된 경우 아래 SPREADSHEET_ID에 본인의 구글 시트 ID를 입력해 사용합니다.
    if (!ss) {
      const SPREADSHEET_ID = ""; // 예: "1abcXYZ..." (구글 시트 주소 /d/ 와 /edit 사이 문자열)
      if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
        try {
          ss = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
        } catch(err) {}
      }
    }

    if (!ss) {
      return ContentService.createTextOutput(JSON.stringify({ 
        error: "연결된 구글 시트를 찾을 수 없습니다. [확인 필요]: 구글 시트 상단 [확장 프로그램] > [Apps Script] 메뉴에서 이 코드를 작성하여 배포해 주세요! (또는 script.google.com 독립 스크립트 이용 시 코드 상단 SPREADSHEET_ID에 구글 시트 ID를 적어주세요)" 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 문자열 공백/대소문자 정규화 함수
    const norm = (str) => String(str || '').replace(/\s+/g, '').toLowerCase();

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

    } else if (action === 'save_all_required_trainings') {
      let sheet = getTrainingSheet();
      sheet.clear();
      sheet.appendRow(["ID", "연수명", "주관부서", "이수기한", "담당자"]);
      const rows = (payload || []).map(t => [t.id, t.courseName, t.department, t.deadline, t.managerName || ""]);
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 5).setValues(rows);
      }
      result = { success: true, message: "필수연수 목록 전체 저장 완료" };

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
          id: String(row[0] || `staff_${idx}`).trim(),
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

          const rowId = (idIdx !== -1 && r[idIdx] && String(r[idIdx]).trim() !== '') ? String(r[idIdx]).trim() : `train_${i}`;
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
          id: String(row[0] || `comp_${idx}`).trim(),
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
      result = { success: true, message: `필수 연수 삭제 완료 (${deletedCount}건)` };

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
      result = { success: true, message: `이수 기록 삭제 완료 (${deletedCount}건)` };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message, stack: error.stack }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
