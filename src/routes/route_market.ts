import { Router } from "express";
import multer from "multer";
import { authenticateToken } from "../middleware/auth";
import { marketCreationLimiter } from "../middleware/rateLimit";
import { validateUUID } from "../middleware/validate";
import { typedHandler } from "../types/routeHandler";
import {
  createMarket,
  createOption,
  updateMarket,
  updateOption,
  deleteOption,
  deleteMarket,
  initializeMarket,
  withdrawCreatorFee,
  getFairValue,
  estimateBuyCost,
  estimateSellPayout,
  getMarkets,
  getMarket,
  getMyMarkets,
  getFeaturedMarkets,
  getTrendingMarkets,
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  getWatchlistStatus,
  getMarketCreationFee,
  getMarketOEmbed,
  getMarketMeta,
} from "../controllers/controller_market";
import { getCategories } from "../controllers/controller_admin";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Protected routes
router.get("/my-markets", authenticateToken, typedHandler(getMyMarkets));
router.get("/watchlist", authenticateToken, typedHandler(getWatchlist));
router.post(
  "/create",
  authenticateToken,
  marketCreationLimiter,
  upload.single("image"),
  typedHandler(createMarket)
);
router.post(
  "/option/create",
  authenticateToken,
  upload.single("image"),
  typedHandler(createOption)
);
router.put(
  "/:id",
  authenticateToken,
  validateUUID("id"),
  upload.single("image"),
  typedHandler(updateMarket)
);
router.put(
  "/option/:id",
  authenticateToken,
  validateUUID("id"),
  upload.single("image"),
  typedHandler(updateOption)
);
router.delete(
  "/option/:id",
  authenticateToken,
  validateUUID("id"),
  typedHandler(deleteOption)
);
router.post("/initialize", authenticateToken, typedHandler(initializeMarket));
router.post(
  "/withdraw-creator-fee",
  authenticateToken,
  typedHandler(withdrawCreatorFee)
);
router.post(
  "/:id/watchlist",
  authenticateToken,
  validateUUID("id"),
  typedHandler(addToWatchlist)
);
router.delete(
  "/:id/watchlist",
  authenticateToken,
  validateUUID("id"),
  typedHandler(removeFromWatchlist)
);
router.delete(
  "/:id",
  authenticateToken,
  validateUUID("id"),
  typedHandler(deleteMarket)
);
router.get(
  "/:id/watchlist/status",
  authenticateToken,
  validateUUID("id"),
  typedHandler(getWatchlistStatus)
);

// Public routes
router.get("/", typedHandler(getMarkets));
router.get("/categories", typedHandler(getCategories));
router.get("/creation-fee", typedHandler(getMarketCreationFee));
router.get("/featured", typedHandler(getFeaturedMarkets));
router.get("/trending", typedHandler(getTrendingMarkets));
router.get(
  "/option/:option/fair-value",
  validateUUID("option"),
  typedHandler(getFairValue)
);
router.get("/:id", validateUUID("id"), typedHandler(getMarket));
router.get("/:id/oembed", validateUUID("id"), typedHandler(getMarketOEmbed));
router.get("/:id/meta", validateUUID("id"), typedHandler(getMarketMeta));
router.post("/estimate-buy", typedHandler(estimateBuyCost));
router.post("/estimate-sell", typedHandler(estimateSellPayout));

export default router;
