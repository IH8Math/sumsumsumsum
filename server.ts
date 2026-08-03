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

    // Actual GAS fetch with 15s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

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
        throw new Error(`GAS Server Error (${response.status}): ${text.substring(0, 100)}`);
      }
      
      try {
        const data = JSON.parse(text);
        res.json(data);
      } catch (parseError) {
        console.error("GAS JSON Parse Error:", text.substring(0, 500));
        res.status(500).json({ error: "Google Apps Script 설정 오류: Web App이 JSON이 아닌 HTML을 반환했습니다. 앱스스크립트 새 버전 배포 시 '액세스 권한: 모든 사용자(Anyone)'로 설정되어 있는지 확인하세요.", details: text.substring(0, 100) });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("GAS Fetch Error:", error);
      if (error.name === 'AbortError') {
        return res.status(504).json({ error: "Google Apps Script 응답 시간 초과 (15초). 구글 앱스 스크립트 실행 시간이 길어지고 있습니다." });
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
