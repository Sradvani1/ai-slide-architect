
import React, { useState, useCallback } from 'react';
import { InputForm } from './components/InputForm';
import { SlideDeck } from './components/SlideDeck';
import { generateSlidesFromDocument } from './services/geminiService';
import type { Slide } from './types';

function App() {
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [subject, setSubject] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [numSlides, setNumSlides] = useState<number>(5);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = (files: { name: string; content: string }[]) => {
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const handleGenerateSlides = useCallback(async () => {
    if (!topic || !gradeLevel || !subject) {
      setError("Please provide a topic, grade level, and subject for your presentation.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSlides(null);

    try {
      const sourceMaterial = uploadedFiles.map(f => `File: ${f.name}\n---\n${f.content}\n---`).join('\n\n');
      const generatedSlides = await generateSlidesFromDocument(topic, gradeLevel, subject, sourceMaterial, numSlides, useWebSearch);
      setSlides(generatedSlides);
    } catch (e) {
      console.error(e);
      setError("Failed to generate slides. Please check your input and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [topic, gradeLevel, subject, uploadedFiles, numSlides, useWebSearch]);

  const handleUpdateSlide = (index: number, updatedSlide: Slide) => {
    setSlides(prevSlides => {
      if (!prevSlides) return null;
      const newSlides = [...prevSlides];
      newSlides[index] = updatedSlide;
      return newSlides;
    });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-900 text-slate-200 font-sans">
      <header className="md:hidden flex items-center justify-center p-4 bg-slate-800 border-b border-slate-700 shadow-md">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
          AI Slide Builder
        </h1>
      </header>
      <aside className="w-full md:w-1/3 md:max-w-md lg:max-w-lg p-4 md:p-6 bg-slate-800/50 md:min-h-screen">
        <div className="sticky top-6">
          <InputForm
            topic={topic}
            setTopic={setTopic}
            gradeLevel={gradeLevel}
            setGradeLevel={setGradeLevel}
            subject={subject}
            setSubject={setSubject}
            onFilesSelected={handleFilesSelected}
            numSlides={numSlides}
            setNumSlides={setNumSlides}
            useWebSearch={useWebSearch}
            setUseWebSearch={setUseWebSearch}
            onSubmit={handleGenerateSlides}
            isLoading={isLoading}
          />
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">
        <SlideDeck
          slides={slides}
          isLoading={isLoading}
          error={error}
          onUpdateSlide={handleUpdateSlide}
          gradeLevel={gradeLevel}
          subject={subject}
        />
      </main>
    </div>
  );
}

export default App;
