import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 PDF uploads
  app.use(express.json({ limit: '50mb' }));

  // Initialize Gemini
  let ai: GoogleGenAI | null = null;
  const getGemini = () => {
    if (!ai) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is missing.');
      }
      ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return ai;
  };

  // Mock DB in memory if GAS_URL is not set
  let mockStaff: any[] = [];
  let mockRequiredTrainings: any[] = [];
  let mockCompletedTrainings: any[] = [];

  // API Route: Process PDF with Gemini
  app.post("/api/gemini", async (req, res) => {
    try {
      const { pdfBase64 } = req.body;
      if (!pdfBase64) {
        return res.status(400).json({ error: "PDF base64 data is required." });
      }

      const aiClient = getGemini();
      
      const response = await aiClient.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64.replace(/^data:application\/pdf;base64,/, ""),
            }
          },
          {
            text: "이수증에서 다음 정보를 추출해줘. 1. 과정명, 2. 성명, 3. 이수시간 (숫자만, 예: 15), 4. 이수년도 (숫자만, 예: 2024). 만약 이수년도가 없으면 최근 날짜를 유추하거나 빈 문자열로 해줘."
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              courseName: { type: Type.STRING, description: "과정명" },
              name: { type: Type.STRING, description: "성명" },
              hours: { type: Type.NUMBER, description: "이수시간 (시간 단위)" },
              year: { type: Type.NUMBER, description: "이수년도" },
            },
            required: ["courseName", "name", "hours", "year"],
          }
        }
      });

      const jsonStr = response.text?.trim() || "{}";
      const result = JSON.parse(jsonStr);
      res.json(result);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "Failed to process PDF" });
    }
  });

  // API Route: Proxy to Google Apps Script (Sheets)
  app.post("/api/sheets", async (req, res) => {
    const { action, payload } = req.body;
    const gasUrl = process.env.GAS_URL;

    if (!gasUrl || gasUrl.trim() === "" || gasUrl.includes("YOUR_")) {
      // Mock mode
      if (action === 'save_staff') {
        mockStaff = payload;
        return res.json({ success: true, message: "Mock: 인적사항 저장 완료" });
      } else if (action === 'save_required_training') {
        mockRequiredTrainings.push(payload);
        return res.json({ success: true, message: "Mock: 필수 연수 등록 완료" });
      } else if (action === 'delete_required_training') {
        mockRequiredTrainings = mockRequiredTrainings.filter(t => t.id !== payload.id);
        return res.json({ success: true, message: "Mock: 필수 연수 삭제 완료" });
      } else if (action === 'save_completion') {
        mockCompletedTrainings.push(payload);
        return res.json({ success: true, message: "Mock: 이수 기록 저장 완료" });
      } else if (action === 'delete_completion') {
        mockCompletedTrainings = mockCompletedTrainings.filter(c => c.id !== payload.id);
        return res.json({ success: true, message: "Mock: 이수 기록 삭제 완료" });
      } else if (action === 'get_all') {
        return res.json({
          staff: mockStaff,
          requiredTrainings: mockRequiredTrainings,
          completedTrainings: mockCompletedTrainings
        });
      }
      return res.status(400).json({ error: "Unknown mock action" });
    }

    // Actual GAS fetch with 60s (1min) timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        redirect: "follow",
        signal: controller.signal,
        body: JSON.stringify({ action, payload }),
      });
      clearTimeout(timeoutId);
      
      const text = await response.text();
      
      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({
            error: "Google Apps Script 웹앱 주소를 찾을 수 없습니다 (404 오류). GAS_URL 주소가 정확한지, URL 끝이 '/exec'로 끝나고 정상 배포되었는지 확인해주세요."
          });
        }
        return res.status(response.status).json({
          error: `Google Apps Script 서버 오류 (${response.status}). 구글 웹앱 배포 상태를 확인해주세요.`
        });
      }

      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
        return res.status(500).json({
          error: "Google Apps Script가 JSON이 아닌 HTML(구글 로그인/오류) 페이지를 반환했습니다. Apps Script 배포 설정에서 '웹앱으로 실행' -> '액세스 권한: 모든 사용자(Anyone)'로 설정되어 있는지 확인하세요."
        });
      }
      
      try {
        const data = JSON.parse(text);
        res.json(data);
      } catch (parseError) {
        console.error("GAS JSON Parse Error:", text.substring(0, 500));
        res.status(500).json({ 
          error: "Google Apps Script 응답 형식 오류: JSON 데이터로 변환할 수 없습니다. gas_script.gs 코드가 최신 상태인지 확인하세요." 
        });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("GAS Fetch Error:", error);
      if (error.name === 'AbortError') {
        return res.status(504).json({ error: "Google Apps Script 응답 시간 초과 (1분/60초). 구글 서비스 응답 시간이 길어졌거나 시트 연동 오류입니다. 잠시 후 다시 시도해 주세요." });
      }
      res.status(500).json({ error: `Google Sheets 통신 중 오류: ${error.message}` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
