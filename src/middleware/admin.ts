import { Request, Response, NextFunction } from "express";
import { MoodringAdminModel } from "../models/Moodring";
import UserRequest from "../types";

/**
 * Middleware to require admin privileges
 * Must be used after authenticateToken middleware
 */
export const requireAdmin = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.id) {
      res.status(401).send({ error: "Authentication required" });
      return;
    }

    // Check if user is in the admin table
    // getAdminWithUser returns null if user is not an admin
    const adminRecord = await MoodringAdminModel.getAdminWithUser(req.id);

    if (!adminRecord) {
      // User exists but is not an admin
      res.status(403).send({ error: "Admin access required" });
      return;
    }

    // User is verified as an admin, proceed
    next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    res.status(500).send({ error: "Failed to verify admin privileges" });
  }
};
