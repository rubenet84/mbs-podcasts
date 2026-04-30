import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFExtract } from 'pdf.js-extract';

const pdfExtract = new PDFExtract();

const SYSTEM_PROMPT =
  'Eres un guionista de podcasts profesional. Analiza el texto de los documentos proporcionados y crea un diálogo fluido y natural entre dos personas: un Presentador (Host) y un Experto. El diálogo debe ser entretenido y fácil de seguir. Devuelve la respuesta estrictamente como un array de objetos JSON con el formato: [{"speaker": "...", "text": "..."}]. No incluyas explicaciones ni bloques de código fuera del JSON.';

type PodcastLine = {
  speaker: string;
  text: string;
};

/**
 * Extrae texto de un archivo PDF o texto plano.
 * Usa pdf.js-extract para evitar errores de tablas XRef corruptas.
 */
const extractTextFromFile = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    try {
      const data = await pdfExtract.extractBuffer(buffer, {});
      const text = data.pages
        .map(page => page.content.map(item => item.str).join(' '))
        .join('\n');
      
      if (!text.trim()) throw new Error("El PDF no contiene texto legible.");
      return text;
    } catch (error) {
      console.error(`Error de extracción en ${file.name}:`, error);
      // Fallback de lectura bruta (strings básicos)
      return buffer.toString('utf8').replace(/[^\x20-\x7E\n]/g, '');
    }
  }

  return buffer.toString('utf-8');
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: 'Falta la API Key de Google en las variables de entorno.' },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const incomingFiles = formData.getAll('files');
    const files = incomingFiles.filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return Response.json({ error: 'No se han subido archivos.' }, { status: 400 });
    }

    // 1. Extraer texto de todos los archivos
    const extractedTexts = await Promise.all(
      files.map(async (file) => {
        const text = await extractTextFromFile(file);
        return `ARCHIVO: ${file.name}\nCONTENIDO:\n${text}`;
      }),
    );

    const combinedContext = extractedTexts.join('\n\n---\n\n');

    // 2. Configurar IA con sistema de Fallback (Respaldo)
    const genAI = new GoogleGenerativeAI(apiKey);
    let result;

    try {
      // Intento principal con el modelo más avanzado
      const primaryModel = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash', 
        generationConfig: { responseMimeType: "application/json" }
      });
      result = await primaryModel.generateContent([
        SYSTEM_PROMPT,
        `Genera el guion basándote en esto:\n\n${combinedContext}`,
      ]);
    } catch (apiError: any) {
      // Si el 2.5 falla (503 Service Unavailable), usamos el 1.5 que es estable
      console.warn("Modelo 2.5 no disponible, activando respaldo 1.5 Flash...");
      const fallbackModel = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash-latest', 
        generationConfig: { responseMimeType: "application/json" }
      });
      result = await fallbackModel.generateContent([
        SYSTEM_PROMPT,
        `Genera el guion basándote en esto:\n\n${combinedContext}`,
      ]);
    }

    const rawResponse = result.response.text();
    
    // 3. Limpiar y parsear JSON
    const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsedScript = JSON.parse(cleanJson) as PodcastLine[];
      return Response.json(parsedScript);
    } catch (parseError) {
      console.error("Error de formato JSON:", rawResponse);
      return Response.json(
        { error: 'La IA no devolvió un JSON válido.' }, 
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error("ERROR EN LA API:", error);
    return Response.json(
      { error: error.message || 'Error interno del servidor.' },
      { status: 500 },
    );
  }
}