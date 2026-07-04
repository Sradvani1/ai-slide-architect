import React from 'react';
import { GRADE_LEVELS, SUBJECTS } from '@shared/constants';
import type { GallerySort } from '../types';

interface ExploreFiltersProps {
    gradeLevel: string;
    subject: string;
    sort: GallerySort;
    onGradeLevelChange: (value: string) => void;
    onSubjectChange: (value: string) => void;
    onSortChange: (value: GallerySort) => void;
    onClearFilters: () => void;
}

export const ExploreFilters: React.FC<ExploreFiltersProps> = ({
    gradeLevel,
    subject,
    sort,
    onGradeLevelChange,
    onSubjectChange,
    onSortChange,
    onClearFilters,
}) => {
    const hasActiveFilters = Boolean(gradeLevel || subject);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-[120px]">
                    <select
                        value={gradeLevel}
                        onChange={(e) => {
                            onGradeLevelChange(e.target.value);
                            (e.target as HTMLSelectElement).blur();
                        }}
                        className="input-field appearance-none w-full min-w-0"
                        aria-label="Filter by grade level"
                    >
                        <option value="">All grades</option>
                        {GRADE_LEVELS.map((grade) => (
                            <option key={grade} value={grade}>{grade}</option>
                        ))}
                    </select>
                </div>
                <div className="min-w-[180px]">
                    <select
                        value={subject}
                        onChange={(e) => {
                            onSubjectChange(e.target.value);
                            (e.target as HTMLSelectElement).blur();
                        }}
                        className="input-field appearance-none w-full min-w-0"
                        aria-label="Filter by subject"
                    >
                        <option value="">All subjects</option>
                        {SUBJECTS.map((subj) => (
                            <option key={subj} value={subj}>{subj}</option>
                        ))}
                    </select>
                </div>
                <div
                    className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-neutral-bg"
                    role="group"
                    aria-label="Sort decks"
                >
                    <button
                        type="button"
                        onClick={() => onSortChange('recent')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md min-h-[44px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                            sort === 'recent'
                                ? 'bg-surface text-primary-text shadow-sm'
                                : 'text-secondary-text hover:text-primary-text'
                        }`}
                        aria-pressed={sort === 'recent'}
                    >
                        Recent
                    </button>
                    <button
                        type="button"
                        onClick={() => onSortChange('popular')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md min-h-[44px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                            sort === 'popular'
                                ? 'bg-surface text-primary-text shadow-sm'
                                : 'text-secondary-text hover:text-primary-text'
                        }`}
                        aria-pressed={sort === 'popular'}
                    >
                        Popular
                    </button>
                </div>
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onClearFilters}
                        aria-label="Clear grade and subject filters"
                        className="text-sm font-medium text-primary hover:text-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md px-2 py-1.5 min-h-[44px]"
                    >
                        Clear filters
                    </button>
                )}
            </div>
        </div>
    );
};
