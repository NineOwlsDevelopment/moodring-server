"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isReservedDisplayName = exports.RESERVED_DISPLAY_NAMES = void 0;
// Reserved display names that users cannot use
exports.RESERVED_DISPLAY_NAMES = [
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
const isReservedDisplayName = (displayName) => {
    return exports.RESERVED_DISPLAY_NAMES.some((reserved) => reserved.toLowerCase() === displayName.trim().toLowerCase());
};
exports.isReservedDisplayName = isReservedDisplayName;
//# sourceMappingURL=reservedNames.js.map