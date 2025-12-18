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
    'macro-close-up',
    'dutch-angle',
    'child-eye-level',
    'side-profile',
    'isometric-3d-cutaway',
    'bird\'s-eye-view',
];

const WHITESPACE_OPTIONS: Whitespace[] = ['generous', 'moderate'];

type ArrayField = 'subjects' | 'visualizationDynamics' | 'contextualDetails' | 'mustInclude' | 'avoid' | 'colors' | 'negativePrompt' | 'allowedLabels';

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
                    {renderArrayInput('visualizationDynamics', 'Actions / Dynamics')}

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Environment / Setting</label>
                        <input
                            type="text"
                            value={editedSpec.environment || ''}
                            onChange={(e) => handleChange('environment', e.target.value)}
                            className="w-full p-2 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g. Science Lab, Outdoor Park"
                        />
                    </div>
                    {renderArrayInput('contextualDetails', 'Contextual Details')}

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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Depth of Field</label>
                            <select
                                value={editedSpec.composition.depthOfField || ''}
                                onChange={(e) => handleCompositionChange('depthOfField', e.target.value)}
                                className="w-full p-2 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Default</option>
                                <option value="shallow">Shallow (Focus on subject)</option>
                                <option value="deep">Deep (Everything in focus)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Framing Rationale</label>
                            <input
                                type="text"
                                value={editedSpec.composition.framingRationale || ''}
                                onChange={(e) => handleCompositionChange('framingRationale', e.target.value)}
                                className="w-full p-2 border rounded-md text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Why this angle?"
                            />
                        </div>
                    </div>
                </section>

                {/* Lighting */}
                <section>
                    <h4 className="text-md uppercase tracking-wide text-gray-500 font-semibold mb-3 border-b pb-1">Lighting</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quality</label>
                            <input
                                type="text"
                                value={editedSpec.lighting?.quality || ''}
                                onChange={(e) => handleChange('lighting', { ...editedSpec.lighting, quality: e.target.value })}
                                className="w-full p-2 border rounded-md text-sm border-gray-300"
                                placeholder="e.g. Soft, Hard, Diffused"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
                            <input
                                type="text"
                                value={editedSpec.lighting?.direction || ''}
                                onChange={(e) => handleChange('lighting', { ...editedSpec.lighting, direction: e.target.value })}
                                className="w-full p-2 border rounded-md text-sm border-gray-300"
                                placeholder="e.g. Side, Backlit"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Color Temp</label>
                            <input
                                type="text"
                                value={editedSpec.lighting?.colorTemperature || ''}
                                onChange={(e) => handleChange('lighting', { ...editedSpec.lighting, colorTemperature: e.target.value })}
                                className="w-full p-2 border rounded-md text-sm border-gray-300"
                                placeholder="e.g. Warm, Cool, Neutral"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mood</label>
                            <input
                                type="text"
                                value={editedSpec.lighting?.mood || ''}
                                onChange={(e) => handleChange('lighting', { ...editedSpec.lighting, mood: e.target.value })}
                                className="w-full p-2 border rounded-md text-sm border-gray-300"
                                placeholder="e.g. Cheerful, Mysterious"
                            />
                        </div>
                    </div>
                </section>

                {/* Style & Text */}
                <section>
                    <h4 className="text-md uppercase tracking-wide text-gray-500 font-semibold mb-3 border-b pb-1">Style & Text</h4>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Text Policy</label>
                        <div className="flex flex-col space-y-2">
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
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    value="DIAGRAM_LABELS_WITH_LEGEND"
                                    checked={editedSpec.textPolicy === 'DIAGRAM_LABELS_WITH_LEGEND'}
                                    onChange={() => handleChange('textPolicy', 'DIAGRAM_LABELS_WITH_LEGEND')}
                                    className="form-radio text-blue-600"
                                />
                                <span className="ml-2 text-sm">Diagram with Legend</span>
                            </label>
                        </div>
                    </div>

                    {editedSpec.textPolicy !== 'NO_LABELS' && (
                        <div className="pl-4 border-l-2 border-blue-100 space-y-3">
                            {renderArrayInput('allowedLabels', 'Allowed Labels')}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Label Placement</label>
                                <input
                                    type="text"
                                    value={editedSpec.labelPlacement || ''}
                                    onChange={(e) => handleChange('labelPlacement', e.target.value)}
                                    className="w-full p-2 border rounded-md text-sm border-gray-300"
                                    placeholder="e.g. Next to arrows"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Label Font</label>
                                <input
                                    type="text"
                                    value={editedSpec.labelFont || ''}
                                    onChange={(e) => handleChange('labelFont', e.target.value)}
                                    className="w-full p-2 border rounded-md text-sm border-gray-300"
                                    placeholder="e.g. Bold Sans-serif"
                                />
                            </div>
                        </div>
                    )}

                    <div className="mb-4 pt-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={editedSpec.requiresGrounding || false}
                                onChange={(e) => handleChange('requiresGrounding', e.target.checked)}
                                className="form-checkbox text-blue-600 h-4 w-4 rounded border-gray-300"
                            />
                            <span className="text-sm font-medium text-gray-700">Requires Grounding (Check Facts)</span>
                        </label>
                        <p className="text-xs text-gray-500 ml-6">Check if this image represents specific data that needs Google Search verification.</p>
                    </div>

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
