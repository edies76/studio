import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // --- Start of Security and Environment Check ---
  if (!process.env.GEMINI_API_KEY) {
    console.error("CRITICAL: GEMINI_API_KEY is not defined in .env.local. The server cannot connect to Google AI.");
    return NextResponse.json(
      { error: "Server configuration error: Missing API key." },
      { status: 500 }
    );
  }
  // --- End of Security and Environment Check ---

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Function to convert a file buffer to a Gemini-compatible format
  async function fileToGenerativePart(file: File) {
    const base64EncodedData = Buffer.from(await file.arrayBuffer()).toString("base64");
    return {
      inlineData: {
        data: base64EncodedData,
        mimeType: file.type,
      },
    };
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
    const prompt = "Describe this image in detail. What is it? What is happening? What text is visible? Provide a comprehensive description that can be used as context for a document.";
    const imagePart = await fileToGenerativePart(file);

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ description: text });

  } catch (error) {
    console.error("Error analyzing image:", error);
    return NextResponse.json(
      { error: "Failed to analyze image. Check the server logs for details." },
      { status: 500 }
    );
  }
}
