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
  { topic: "The process of photosynthesis", gradeLevel: "9th Grade", subject: "Science" },
  { topic: "Causes of the American Civil War", gradeLevel: "8th Grade", subject: "Social Studies" },
  { topic: "Themes in 'To Kill a Mockingbird'", gradeLevel: "10th Grade", subject: "Language Arts" },
  { topic: "Properties of chemical bonds", gradeLevel: "11th Grade", subject: "Science" },
  { topic: "Concept of linear equations", gradeLevel: "7th Grade", subject: "Math" },
  { topic: "Impact of climate change", gradeLevel: "12th Grade", subject: "Science" },
  { topic: "Principles of supply and demand", gradeLevel: "12th Grade", subject: "Social Studies" },
  { topic: "Structure of the human heart", gradeLevel: "7th Grade", subject: "Science" },
  { topic: "Renaissance art techniques", gradeLevel: "9th Grade", subject: "Arts" },
  { topic: "Laws of motion", gradeLevel: "8th Grade", subject: "Science" }
];

const GRADE_LEVELS = [
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
  "11th",
  "12th"
];

const SUBJECTS = [
  "Language Arts",
  "Math",
  "Science",
  "Social Studies",
  "World Languages",
  "Arts",
  "Electives"
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
    <div className="flex flex-col space-y-6">

      <div className="space-y-4">
        <div>
          <label htmlFor="topic" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Topic
          </label>
          <input
            type="text"
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={`e.g., ${placeholders.topic}`}
            className="input-field"
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="gradeLevel" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Grade
            </label>
            <select
              id="gradeLevel"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              className="input-field appearance-none"
              disabled={isLoading}
            >
              <option value="" disabled>Select Grade</option>
              {GRADE_LEVELS.map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="subject" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Subject
            </label>
            <select
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input-field appearance-none"
              disabled={isLoading}
            >
              <option value="" disabled>Select Subject</option>
              {SUBJECTS.map((subj) => (
                <option key={subj} value={subj}>{subj}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 pt-4">
        <FileUploader
          onFilesSelected={onFilesSelected}
          uploadedFiles={uploadedFiles}
          onRemoveFile={onRemoveFile}
          isLoading={isLoading}
        />
      </div>

      <div className="border-t border-white/5 pt-4 space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-bg border border-border-light hover:border-primary/20 transition-colors">
          <div className="flex flex-col">
            <label htmlFor="webSearch" className="font-medium text-primary-text cursor-pointer text-sm" onClick={() => setUseWebSearch(!useWebSearch)}>Web Search Grounding</label>
            <p className="text-secondary-text text-xs">Improve accuracy with real-time results</p>
          </div>
          <button
            id="webSearch"
            type="button"
            role="switch"
            aria-checked={useWebSearch}
            onClick={() => setUseWebSearch(!useWebSearch)}
            disabled={isLoading}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface ${useWebSearch ? 'bg-primary' : 'bg-border-light'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useWebSearch ? 'translate-x-4' : 'translate-x-0'
                }`}
            />
          </button>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Creativity
            </label>
          </div>
          <input
            type="range"
            min="0.5"
            max="0.9"
            step="0.1"
            value={creativityLevel}
            onChange={(e) => setCreativityLevel(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-sky-500"
            disabled={isLoading}
          />
          <div className="flex justify-between text-xs text-slate-400 mt-2 px-1">
            <span className={creativityLevel === 0.5 ? "text-sky-400 font-bold" : ""}>Lower</span>
            <span className={creativityLevel === 0.7 ? "text-sky-400 font-bold" : ""}>Balanced</span>
            <span className={creativityLevel === 0.9 ? "text-sky-400 font-bold" : ""}>Higher</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="numSlides" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Length
            </label>
            <span className="text-xs text-secondary-text bg-white px-2 py-0.5 rounded border border-border-light">{numSlides} Slides</span>
          </div>
          <input
            type="range"
            id="numSlides"
            value={numSlides}
            onChange={(e) => setNumSlides(Math.max(1, parseInt(e.target.value, 10)))}
            min="0"
            max="20"
            className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-sky-500"
            disabled={isLoading}
          />
          <div className="relative h-4 mt-2 text-xs text-slate-400">
            {[1, 5, 10, 15, 20].map((val) => (
              <span
                key={val}
                className={`absolute transform -translate-x-1/2 ${numSlides === val ? "text-sky-400 font-bold" : ""}`}
                style={{ left: `calc(${(val / 20) * 100}% + ${8 - (val / 20) * 16}px)` }}
              >
                {val}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={onSubmit}
          disabled={isLoading || !topic || !gradeLevel || !subject}
          className="btn-primary w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
              Generate Deck
            </>
          )}
        </button>
      </div>
    </div >
  );
};
