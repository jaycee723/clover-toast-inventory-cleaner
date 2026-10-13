# Security Specification & Test Matrix

## 1. Data Invariants

1. **User Identity Boundary**: A user profile at `/users/{userId}` can only be read, created, or updated by the authenticated user whose `request.auth.uid == userId`.
2. **Session Ownership**: A review session document at `/users/{userId}/sessions/{sessionId}` must strictly belong to the authenticated user (`request.auth.uid == userId` and `incoming().userId == userId`).
3. **No Cross-User Access**: Unauthenticated users or authenticated users cannot access, list, modify, or delete another user's sessions.
4. **Key Whitelisting & Schema Adherence**: Every written document must only contain allowed keys conforming to `firebase-blueprint.json` without shadow or ghost fields.
5. **Path Validation**: Document IDs (`userId`, `sessionId`) must conform to `isValidId()` (size <= 128, matching `^[a-zA-Z0-9_\-]+$`).
6. **Immutable Fields**: `id`, `userId`, and `createdAt` are immutable after creation.
7. **Strict Timestamps**: `createdAt` and `updatedAt` must equal `request.time`.
8. **Size Boundaries**: Strings (`name`, `decisionsJson`, `email`) must not exceed the defined maximum lengths to prevent denial of wallet attacks.

---

## 2. The Dirty Dozen Test Payloads

1. **Payload 1 (Ghost Field Injection)**: Creating a user doc with extra `{ role: 'admin' }` field.
2. **Payload 2 (User Identity Spoofing)**: Creating a user doc at `/users/userA` with `request.auth.uid = 'userB'`.
3. **Payload 3 (Session Cross-Tenant Write)**: User B writing to `/users/userA/sessions/sess1`.
4. **Payload 4 (Unauthenticated Read)**: Anonymous or unauthenticated client reading `/users/userA/sessions/sess1`.
5. **Payload 5 (Unauthenticated List Query)**: Querying `/users/userA/sessions` without authentication.
6. **Payload 6 (Oversized Payload Denial of Wallet)**: Session with `name` exceeding 128 characters or `decisionsJson` exceeding 500,000 characters.
7. **Payload 7 (Path Traversal / Malicious ID)**: Accessing path with ID `../invalid/id` or oversized 2KB ID.
8. **Payload 8 (Client Timestamp Forgery)**: Creating a session with client-supplied past or future `createdAt` timestamp instead of `request.time`.
9. **Payload 9 (Immutable Field Mutation)**: Updating a session and attempting to change `userId` or `createdAt`.
10. **Payload 10 (Negative Counters)**: Creating a session with negative `itemCount` or `approvedCount`.
11. **Payload 11 (Type Confusion)**: Passing numeric or boolean value for `decisionsJson` instead of string.
12. **Payload 12 (Unauthorized Deletion)**: User B attempting to delete `/users/userA/sessions/sess1`.

All 12 payloads must be strictly rejected with `PERMISSION_DENIED`.
