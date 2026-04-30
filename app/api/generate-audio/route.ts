import { NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// IDs de tus voces verificados
const VOICE_ID_HOST = 'onwK4e9ZLuTAKqWW03F9';
const VOICE_ID_EXPERT = 'XrExE9yKIg1WjnnlVkGX';

export async function POST(request: Request) {
    try {
        const { script } = await request.json();

        if (!ELEVENLABS_API_KEY) {
            return NextResponse.json(
                { error: 'Falta la API Key de ElevenLabs en las variables de entorno.' },
                { status: 500 }
            );
        }

        if (!script || !Array.isArray(script)) {
            return NextResponse.json(
                { error: 'El formato del guion no es válido.' },
                { status: 400 }
            );
        }

        const audioSegments: Buffer[] = [];

        // Procesamos cada línea una por una para evitar errores de Rate Limit (429/500)
        for (const [index, line] of script.entries()) {
            const isHost = line.speaker.toLowerCase().includes('host') ||
                line.speaker.toLowerCase().includes('presentador');

            const voiceId = isHost ? VOICE_ID_HOST : VOICE_ID_EXPERT;

            console.log(`[${index + 1}/${script.length}] Procesando voz de ${line.speaker}...`);

            const response = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'xi-api-key': ELEVENLABS_API_KEY,
                    },
                    body: JSON.stringify({
                        text: line.text,
                        model_id: 'eleven_multilingual_v2',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75,
                        },
                    }),
                }
            );

            if (!response.ok) {
                const errorDetail = await response.text();
                console.error(`Error en ElevenLabs (Línea ${index + 1} - ${line.speaker}):`, errorDetail);
                throw new Error(`Error en la línea de ${line.speaker}: ${errorDetail}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            audioSegments.push(Buffer.from(arrayBuffer));

            // Pausa técnica de 250ms para asegurar estabilidad entre peticiones
            if (index < script.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 250));
            }
        }

        // Concatenamos todos los fragmentos en un solo archivo MP3
        const finalAudioBuffer = Buffer.concat(audioSegments);

        console.log('Audio generado con éxito. Enviando al cliente...');

        return new Response(finalAudioBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Disposition': `attachment; filename="podcast-padel-${Date.now()}.mp3"`,
            },
        });

    } catch (error: any) {
        console.error('Error total en la generación de audio:', error.message);
        return NextResponse.json(
            { error: error.message || 'Error interno al generar el audio.' },
            { status: 500 }
        );
    }
}