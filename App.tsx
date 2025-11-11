
import React, { useState, useCallback } from 'react';
import { InputForm } from './components/InputForm';
import { SlideDeck } from './components/SlideDeck';
import { generateSlidesFromDocument } from './services/geminiService';
import type { Slide } from './types';

function App() {
  const [sourceText, setSourceText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [numSlides, setNumSlides] = useState<number>(5);
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateSlides = useCallback(async () => {
    if (!instructions) {
      setError("Please provide instructions for creating your presentation.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSlides(null);
    try {
      const generatedSlides = await generateSlidesFromDocument(sourceText, instructions, numSlides);
      setSlides(generatedSlides);
    } catch (e) {
      console.error(e);
      setError("Failed to generate slides. Please check your input and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [sourceText, instructions, numSlides]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-900 text-slate-200 font-sans">
      <header className="md:hidden flex items-center justify-center p-4 bg-slate-800 border-b border-slate-700 shadow-md">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
          Teacher Slide Builder
        </h1>
      </header>
      <aside className="w-full md:w-1/3 md:max-w-md lg:max-w-lg p-4 md:p-6 bg-slate-800/50 md:min-h-screen">
         <div className="sticky top-6">
             <InputForm
                sourceText={sourceText}
                setSourceText={setSourceText}
                instructions={instructions}
                setInstructions={setInstructions}
                numSlides={numSlides}
                setNumSlides={setNumSlides}
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
        />
      </main>
    </div>
  );
}

export default App;
