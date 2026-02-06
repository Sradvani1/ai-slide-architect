# Security Ops Notes

## Firestore TTL for download tokens
This project stores short-lived download tokens in the `downloadTokens` collection with an `expiresAt` timestamp (Unix ms).
Enable Firestore TTL on that field so expired tokens are removed automatically.

Steps (Firebase Console):
1) Go to Firestore Database → TTL.
2) Add a TTL policy for collection `downloadTokens` on field `expiresAt`.
3) Save and wait for TTL to activate.

Notes:
- TTL deletions are eventual; expect some delay after expiration.
- No app behavior changes; expired tokens simply stop resolving server-side.
