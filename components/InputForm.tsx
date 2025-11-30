import React, { useState, useEffect } from 'react';
import { GenerateIcon } from './icons';
import { FileUploader } from './FileUploader';

interface InputFormProps {
  topic: string;
  setTopic: (text: string) => void;
  gradeLevel: string;
  setGradeLevel: (text: string) => void;
  subject: string;
  setSubject: (text: string) => void;
  onFilesSelected: (files: { name: string; content: string; size: number }[]) => void;
  uploadedFiles: { name: string; content: string; size: number }[];
  onRemoveFile: (index: number) => void;
  numSlides: number;
  setNumSlides: (num: number) => void;
  useWebSearch: boolean;
  setUseWebSearch: (use: boolean) => void;
  onSubmit: () => void;
  isLoading: boolean;
  creativityLevel: number;
  setCreativityLevel: (level: number) => void;
}

const PLACEHOLDER_PAIRS = [
  { topic: "The process of photosynthesis", gradeLevel: "9th Grade", subject: "Biology" },
  { topic: "Causes of the American Civil War", gradeLevel: "8th Grade", subject: "History" },
  { topic: "Themes in 'To Kill a Mockingbird'", gradeLevel: "10th Grade", subject: "English" },
  { topic: "Properties of chemical bonds", gradeLevel: "11th Grade", subject: "Chemistry" },
  { topic: "Concept of linear equations", gradeLevel: "7th Grade", subject: "Math" },
  { topic: "Impact of climate change", gradeLevel: "12th Grade", subject: "Science" },
  { topic: "Principles of supply and demand", gradeLevel: "12th Grade", subject: "Economics" },
  { topic: "Structure of the human heart", gradeLevel: "7th Grade", subject: "Science" },
  { topic: "Renaissance art techniques", gradeLevel: "9th Grade", subject: "Art" },
  { topic: "Laws of motion", gradeLevel: "8th Grade", subject: "Physics" }
];

export const InputForm: React.FC<InputFormProps> = ({
  topic,
  setTopic,
  gradeLevel,
  setGradeLevel,
  subject,
  setSubject,
  onFilesSelected,
  uploadedFiles,
  onRemoveFile,
  numSlides,
  setNumSlides,
  useWebSearch,
  setUseWebSearch,
  onSubmit,
  isLoading,
  creativityLevel,
  setCreativityLevel,
}) => {
  const [placeholders, setPlaceholders] = useState(PLACEHOLDER_PAIRS[0]);

  useEffect(() => {
    setPlaceholders(PLACEHOLDER_PAIRS[Math.floor(Math.random() * PLACEHOLDER_PAIRS.length)]);
  }, []);

  return (
    <div className="flex flex-col space-y-6 h-full">
      <div className="hidden md:block">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500 mb-2">
          AI Slide Builder
        </h1>
        <p className="text-slate-400">Create a presentation on any topic</p>
      </div>

      <div>
        <label htmlFor="topic" className="block text-sm font-medium text-slate-300 mb-2">
          Topic
        </label>
        <input
          type="text"
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={`e.g., ${placeholders.topic}`}
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-150"
          disabled={isLoading}
        />
      </div>



      <div>
        <label htmlFor="gradeLevel" className="block text-sm font-medium text-slate-300 mb-2">
          Grade Level
        </label>
        <input
          type="text"
          id="gradeLevel"
          value={gradeLevel}
          onChange={(e) => setGradeLevel(e.target.value)}
          placeholder={`e.g., ${placeholders.gradeLevel}`}
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-150"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-slate-300 mb-2">
          Subject
        </label>
        <input
          type="text"
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={`e.g., ${placeholders.subject}`}
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-150"
          disabled={isLoading}
        />
      </div>

      <FileUploader
        onFilesSelected={onFilesSelected}
        uploadedFiles={uploadedFiles}
        onRemoveFile={onRemoveFile}
        isLoading={isLoading}
      />

      <div className="flex items-center justify-between bg-slate-700/50 p-3 rounded-md border border-slate-600/50">
        <div className="flex flex-col">
          <label htmlFor="webSearch" className="font-medium text-slate-200 cursor-pointer" onClick={() => setUseWebSearch(!useWebSearch)}>Enable Web Search</label>
          <p className="text-slate-400 text-xs">Ground content in real-time Google Search results</p>
        </div>
        <button
          id="webSearch"
          type="button"
          role="switch"
          aria-checked={useWebSearch}
          onClick={() => setUseWebSearch(!useWebSearch)}
          disabled={isLoading}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${useWebSearch ? 'bg-sky-600' : 'bg-slate-600'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useWebSearch ? 'translate-x-5' : 'translate-x-0'
              }`}
          />
        </button>
      </div>

      <div className="flex flex-col space-y-2">
        <label className="block text-sm font-medium text-slate-300">
          Creativity Level
        </label>
        <div className="flex items-center justify-between bg-slate-700/50 p-3 rounded-md border border-slate-600/50">
          <div className="flex flex-col w-full">
            <input
              type="range"
              min="0.5"
              max="0.9"
              step="0.2"
              value={creativityLevel}
              onChange={(e) => setCreativityLevel(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-sky-500"
              disabled={isLoading}
            />
            <div className="flex justify-between text-xs text-slate-400 mt-2">
              <span className={creativityLevel === 0.5 ? "text-sky-400 font-bold" : ""}>Low (Precise)</span>
              <span className={creativityLevel === 0.7 ? "text-sky-400 font-bold" : ""}>Medium (Balanced)</span>
              <span className={creativityLevel === 0.9 ? "text-sky-400 font-bold" : ""}>High (Creative)</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="numSlides" className="block text-sm font-medium text-slate-300 mb-2">
          Number of Slides
        </label>
        <input
          type="number"
          id="numSlides"
          value={numSlides}
          onChange={(e) => setNumSlides(Math.max(1, parseInt(e.target.value, 10)))}
          min="1"
          max="20"
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-150"
          disabled={isLoading}
        />
      </div>
      <div className="pt-2">
        <button
          onClick={onSubmit}
          disabled={isLoading || !topic || !gradeLevel || !subject}
          className="w-full flex items-center justify-center py-3 px-4 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-md shadow-lg transition-transform transform hover:scale-105 duration-300"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </>
          ) : (
            <>
              <GenerateIcon className="mr-2" />
              Generate Slides
            </>
          )}
        </button>
      </div>
    </div >
  );
};
