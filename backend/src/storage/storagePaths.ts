// Storage object layout (ADR-016): binaries live at
// users/{uid}/observations/{observationId}/{mediaId} — strictly NO 'media/'
// segment. Derived in one place so the scheme cannot drift across callers
// (media routes, media repository, observation delete cascade).
export function observationStoragePrefix(uid: string, observationId: string): string {
  return `users/${uid}/observations/${observationId}/`;
}

export function mediaStoragePath(
  uid: string,
  observationId: string,
  mediaId: string
): string {
  return `${observationStoragePrefix(uid, observationId)}${mediaId}`;
}
