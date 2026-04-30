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

export default function Home() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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

  const totalSize = useMemo(
    () => files.reduce((acc, f) => acc + f.size, 0),
    [files],
  );

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-3xl space-y-8">
        {/* Cabecera y Subida */}
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-bold tracking-tight">Podcast Creator</h1>
          <p className="mt-2 text-slate-600">
            Sube tus documentos para transformarlos en un guion de podcast generado por IA.
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
            <span className="mt-1 text-xs text-slate-400">Máximo 10MB por archivo</span>
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

          {/* Lista de Archivos */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Archivos ({files.length})
              </h2>
              {files.length > 0 && (
                <span className="text-xs text-slate-400">Total: {formatBytes(totalSize)}</span>
              )}
            </div>
            <ul className="mt-4 space-y-2">
              {files.length === 0 ? (
                <li className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm text-slate-400 italic">
                  No hay archivos seleccionados.
                </li>
              ) : (
                files.map((file) => (
                  <li
                    key={file.id}
                    className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300"
                  >
                    <div className="flex flex-col truncate">
                      <span className="truncate text-sm font-medium">{file.name}</span>
                      <span className="text-[10px] text-slate-400">{formatBytes(file.size)}</span>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="ml-4 text-slate-300 hover:text-red-500 transition-colors"
                      title="Eliminar archivo"
                    >
                      <span className="text-lg">×</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || files.length === 0}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-4 text-base font-bold text-white shadow-md transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            {isGenerating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Analizando y redactando...
              </>
            ) : (
              'Generar Guion de Podcast'
            )}
          </button>

          {errorMessage && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              <span>⚠️</span> {errorMessage}
            </div>
          )}
        </div>

        {/* Sección de Guion Generado */}
        {generatedScript.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-xl font-bold text-slate-800">🎙️ Guion Generado</h3>
              <button
                onClick={() => window.print()}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Imprimir guion
              </button>
            </div>

            <div className="space-y-4">
              {generatedScript.map((line, index) => {
                const isHost = line.speaker.toLowerCase().includes('host') ||
                  line.speaker.toLowerCase().includes('presentador');

                return (
                  <div
                    key={index}
                    className={`flex flex-col gap-1.5 ${isHost ? 'items-start' : 'items-end'}`}
                  >
                    <span className="px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {line.speaker}
                    </span>
                    <div className={`max-w-[90%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ring-1 ${isHost
                        ? 'rounded-tl-none bg-indigo-600 text-white ring-indigo-500'
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