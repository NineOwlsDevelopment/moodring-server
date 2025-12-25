"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = void 0;
const Moodring_1 = require("../models/Moodring");
/**
 * Middleware to require admin privileges
 * Must be used after authenticateToken middleware
 */
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.id) {
            res.status(401).send({ error: "Authentication required" });
            return;
        }
        // Check if user is in the admin table
        // getAdminWithUser returns null if user is not an admin
        const adminRecord = await Moodring_1.MoodringAdminModel.getAdminWithUser(req.id);
        if (!adminRecord) {
            // User exists but is not an admin
            res.status(403).send({ error: "Admin access required" });
            return;
        }
        // User is verified as an admin, proceed
        next();
    }
    catch (error) {
        console.error("Admin middleware error:", error);
        res.status(500).send({ error: "Failed to verify admin privileges" });
    }
};
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=admin.js.map