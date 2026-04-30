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
      const seen = new Set(currentFiles.map((file) => file.id));
      const uniqueNewFiles = nextFiles.filter((file) => !seen.has(file.id));
      return [...currentFiles, ...uniqueNewFiles];
    });
  };

  const handleGenerate = async () => {
    if (files.length === 0 || isGenerating) return;

    setIsGenerating(true);
    setGeneratedScript([]);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file.file);
      });

      const response = await fetch('/api/generate-podcast', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('No se pudo generar el podcast.');
      }

      const data = (await response.json()) as PodcastLine[];
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
    () => files.reduce((acc, file) => acc + file.size, 0),
    [files],
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <section className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="mb-2 text-3xl font-bold">Subir archivos</h1>
        <p className="mb-6 text-sm text-slate-600">
          Arrastra y suelta archivos o selecciónalos desde tu dispositivo.
        </p>

        <label
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            addFiles(event.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/60'
          }`}
        >
          <span className="text-base font-medium">
            {isDragging
              ? 'Suelta los archivos aquí'
              : 'Arrastra y suelta archivos aquí'}
          </span>
          <span className="mt-2 text-sm text-slate-500">o haz clic para seleccionarlos</span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) {
                addFiles(event.target.files);
                event.target.value = '';
              }
            }}
          />
        </label>

        <div className="mt-8">
          <h2 className="text-lg font-semibold">Archivos cargados ({files.length})</h2>
          <ul className="mt-3 space-y-2">
            {files.length === 0 ? (
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Todavía no has subido archivos.
              </li>
            ) : (
              files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
                >
                  <span className="truncate pr-4 text-sm font-medium">{file.name}</span>
                  <span className="text-sm text-slate-500">{formatBytes(file.size)}</span>
                </li>
              ))
            )}
          </ul>
          <p className="mt-3 text-sm text-slate-600">Tamaño total: {formatBytes(totalSize)}</p>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || files.length === 0}
          className="mt-8 w-full rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {isGenerating ? 'Generando...' : 'Generar Podcast'}
        </button>

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {generatedScript.length > 0 ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-base font-semibold">Guion generado</h3>
            <ul className="mt-3 space-y-3">
              {generatedScript.map((line, index) => (
                <li key={`${line.speaker}-${index}`} className="text-sm">
                  <span className="font-semibold">{line.speaker}:</span> {line.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}
