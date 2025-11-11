
import React from 'react';
import { GenerateIcon } from './icons';

interface InputFormProps {
  sourceText: string;
  setSourceText: (text: string) => void;
  instructions: string;
  setInstructions: (text: string) => void;
  numSlides: number;
  setNumSlides: (num: number) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export const InputForm: React.FC<InputFormProps> = ({
  sourceText,
  setSourceText,
  instructions,
  setInstructions,
  numSlides,
  setNumSlides,
  onSubmit,
  isLoading,
}) => {
  return (
    <div className="flex flex-col space-y-6 h-full">
      <div className="hidden md:block">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500 mb-2">
          Teacher Slide Builder
        </h1>
        <p className="text-slate-400">Create classroom presentations from your content.</p>
      </div>

      <div>
        <label htmlFor="sourceText" className="block text-sm font-medium text-slate-300 mb-2">
          Source Document
        </label>
        <textarea
          id="sourceText"
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="Paste your long document, article, or notes here..."
          className="w-full h-40 p-3 bg-slate-700 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-150 resize-y"
          disabled={isLoading}
        />
      </div>
      <div>
        <label htmlFor="instructions" className="block text-sm font-medium text-slate-300 mb-2">
          Instructions
        </label>
        <textarea
          id="instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g., Create a 5-slide presentation for 10th graders about the causes of WWI. Focus on..."
          className="w-full h-32 p-3 bg-slate-700 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-150 resize-y"
          disabled={isLoading}
        />
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
          disabled={isLoading || !sourceText || !instructions}
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
    </div>
  );
};
