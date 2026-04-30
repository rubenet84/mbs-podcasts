import { GoogleGenerativeAI } from '@google/generative-ai';
import pdfParse from 'pdf-parse';

const SYSTEM_PROMPT =
  'Eres un guionista de podcasts profesional. Analiza el texto de los documentos proporcionados y crea un diálogo fluido y natural entre dos personas: un Presentador (Host) y un Experto. El diálogo debe ser entretenido y fácil de seguir. Devuelve la respuesta estrictamente como un array de objetos JSON con el formato: [{"speaker": "...", "text": "..."}]';

type PodcastLine = {
  speaker: string;
  text: string;
};

const extractTextFromFile = async (file: File) => {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }

  return buffer.toString('utf-8');
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: 'Falta configurar GOOGLE_GENERATIVE_AI_API_KEY.' },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const incomingFiles = formData.getAll('files');
    const files = incomingFiles.filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return Response.json({ error: 'No se recibieron archivos.' }, { status: 400 });
    }

    const extractedTexts = await Promise.all(
      files.map(async (file) => {
        const text = await extractTextFromFile(file);
        return `Documento: ${file.name}\n\n${text}`;
      }),
    );

    const combinedText = extractedTexts.join('\n\n---\n\n');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      SYSTEM_PROMPT,
      `Contenido de documentos:\n\n${combinedText}`,
    ]);

    const rawText = result.response.text();
    const parsed = JSON.parse(rawText) as PodcastLine[];

    return Response.json(parsed);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Ocurrió un error generando el guion del podcast.',
      },
      { status: 500 },
    );
  }
}
