import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_API_KEY is not configured for image analysis.');
    return NextResponse.json({ error: 'Server configuration error: Missing API key.' }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);

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

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    });
    const prompt = 'Describe this image in detail. What is it? What is happening? What text is visible? Provide a comprehensive description that can be used as context for a document.';
    const imagePart = await fileToGenerativePart(file);

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ description: text });
  } catch (error) {
    console.error('Error analyzing image:', error);
    return NextResponse.json(
      { error: 'Failed to analyze image. Check the server logs for details.' },
      { status: 500 },
    );
  }
}
