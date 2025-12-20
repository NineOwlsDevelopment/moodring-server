// Reserved display names that users cannot use
export const RESERVED_DISPLAY_NAMES = [
  "moodring",
  "admin",
  "administrator",
  "moderator",
  "mod",
  "support",
  "staff",
  "team",
  "official",
  "system",
  "root",
  "owner",
  "founder",
  "ceo",
  "developer",
  "dev",
  "api",
  "bot",
  "service",
];

// Helper to check if a display name is reserved
export const isReservedDisplayName = (displayName: string): boolean => {
  return RESERVED_DISPLAY_NAMES.some(
    (reserved) => reserved.toLowerCase() === displayName.trim().toLowerCase()
  );
};
