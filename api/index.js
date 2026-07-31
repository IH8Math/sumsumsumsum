import express from "express";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
app.use(express.json({ limit: '50mb' }));

// Initialize Gemini
let ai = null;
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

let mockStaff = [];
let mockRequiredTrainings = [];
let mockCompletedTrainings = [];

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
  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: error.message || "Failed to process PDF" });
  }
});

app.post("/api/sheets", async (req, res) => {
  const { action, payload } = req.body;
  const gasUrl = process.env.GAS_URL;

  if (!gasUrl || gasUrl.trim() === "" || gasUrl.includes("YOUR_")) {
    if (action === 'save_staff') {
      mockStaff = payload;
      return res.json({ success: true, message: "Mock: 인적사항 저장 완료" });
    } else if (action === 'save_required_training') {
      mockRequiredTrainings.push(payload);
      return res.json({ success: true, message: "Mock: 필수 연수 등록 완료" });
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

  try {
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, payload }),
    });
    
    const text = await response.text();
    
    if (!response.ok) {
      throw new Error(`GAS Server Error (${response.status}): ${text.substring(0, 100)}`);
    }
    
    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch (parseError) {
      console.error("GAS JSON Parse Error:", text.substring(0, 500));
      res.status(500).json({ error: "Google Apps Script 설정 오류: Web App이 JSON이 아닌 HTML을 반환했습니다.", details: text.substring(0, 100) });
    }
  } catch (error) {
    console.error("GAS Fetch Error:", error);
    res.status(500).json({ error: `Google Sheets 통신 중 오류: ${error.message}` });
  }
});

export default app;
