import { db, storage } from '../firebaseConfig';
import { MAX_FILE_SIZE, formatBytes } from '../utils/fileValidation';
import { isError } from '../utils/typeGuards';

import {
    collection,
    doc,
    setDoc,
    updateDoc,
    getDocs,
    getDoc,
    deleteDoc,
    serverTimestamp,
    Timestamp,
    query,
    orderBy,
    limit
} from 'firebase/firestore';
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'firebase/storage';
import type { Slide, ProjectFile, GeneratedImage } from '../types';

/**
 * Uploads a file to Firebase Storage and returns the file metadata.
 */
export const uploadFileToStorage = async (userId: string, projectId: string, file: File): Promise<ProjectFile> => {
    // Safety check: Enforce MAX_FILE_SIZE
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size ${formatBytes(file.size)} exceeds the maximum allowed limit of ${formatBytes(MAX_FILE_SIZE)}`);
    }

    try {

        const storagePath = `users/${userId}/projects/${projectId}/files/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);

        const snapshot = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        return {
            id: crypto.randomUUID(), // OR use a simpler ID if crypto not available in target env (vite uses browser API so fine)
            name: file.name,
            storagePath,
            downloadUrl,
            mimeType: file.type,
            size: file.size
        };
    } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
    }
};

/**
 * Uploads a generated image blob to Firebase Storage.
 */
export const uploadImageToStorage = async (
    userId: string,
    projectId: string,
    imageBlob: Blob,
    filename: string,
    promptId: string,
    aspectRatio: '16:9' | '1:1' = '16:9',
    inputTokens?: number,
    outputTokens?: number
): Promise<GeneratedImage> => {
    try {
        // Create a unique path for the image
        // Using a dedicated 'images' folder to keep it organized separate from user uploads
        const storagePath = `users/${userId}/projects/${projectId}/images/${Date.now()}_${filename}`;
        const storageRef = ref(storage, storagePath);

        const snapshot = await uploadBytes(storageRef, imageBlob);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        return {
            id: crypto.randomUUID(),
            url: downloadUrl,
            storagePath,
            createdAt: Date.now(),
            promptId,
            aspectRatio,
            inputTokens,
            outputTokens
        };
    } catch (error) {
        console.error("Error uploading image:", error);
        throw error;
    }
};

/**
 * Deletes a file from Firebase Storage.
 */
export const deleteFileFromStorage = async (storagePath: string) => {
    try {
        const fileRef = ref(storage, storagePath);
        await deleteObject(fileRef);
    } catch (error) {
        console.error("Error deleting file from storage:", error);
        // Don't throw if file not found, just log
    }
};

// ... (other code remains unchanged)

/**
 * Deletes a project.
 */
export const deleteProject = async (userId: string, projectId: string) => {
    try {
        const projectRef = doc(db, 'users', userId, 'projects', projectId);
        await deleteDoc(projectRef);
        console.log(`Project ${projectId} deleted.`);
    } catch (error) {
        console.error(`Error deleting project ${projectId}:`, error);
        throw error;
    }
};

export interface ProjectData {
    id?: string;
    userId: string;
    title: string;
    topic: string;
    gradeLevel: string;
    subject: string;
    additionalInstructions?: string;
    slides: Slide[];
    files?: ProjectFile[];

    // Token Aggregation (per project)
    textInputTokens?: number;      // Generated slides + prompt regeneration
    textOutputTokens?: number;
    imageInputTokens?: number;     // Image generation only
    imageOutputTokens?: number;

    // Cost Tracking
    totalCost?: number;            // Total USD cost

    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    sources?: string[];
    status?: 'generating' | 'completed' | 'failed';
    generationProgress?: number;
    generationError?: string;
    generationStartedAt?: Timestamp;
    generationCompletedAt?: Timestamp;
}


/**
 * Creates a new project in Firestore.
 */
export const createProject = async (userId: string, data: Omit<ProjectData, 'userId' | 'createdAt' | 'updatedAt' | 'id'>) => {
    try {
        // 1. Create a reference for the new project document
        const projectsCollectionRef = collection(db, 'users', userId, 'projects');
        const newProjectRef = doc(projectsCollectionRef); // Auto-ID

        // 2. Prepare project data (Metadata Only - NO SLIDES)
        // We strip slides from the root document to keep it lightweight.
        const { slides, ...projectMetadata } = data;

        const projectData = {
            ...projectMetadata,
            userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        // 3. Write the project document
        await setDoc(newProjectRef, projectData);

        // 3a. Write Slides to Subcollection (Parallel) - Only if slides exist
        if (slides && slides.length > 0) {
            const slidesCollectionRef = collection(newProjectRef, 'slides');
            await Promise.all(slides.map(async (slide, index) => {
                // Ensure ID exists (should be generated by geminiService, but fallback here)
                const slideId = slide.id || crypto.randomUUID();
                const slideDocRef = doc(slidesCollectionRef, slideId);

                // Explicitly ensure sortOrder if missing
                const slideData = {
                    ...slide,
                    id: slideId,
                    sortOrder: typeof slide.sortOrder === 'number' ? slide.sortOrder : index
                };

                await setDoc(slideDocRef, slideData);
            }));
            console.log(`Project created with ID: ${newProjectRef.id} and ${slides.length} slides.`);
        } else {
            console.log(`Project created with ID: ${newProjectRef.id} (generating status)`);
        }

        return newProjectRef.id;

    } catch (error) {
        console.error("Error creating project:", error);
        throw error;
    }
};

/**
 * Updates an existing project's data (e.g. slides, title).
 * This is intended for auto-saving current state.
 */
/**
 * Updates an existing project's metadata (Title, settings, etc).
 * DOES NOT update slides. Use updateSlide for that.
 */
export const updateProject = async (userId: string, projectId: string, data: Partial<ProjectData>) => {
    try {
        const projectRef = doc(db, 'users', userId, 'projects', projectId);

        // Safety: If 'slides' is accidentally passed, strip it to prevent root bloat re-introduction
        const { slides: _slides, ...safeData } = data;

        if (Object.keys(safeData).length > 0) {
            await updateDoc(projectRef, {
                ...safeData,
                updatedAt: serverTimestamp()
            });
            console.log(`Project ${projectId} metadata updated.`);
        }
    } catch (error) {
        console.error(`Error updating project ${projectId}:`, error);
        throw error;
    }
};

/**
 * Updates a single slide in the subcollection using a PATCH pattern.
 * Uses updateDoc (or setDoc merge) to prevent overwriting concurrent changes.
 */
export const updateSlide = async (userId: string, projectId: string, slideId: string, patch: Partial<Slide>) => {
    try {
        if (!slideId) throw new Error("Cannot update slide without ID");

        const slideRef = doc(db, 'users', userId, 'projects', projectId, 'slides', slideId);

        // Use updateDoc for patch semantics (requires doc to exist)
        // If we needed upsert, we'd use setDoc(..., { merge: true })
        // Here, slides should always exist after creation.
        await updateDoc(slideRef, {
            ...patch,
            updatedAt: serverTimestamp(), // Automatic timestamp for debugging/sorting
        });

        console.log(`Slide ${slideId} updated (patch).`);
    } catch (error) {
        console.error(`Error updating slide ${slideId}:`, error);
        throw error;
    }
};

/**
 * Fetches projects for a specific user, ordered by most recently updated using server-side orderBy.
 * @param userId The ID of the user whose projects to fetch
 * @param limitCount Optional limit on the number of projects to return
 * @returns Array of projects ordered by updatedAt DESC
 */
export const getUserProjects = async (userId: string, limitCount?: number): Promise<ProjectData[]> => {
    try {
        const projectsRef = collection(db, 'users', userId, 'projects');

        // Build the query with server-side ordering
        let q = query(projectsRef, orderBy('updatedAt', 'desc'));

        // Apply limit if provided
        if (limitCount) {
            q = query(q, limit(limitCount));
        }

        const snapshot = await getDocs(q);

        // Fetch slides count for each project
        const projects = await Promise.all(
            snapshot.docs.map(async (doc) => {
                const projectData = {
                    id: doc.id,
                    ...doc.data()
                } as ProjectData;

                // Fetch slides count from subcollection
                // Note: Fetching all slides just to count them is inefficient, 
                // but we keep it here as per current implementation requirement
                const slidesRef = collection(doc.ref, 'slides');
                const slidesSnapshot = await getDocs(slidesRef);
                const slides = slidesSnapshot.docs.map(slideDoc => slideDoc.data() as Slide);

                return {
                    ...projectData,
                    slides
                };
            })
        );

        return projects;
    } catch (error: unknown) {
        // Handle common Firestore query issues like missing indexes gracefully
        const actualError = isError(error) ? error : new Error(String(error));
        const errorCode = (actualError as { code?: string }).code;
        const errorMessage = actualError.message;

        if (errorCode === 'failed-precondition' || (errorMessage && errorMessage.includes('index'))) {
            console.error("Firestore index for 'updatedAt' missing or building. Falling back to client-side sort.", actualError);

            // Fallback: Fetch without ordering and sort client-side
            try {
                const projectsRef = collection(db, 'users', userId, 'projects');
                const snapshot = await getDocs(projectsRef);
                const projects = await Promise.all(
                    snapshot.docs.map(async (doc) => {
                        const projectData = { id: doc.id, ...doc.data() } as ProjectData;
                        const slidesRef = collection(doc.ref, 'slides');
                        const slidesSnapshot = await getDocs(slidesRef);
                        const slides = slidesSnapshot.docs.map(slideDoc => slideDoc.data() as Slide);
                        return { ...projectData, slides };
                    })
                );

                const sorted = projects.sort((a, b) => {
                    const timeA = a.updatedAt?.toMillis() || 0;
                    const timeB = b.updatedAt?.toMillis() || 0;
                    return timeB - timeA;
                });

                // Apply limit manually to fallback results
                return limitCount ? sorted.slice(0, limitCount) : sorted;
            } catch (fallbackError) {
                console.error("Fallback fetch also failed:", fallbackError);
            }
        }

        console.error("Error fetching user projects:", error);
        return [];
    }
};

/**
 * Fetches a single project by ID.
 */
export const getProject = async (userId: string, projectId: string): Promise<ProjectData | null> => {
    try {
        const projectRef = doc(db, 'users', userId, 'projects', projectId);
        const snapshot = await getDoc(projectRef);

        if (snapshot.exists()) {
            const projectData = { id: snapshot.id, ...snapshot.data() } as ProjectData;

            // Fetch Slides from Subcollection
            const slidesRef = collection(projectRef, 'slides');
            const q = query(slidesRef, orderBy('sortOrder', 'asc')); // Ensure order
            const slidesSnapshot = await getDocs(q);

            const slides = slidesSnapshot.docs.map(doc => doc.data() as Slide);

            return {
                ...projectData,
                slides
            };
        }
        return null;
    } catch (error) {
        console.error(`Error fetching project ${projectId}:`, error);
        return null;
    }
};


