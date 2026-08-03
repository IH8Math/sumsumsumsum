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

    // 구글 시트 ID (공유해주신 시트 ID)
    const SPREADSHEET_ID = "1K9MGNWEm6VsPUz8xxIUtnFMufqj_YX0WZ1IMUsEvoN8";
    let ss;
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch(err) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    
    let result = { success: false };

    // 헬퍼: 여러 시트 이름 중 있는 시트를 가져오거나 없으면 첫번째 이름으로 생성
    const getOrCreateSheet = (names) => {
      for (let name of names) {
        let sheet = ss.getSheetByName(name);
        if (sheet) return sheet;
      }
      return ss.insertSheet(names[0]);
    };

    // 헬퍼: 여러 시트 이름들에서 데이터 통합 읽기
    const getMultiSheetData = (names) => {
      let allRows = [];
      for (let name of names) {
        const sheet = ss.getSheetByName(name);
        if (sheet && sheet.getLastRow() > 1) {
          const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
          allRows = allRows.concat(data);
        }
      }
      return allRows;
    };
    
    if (action === 'save_staff') {
      let sheet = getOrCreateSheet(["교직원", "인적사항"]);
      sheet.clear();
      sheet.appendRow(["ID", "성명", "소속", "직위"]);
      
      const rows = payload.map(staff => [staff.id, staff.name, staff.department, staff.position]);
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 4).setValues(rows);
      }
      result = { success: true, message: "인적사항 저장 완료" };
      
    } else if (action === 'save_required_training') {
      let sheet = getOrCreateSheet(["필수연수", "필수연수목록"]);
      if (sheet.getLastRow() === 0) sheet.appendRow(["ID", "연수명", "주관부서", "이수기한", "담당자"]);
      
      sheet.appendRow([payload.id, payload.courseName, payload.department, payload.deadline, payload.managerName || ""]);
      result = { success: true, message: "필수연수 저장 완료" };
      
    } else if (action === 'save_completion') {
      let sheet = getOrCreateSheet(["이수기록", "이수내역"]);
      if (sheet.getLastRow() === 0) sheet.appendRow(["ID", "직원명", "연수명", "이수시간", "연도", "날짜", "PDF_링크"]);
      
      sheet.appendRow([payload.id, payload.staffName, payload.courseName, payload.hours, payload.year, payload.date, ""]);
      result = { success: true, message: "이수기록 저장 완료" };
      
    } else if (action === 'get_all' || action === 'get_data') {
      const staffData = getMultiSheetData(["교직원", "인적사항"]).map(row => ({
        id: row[0], name: row[1], department: row[2], position: row[3]
      }));
      
      const trainingData = getMultiSheetData(["필수연수", "필수연수목록"]).map(row => ({
        id: row[0], courseName: row[1], department: row[2], deadline: row[3], managerName: row[4]
      }));
      
      const completionData = getMultiSheetData(["이수기록", "이수내역"]).map(row => ({
        id: row[0], staffName: row[1], courseName: row[2], hours: row[3], year: row[4], date: row[5]
      }));
      
      result = {
        success: true,
        staff: staffData,
        requiredTrainings: trainingData,
        completedTrainings: completionData
      };

    } else if (action === 'delete_required_training') {
      let deletedCount = 0;
      const targetSheets = ["필수연수", "필수연수목록"];
      for (let name of targetSheets) {
        let sheet = ss.getSheetByName(name);
        if (sheet && sheet.getLastRow() > 1) {
          const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
          for (let i = data.length - 1; i >= 0; i--) {
            if (String(data[i][0]) === String(payload.id) || (payload.courseName && String(data[i][1]).trim() === String(payload.courseName).trim())) {
              sheet.deleteRow(i + 2);
              deletedCount++;
            }
          }
        }
      }
      result = { success: true, message: `필수 연수 삭제 완료 (${deletedCount}건)` };

    } else if (action === 'delete_completion') {
      let deletedCount = 0;
      const targetSheets = ["이수기록", "이수내역"];
      for (let name of targetSheets) {
        let sheet = ss.getSheetByName(name);
        if (sheet && sheet.getLastRow() > 1) {
          const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
          for (let i = data.length - 1; i >= 0; i--) {
            const isIdMatch = String(data[i][0]) === String(payload.id);
            const targetName = payload.name || payload.staffName;
            const isNameCourseMatch = targetName && payload.courseName && 
              String(data[i][1]).trim() === String(targetName).trim() && 
              String(data[i][2]).trim() === String(payload.courseName).trim();
              
            if (isIdMatch || isNameCourseMatch) {
              sheet.deleteRow(i + 2);
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
