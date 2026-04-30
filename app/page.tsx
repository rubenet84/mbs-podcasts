'use client';

import { useMemo, useState } from 'react';

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  file: File;
};

type PodcastLine = {
  speaker: string;
  text: string;
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

// Estilos específicos para que al imprimir solo salga el guion
const printStyles = `
  @media print {
    .no-print {
      display: none !important;
    }
    body {
      background: white !important;
    }
    main {
      padding: 0 !important;
      margin: 0 !important;
    }
    .script-container {
      box-shadow: none !important;
      ring: none !important;
      border: none !important;
      width: 100% !important;
      max-width: none !important;
    }
    /* Ajuste para ahorrar tinta y mejorar legibilidad en papel */
    .host-bubble {
      background-color: #f1f5f9 !important; /* slate-100 */
      color: black !important;
      border: 1px solid #cbd5e1 !important;
    }
  }
`;

export default function Home() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingAudio, setIsDownloadingAudio] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<PodcastLine[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addFiles = (incomingFiles: FileList | File[]) => {
    const nextFiles = Array.from(incomingFiles).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      size: file.size,
      file,
    }));

    setFiles((currentFiles) => {
      const seen = new Set(currentFiles.map((f) => f.id));
      const uniqueNewFiles = nextFiles.filter((f) => !seen.has(f.id));
      return [...currentFiles, ...uniqueNewFiles];
    });
  };

  const handleGenerate = async () => {
    if (files.length === 0 || isGenerating) return;

    setIsGenerating(true);
    setErrorMessage(null);
    setGeneratedScript([]);

    try {
      const formData = new FormData();
      files.forEach((f) => {
        formData.append('files', f.file);
      });

      const response = await fetch('/api/generate-podcast', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo generar el podcast.');
      }

      setGeneratedScript(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Error inesperado generando el guion.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAudio = async () => {
    if (generatedScript.length === 0 || isDownloadingAudio) return;

    setIsDownloadingAudio(true);
    try {
      const response = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: generatedScript }),
      });

      if (!response.ok) throw new Error('Error al procesar el audio en el servidor.');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `podcast-audio-${Date.now()}.mp3`;
      document.body.appendChild(link);
      link.click();
      
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Hubo un problema al generar el archivo de audio.");
    } finally {
      setIsDownloadingAudio(false);
    }
  };

  const totalSize = useMemo(
    () => files.reduce((acc, f) => acc + f.size, 0),
    [files],
  );

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <style>{printStyles}</style>

      <section className="mx-auto w-full max-w-3xl space-y-8">
        
        {/* ZONA DE SUBIDA (Oculta al imprimir) */}
        <div className="no-print rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-bold tracking-tight text-indigo-900">Podcast Creator</h1>
          <p className="mt-2 text-slate-600">
            Sube tus documentos para transformarlos en un guion de podcast y descargarlo en MP3.
          </p>

          <label
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`mt-8 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all ${isDragging
                ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/30'
              }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
              <span className="text-xl">📄</span>
            </div>
            <span className="mt-4 text-sm font-semibold">
              {isDragging ? 'Suelta ahora' : 'Arrastra archivos PDF o texto'}
            </span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  addFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
          </label>

          <div className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Archivos ({files.length})
            </h2>
            <ul className="mt-4 space-y-2">
              {files.map((file) => (
                <li key={file.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <span className="truncate text-sm font-medium">{file.name}</span>
                  <button onClick={() => removeFile(file.id)} className="ml-4 text-slate-300 hover:text-red-500">×</button>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || files.length === 0}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-4 text-base font-bold text-white shadow-md transition-all hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isGenerating ? 'Analizando...' : 'Generar Guion de Podcast'}
          </button>
        </div>

        {/* GUION Y AUDIO (El guion es lo único que se imprime) */}
        {generatedScript.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
            
            {/* Panel de Audio (Oculto al imprimir) */}
            <div className="no-print rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-700 p-6 text-white shadow-lg">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">¡Guion listo!</h3>
                  <p className="text-indigo-100 text-sm">Convierte este texto en un audio profesional.</p>
                </div>
                <button
                  onClick={downloadAudio}
                  disabled={isDownloadingAudio}
                  className="flex items-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 disabled:bg-indigo-300 disabled:text-white"
                >
                  {isDownloadingAudio ? 'Procesando...' : '📥 Descargar MP3'}
                </button>
              </div>
            </div>

            {/* Cabecera del Guion (Botón oculto al imprimir) */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-xl font-bold text-slate-800">🎙️ Guion Generado</h3>
              <button
                onClick={() => window.print()}
                className="no-print text-xs font-semibold text-indigo-600 hover:underline"
              >
                🖨️ Imprimir solo diálogo
              </button>
            </div>

            {/* CONTENEDOR DEL DIÁLOGO */}
            <div className="script-container space-y-4 pb-12">
              {generatedScript.map((line, index) => {
                const isHost = line.speaker.toLowerCase().includes('host') ||
                  line.speaker.toLowerCase().includes('presentador');

                return (
                  <div key={index} className={`flex flex-col gap-1.5 ${isHost ? 'items-start' : 'items-end'}`}>
                    <span className="px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {line.speaker}
                    </span>
                    <div className={`max-w-[90%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ring-1 
                      ${isHost
                        ? 'host-bubble rounded-tl-none bg-indigo-600 text-white ring-indigo-500'
                        : 'rounded-tr-none bg-white text-slate-700 ring-slate-200'
                      }`}>
                      {line.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}