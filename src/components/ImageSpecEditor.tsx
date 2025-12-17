import React, { useState } from 'react';
import { ImageSpec, ImageLayout, Viewpoint, Whitespace } from '../types';

interface ImageSpecEditorProps {
    spec: ImageSpec;
    gradeLevel?: string;
    subject?: string;
    onSave: (updatedSpec: ImageSpec) => void;
    onCancel: () => void;
}

const LAYOUT_OPTIONS: ImageLayout[] = [
    'single-focal-subject-centered',
    'balanced-pair',
    'simple-sequence-2-panel',
    'comparison-split-screen',
    'diagram-with-flow',
];

const VIEWPOINT_OPTIONS: Viewpoint[] = [
    'front',
    'three-quarter',
    'side',
    'overhead',
    'child-eye-level',
    'side-profile',
    'isometric-3d-cutaway',
];

const WHITESPACE_OPTIONS: Whitespace[] = ['generous', 'moderate'];

type ArrayField = 'subjects' | 'actions' | 'mustInclude' | 'avoid' | 'colors' | 'negativePrompt' | 'allowedLabels';

export const ImageSpecEditor: React.FC<ImageSpecEditorProps> = ({
    spec,
    gradeLevel,
    subject,
    onSave,
    onCancel,
}) => {
    // Optimized Deep Clone
    const [editedSpec, setEditedSpec] = useState<ImageSpec>(() => {
        if (typeof structuredClone !== 'undefined') {
            return structuredClone(spec);
        }
        return JSON.parse(JSON.stringify(spec));
    });

    const handleChange = (field: keyof ImageSpec, value: any) => {
        setEditedSpec((prev) => ({ ...prev, [field]: value }));
    };

    const handleCompositionChange = (field: keyof ImageSpec['composition'], value: any) => {
        setEditedSpec((prev) => ({
            ...prev,
            composition: { ...prev.composition, [field]: value },
        }));
    };

    const handleArrayChange = (field: ArrayField, index: number, value: string) => {
        // No runtime check needed - TypeScript ensures type safety via ArrayField
        const array = (editedSpec[field] as string[]) || [];
        const newArray = [...array];
        newArray[index] = value;
        setEditedSpec((prev) => ({ ...prev, [field]: newArray }));
    };

    const addArrayItem = (field: ArrayField) => {
        const array = (editedSpec[field] as string[]) || [];
        setEditedSpec((prev) => ({ ...prev, [field]: [...array, ''] }));
    };

    const removeArrayItem = (field: ArrayField, index: number) => {
        const array = (editedSpec[field] as string[]) || [];
        setEditedSpec((prev) => ({ ...prev, [field]: array.filter((_, i) => i !== index) }));
    };

    const renderArrayInput = (field: ArrayField, label: string, minItems: number = 0) => {
        const items = (editedSpec[field] as string[]) || [];

        return (
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label} <span className="text-xs text-gray-400 font-normal ml-1">(Min: {minItems})</span>
                </label>
                {items.map((item, index) => (
                    <div key={index} className="flex mb-2">
                        <input
                            type="text"
                            value={item}
                            onChange={(e) => handleArrayChange(field, index, e.target.value)}
                            className="flex-1 p-2 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter item..."
                        />
                        <button
                            onClick={() => removeArrayItem(field, index)}
                            disabled={items.length <= minItems}
                            className={`ml-2 font-bold px-2 ${items.length <= minItems
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-red-500 hover:text-red-700'
                                }`}
                            title={items.length <= minItems ? `Minimum ${minItems} items required` : "Remove item"}
                        >
                            ×
                        </button>
                    </div>
                ))}
                <button
                    onClick={() => addArrayItem(field)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                    + Add {label}
                </button>
                {items.length < minItems && (
                    <p className="text-xs text-red-500 mt-1">Please add at least {minItems} items.</p>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 max-w-2xl w-full mx-auto my-4">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Edit Image Specification</h3>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                {/* Core Concept */}
                <section>
                    <h4 className="text-md uppercase tracking-wide text-gray-500 font-semibold mb-3 border-b pb-1">Core Concept</h4>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Primary Focal Point</label>
                        <input
                            type="text"
                            value={editedSpec.primaryFocal}
                            onChange={(e) => handleChange('primaryFocal', e.target.value)}
                            className="w-full p-2 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Conceptual Purpose</label>
                        <textarea
                            value={editedSpec.conceptualPurpose}
                            onChange={(e) => handleChange('conceptualPurpose', e.target.value)}
                            className="w-full p-2 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            rows={2}
                        />
                    </div>
                </section>

                {/* Elements */}
                <section>
                    <h4 className="text-md uppercase tracking-wide text-gray-500 font-semibold mb-3 border-b pb-1">Elements</h4>
                    {renderArrayInput('subjects', 'Subjects', 2)}
                    {renderArrayInput('actions', 'Actions')}
                    {renderArrayInput('mustInclude', 'Must Include', 2)}
                    {renderArrayInput('avoid', 'Elements to Avoid', 2)}
                </section>

                {/* Composition */}
                <section>
                    <h4 className="text-md uppercase tracking-wide text-gray-500 font-semibold mb-3 border-b pb-1">Composition</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Layout</label>
                            <select
                                value={editedSpec.composition.layout}
                                onChange={(e) => handleCompositionChange('layout', e.target.value)}
                                className="w-full p-2 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            >
                                {LAYOUT_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt.replace(/-/g, ' ')}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Viewpoint</label>
                            <select
                                value={editedSpec.composition.viewpoint}
                                onChange={(e) => handleCompositionChange('viewpoint', e.target.value)}
                                className="w-full p-2 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            >
                                {VIEWPOINT_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt.replace(/-/g, ' ')}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Whitespace</label>
                            <select
                                value={editedSpec.composition.whitespace}
                                onChange={(e) => handleCompositionChange('whitespace', e.target.value)}
                                className="w-full p-2 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            >
                                {WHITESPACE_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>

                {/* Style & Text */}
                <section>
                    <h4 className="text-md uppercase tracking-wide text-gray-500 font-semibold mb-3 border-b pb-1">Style & Text</h4>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Text Policy</label>
                        <div className="flex space-x-4">
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    value="NO_LABELS"
                                    checked={editedSpec.textPolicy === 'NO_LABELS'}
                                    onChange={() => handleChange('textPolicy', 'NO_LABELS')}
                                    className="form-radio text-blue-600"
                                />
                                <span className="ml-2 text-sm">No Labels</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    value="LIMITED_LABELS_1_TO_3"
                                    checked={editedSpec.textPolicy === 'LIMITED_LABELS_1_TO_3'}
                                    onChange={() => handleChange('textPolicy', 'LIMITED_LABELS_1_TO_3')}
                                    className="form-radio text-blue-600"
                                />
                                <span className="ml-2 text-sm">Limited Labels (1-3)</span>
                            </label>
                        </div>
                    </div>

                    {editedSpec.textPolicy === 'LIMITED_LABELS_1_TO_3' && (
                        <div className="pl-4 border-l-2 border-blue-100">
                            {renderArrayInput('allowedLabels', 'Allowed Labels')}
                        </div>
                    )}

                    {renderArrayInput('colors', 'Dominant Colors')}
                    {renderArrayInput('negativePrompt', 'Negative Constraints')}
                </section>
            </div>

            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium"
                >
                    Cancel
                </button>
                <button
                    onClick={() => onSave(editedSpec)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium shadow-sm"
                >
                    Save Changes
                </button>
            </div>
        </div>
    );
};
