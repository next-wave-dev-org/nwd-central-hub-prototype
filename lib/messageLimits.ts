// Shared across every form that writes to direct_messages, announcements, or
// project_messages — keep in sync with the CHECK constraints on those tables
// (docs/database-schema.md, "Length limits" step) so client and DB agree.
export const TITLE_MAX_LENGTH = 200
export const BODY_MAX_LENGTH = 5000
