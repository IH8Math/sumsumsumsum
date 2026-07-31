import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64 } = await req.json();
    if (!pdfBase64) {
      return NextResponse.json({ error: "PDF base64 data is required." }, { status: 400 });
    }

    const response = await ai.models.generateContent({
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
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process PDF" }, { status: 500 });
  }
}
