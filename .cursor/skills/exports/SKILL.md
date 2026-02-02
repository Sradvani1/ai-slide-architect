---
name: exports
description: Applies the project's export and download patterns when changing PowerPoint (PPTX), speaker notes (DOCX), or research report (DOCX) generation. Use when editing export logic, SlideDeck download handlers, pptxgenjs or docx usage, or when changing how slides, notes, or research are written to file.
---

# Exports Guidelines

When changing how slides, speaker notes, or research reports are exported or downloaded, follow the project's patterns.

## When to Use This Skill

- Editing PPTX export (PowerPoint / slides)
- Editing DOCX export (speaker notes or research report)
- Changing download filenames, blob handling, or export UI state
- Adding or changing export formats

## Source of Truth

All export logic is **client-side** in `src/components/SlideDeck.tsx`. Dependencies: `pptxgenjs` (PPTX), `docx` (DOCX). No backend endpoints for exports.

## Export Types

| Export | Library | Handler | Output |
|--------|---------|---------|--------|
| **Slides (PPTX)** | PptxGenJS | `handleExportPPTX` | Full deck: title slide (slide 0) + content slides; text only (no images in PPTX). |
| **Speaker notes (DOCX)** | docx | `generateDocx` → `handleDownloadNotes` | One section: per slide, "Slide N: {title}" (HEADING_1) then speaker notes paragraph. No sources section. |
| **Research report (DOCX)** | docx | `generateResearchReportDocx` → `handleDownloadResearchReport` | Sections: "Research Report" title, optional "Project Metadata" (title, topic, grade level, subject), "Research Content" (paragraphs from researchContent), optional "Sources" (web URLs as links), optional "Uploaded Files" (File: … entries). |

## PPTX (PptxGenJS)

- **Layout:** `pptx.layout = 'LAYOUT_16x9'`.
- **Slides:** One `addSlide()` per slide. Slide 0: title slide — title centered (fontSize 44), content below (fontSize 24, no bullets). Slides 1+: title left-aligned (fontSize 32), content with bullets (fontSize 18). Use `cleanText(item)` (from SlideCard) for slide content strings.
- **Filename:** From first slide title: sanitize to `[a-z0-9_]`, lower case, max 50 chars; fallback `presentation.pptx`. Then `pptx.writeFile({ fileName })`.
- **State:** `isExporting` during run; errors via `alert` and `console.error`.

## DOCX (docx)

- **Speaker notes:** `generateDocx(slides, sources)` — `Document` with one section; for each slide: `Paragraph` "Slide N: {title}" (HeadingLevel.HEADING_1), then notes paragraph. Sources are not included in speaker notes export. `Packer.toBlob(doc)`.
- **Research report:** `generateResearchReportDocx({ researchContent, sources, title, topic, gradeLevel, subject })` — "Research Report" heading, optional metadata block, "Research Content" via `buildParagraphsFromText(researchContent)`, then optional "Sources" (web URLs via `buildSourceParagraphs` with `ExternalHyperlink`), optional "Uploaded Files" (entries starting with "File:" via `splitSources`). `normalizeLinkTarget` for URLs (add https if missing). `Packer.toBlob(doc)`.
- **Download pattern:** `Blob` → `URL.createObjectURL` → create `<a download="...">`, click, remove, `URL.revokeObjectURL`. Filenames: speaker notes `{baseFileName}_speaker_notes.docx`, research `{baseFileName}_research_report.docx`; baseFileName from first slide title or project title/topic, sanitized, max 50 chars.

## Helpers in SlideDeck

- `cleanText` — imported from SlideCard; use for PPTX slide content.
- `normalizeLinkTarget(value)` — ensure URL has scheme for links.
- `buildSourceParagraphs(sources)` — numbered list with clickable URLs.
- `buildParagraphsFromText(text)` — split on newlines, one Paragraph per line.
- `splitSources(sources)` — split into webSources vs fileSources (entries starting with "File:").
- `buildFileSourceParagraphs(sources)` — plain paragraphs for file list.

## Image Download (Separate)

Batch image download (zip) lives in `src/utils/imageDownload.ts` (`downloadImagesAsZip`) and is triggered from SlideCard, not from SlideDeck export buttons. Change that flow in SlideCard + imageDownload.

## Where to Look

- **PPTX and DOCX export:** `src/components/SlideDeck.tsx` — handlers, `generateDocx`, `generateResearchReportDocx`, PptxGenJS usage, docx Document/Packer/Paragraph/HeadingLevel/TextRun/ExternalHyperlink.
- **Content sanitization:** `src/components/SlideCard.tsx` — `cleanText`.
- **Slide/research data shape:** `shared/types.ts` — `Slide`, `ProjectData` (researchContent, sources, etc.).
