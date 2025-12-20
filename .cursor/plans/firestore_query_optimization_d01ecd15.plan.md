---
name: Firestore Query Optimization
overview: Optimize Firestore queries by using server-side ordering with the existing index, adding pagination support, and limiting results to improve performance and reduce costs as user data scales.
todos:
  - id: update-project-service-imports
    content: Update imports in projectService.ts to include limit from firebase/firestore
    status: pending
  - id: optimize-getuserprojects-query
    content: Replace client-side sort in getUserProjects with server-side orderBy query using existing index
    status: pending
  - id: add-pagination-parameter
    content: Add optional limit parameter to getUserProjects function signature
    status: pending
  - id: remove-client-side-sort
    content: Remove client-side sorting code from getUserProjects (lines 271-276)
    status: pending
  - id: update-dashboard-imports
    content: Update imports in Dashboard.tsx to include limit from firebase/firestore
    status: pending
  - id: add-dashboard-query-limit
    content: Add limit(50) to Dashboard query to prevent loading excessive projects
    status: pending
  - id: update-documentation
    content: Update JSDoc comments for getUserProjects to document new limit parameter and server-side sorting
    status: pending
---

# Firestore Query Optimization Implementation Plan

## Overview

Optimize Firestore queries to improve performance and reduce costs by:

1. Using server-side `orderBy` queries with the existing index instead of client-side sorting
2. Adding pagination support with `limit()` to prevent loading all projects
3. Limiting Dashboard query results to reduce initial load time

## Current State Analysis

**Existing Index:** `firestore.indexes.json` already has an index for `updatedAt DESC` on the projects collection.**Current Issues:**

- `getUserProjects()` in `projectService.ts` fetches all documents and sorts client-side (lines 243-281)
- Dashboard component uses `orderBy('updatedAt', 'desc')` correctly but doesn't limit results
- Both Dashboard and `getUserProjects` fetch ALL slides for each project just to display count
- No pagination support - loads all user projects regardless of count

## Implementation Steps

### Step 1: Update getUserProjects to use orderBy query

**File:** `src/services/projectService.ts`**Changes:**

- Replace client-side sorting with Firestore `orderBy` query
- Use the existing index for `updatedAt DESC`
- Add optional `limit` parameter for pagination support
- Keep the fallback behavior if index is missing (though it shouldn't be needed)

**Code changes:**

- Line 243: Update function signature to accept optional `limit?: number` parameter
- Lines 245-249: Replace `getDocs(projectsRef)` with `getDocs(query(projectsRef, orderBy('updatedAt', 'desc'), ...))`
- Add `limit()` if limit parameter provided
- Remove lines 271-276 (client-side sort) since server handles it
- Add try-catch around the query to handle potential index errors gracefully

### Step 2: Add limit to Dashboard query

**File:** `src/components/Dashboard.tsx`**Changes:**

- Add `limit()` to the main query to prevent loading excessive projects
- Start with limit of 50 projects (reasonable default for dashboard view)
- Consider showing "Load more" button if user has more than limit (future enhancement)

**Code changes:**

- Line 23: Update query to include `limit(50)` after `orderBy('updatedAt', 'desc')`
- Import `limit` from 'firebase/firestore' if not already imported

### Step 3: Update imports

**File:** `src/services/projectService.ts`**Changes:**

- Ensure `limit` is imported from 'firebase/firestore'
- Line 21: Update import to include `limit`: `import { query, orderBy, limit } from 'firebase/firestore'`

**File:** `src/components/Dashboard.tsx`**Changes:**

- Line 6: Update import to include `limit`: `import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore'`

### Step 4: Update function signature and documentation

**File:** `src/services/projectService.ts`**Changes:**

- Update JSDoc comment for `getUserProjects` to document the new `limit` parameter
- Document that results are ordered by `updatedAt DESC` using server-side index
- Note that slides are still fetched (optimization for slide counting is separate work)

### Step 5: Error handling improvements

**File:** `src/services/projectService.ts`**Changes:**

- Improve error handling in `getUserProjects` to catch Firestore index errors specifically
- Log helpful message if index error occurs (though index should exist)
- Return empty array on error (current behavior) but log the error for debugging

## Files to Modify

1. **src/services/projectService.ts**

- Update `getUserProjects` function (lines 243-281)
- Update imports (line 21)

2. **src/components/Dashboard.tsx**

- Update query to include `limit(50)` (line 23)
- Update imports (line 6)

## Implementation Details

### getUserProjects Function Signature Change

```typescript
// Before:
export const getUserProjects = async (userId: string): Promise<ProjectData[]>

// After:
export const getUserProjects = async (userId: string, limitCount?: number): Promise<ProjectData[]>
```



### Query Construction

```typescript
// Before:
const snapshot = await getDocs(projectsRef);
// ... then client-side sort

// After:
let q = query(projectsRef, orderBy('updatedAt', 'desc'));
if (limitCount) {
    q = query(q, limit(limitCount));
}
const snapshot = await getDocs(q);
// Server handles sorting, no client-side sort needed
```



### Dashboard Query Update

```typescript
// Before:
const q = query(projectsRef, orderBy('updatedAt', 'desc'));

// After:
const q = query(projectsRef, orderBy('updatedAt', 'desc'), limit(50));
```



## Testing Requirements

1. **Verify getUserProjects uses index:**

- Test with user that has multiple projects
- Verify projects returned in descending order by `updatedAt`
- Check browser network tab to confirm query uses `orderBy`
- Test with `limit` parameter to verify pagination works

2. **Verify Dashboard query:**

- Test with user that has > 50 projects
- Verify only 50 projects load initially
- Verify projects are ordered correctly
- Test with user that has < 50 projects (should work normally)

3. **Error handling:**

- Verify graceful handling if index somehow missing (shouldn't happen but test fallback)

4. **Performance:**

- Measure load time improvement for users with many projects
- Verify reduced Firestore read costs

## Notes

- The index already exists in `firestore.indexes.json`, so no index creation needed
- Slide fetching optimization (counting without fetching all) is a separate optimization