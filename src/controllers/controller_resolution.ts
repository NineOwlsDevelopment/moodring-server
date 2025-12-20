import { Response } from "express";
import { MarketModel } from "../models/Market";
import { MoodringAdminModel, MoodringModel } from "../models/Moodring";
import { OptionModel } from "../models/Option";
import { WalletModel } from "../models/Wallet";
import {
  ResolutionMode,
  ResolutionSubmissionModel,
  MarketResolutionModel,
  MarketStatus,
} from "../models/Resolution";
import { ResolutionEngine } from "../services/resolutionEngine";
import { withTransaction, TransactionError } from "../utils/transaction";
import {
  sendError,
  sendNotFound,
  sendSuccess,
  sendValidationError,
} from "../utils/errors";
import { validateRequired, validateFields } from "../utils/validation";
import {
  SubmitResolutionRequest,
  GetResolutionRequest,
  DisputeResolutionRequest,
} from "../types/requests";
import { pool } from "../db";

/**
 * @route POST /api/resolution/submit
 * @desc Submit a resolution for a market
 * @access Private
 */
export const submitResolution = async (
  req: SubmitResolutionRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const { marketId, outcome, optionId, evidence, signature } = req.body;

    // Validate required fields - optionId is now required
    const validation = validateFields([
      validateRequired(marketId, "Market ID"),
      validateRequired(outcome, "Outcome"),
      validateRequired(optionId, "Option ID"),
    ]);

    if (!validation.isValid) {
      return sendValidationError(res, validation.error!);
    }

    const submission = await withTransaction(async (client) => {
      // Get market
      const market = await MarketModel.findById(marketId, client);
      if (!market) {
        throw new TransactionError(404, "Market not found");
      }

      // Check if market is in resolving state
      if (
        market.status !== MarketStatus.RESOLVING &&
        market.status !== MarketStatus.OPEN
      ) {
        throw new TransactionError(
          400,
          `Market is not accepting resolutions (status: ${market.status})`
        );
      }

      // Validate the option exists and isn't already resolved
      const option = await OptionModel.findById(optionId!, client);
      if (!option) {
        throw new TransactionError(404, "Option not found");
      }
      if (option.market_id !== marketId) {
        throw new TransactionError(
          400,
          "Option does not belong to this market"
        );
      }
      if (option.is_resolved) {
        throw new TransactionError(400, "Option is already resolved");
      }
      // Validate that the outcome matches the option label
      if (outcome !== option.option_label) {
        throw new TransactionError(
          400,
          `Outcome must match the option label: ${option.option_label}`
        );
      }

      // Check authorization based on resolution mode
      const isCreator = market.creator_id === userId;
      const isAdmin = await MoodringAdminModel.isAdmin(userId, client);

      // Authorization rules:
      // - ORACLE: only platform admins can resolve
      // - AUTHORITY: creator or admin can resolve
      // - OPINION: anyone can resolve if market expiration has passed
      if (market.resolution_mode === ResolutionMode.ORACLE) {
        if (!isAdmin) {
          throw new TransactionError(
            403,
            "You are not authorized to resolve this market. Only platform admins can resolve ORACLE mode markets."
          );
        }
      } else if (market.resolution_mode === ResolutionMode.AUTHORITY) {
        if (!isCreator && !isAdmin) {
          throw new TransactionError(
            403,
            "You are not authorized to resolve this market. Only the market creator or admin can resolve AUTHORITY mode markets."
          );
        }
      } else if (market.resolution_mode === ResolutionMode.OPINION) {
        // For OPINION, anyone can resolve if market expiration has passed
        const now = Math.floor(Date.now() / 1000);
        if (market.expiration_timestamp > now) {
          throw new TransactionError(
            400,
            "Market expiration date has not passed. OPINION mode markets can only be resolved after expiration."
          );
        }
      }

      // Create submission (model handles resolver creation internally)
      const submission = await ResolutionSubmissionModel.create(
        {
          market_id: marketId,
          user_id: userId,
          outcome,
          evidence,
          signature,
        },
        client
      );

      // Update market status to RESOLVING if not already
      if (market.status === MarketStatus.OPEN) {
        await MarketModel.update(
          marketId,
          { status: MarketStatus.RESOLVING },
          client
        );
      }

      // Process the submission and resolve the option
      // Use the resolution engine logic
      const allSubmissions = await ResolutionSubmissionModel.findByMarket(
        marketId,
        client
      );
      const optionSubmissions = allSubmissions.filter(
        (s) => s.outcome === option.option_label
      );

      let winningSide: number;
      let resolutionTrace: any;

      if (optionSubmissions.length > 0) {
        // Use resolution engine to determine outcome
        if (!market.resolution_mode) {
          throw new TransactionError(400, "Market resolution mode is required");
        }
        const outcomes = [option.option_label];
        const resolutionResult = ResolutionEngine.resolveMarket(
          {
            id: market.id,
            question: market.question,
            resolution_mode: market.resolution_mode,
            outcomes,
          },
          optionSubmissions
        );

        winningSide =
          resolutionResult.final_outcome === option.option_label ? 1 : 2;
        resolutionTrace = resolutionResult.resolution_trace;
      } else {
        // Default: if submission says this option, it wins (YES)
        winningSide = 1; // YES wins
        resolutionTrace = {
          mode: market.resolution_mode,
          note: "Option resolved based on submission",
          submission_id: submission.id,
          evidence: submission.evidence,
        };
      }

      // Set dispute deadline (2 hours from now)
      const disputeWindowHours = 2;
      const disputeDeadline =
        Math.floor(Date.now() / 1000) + disputeWindowHours * 60 * 60;

      // Resolve the option
      await OptionModel.update(
        optionId!,
        {
          is_resolved: true,
          winning_side: winningSide,
          resolved_at: Math.floor(Date.now() / 1000),
          resolved_reason: `Resolved via ${market.resolution_mode} mode based on submission`,
          resolved_by: userId,
          dispute_deadline: disputeDeadline,
        },
        client
      );

      // Update market resolved_options count
      const allOptions = await OptionModel.findByMarketId(marketId, client);
      const resolvedCount = allOptions.filter((opt) => opt.is_resolved).length;
      await MarketModel.update(
        marketId,
        { resolved_options: resolvedCount },
        client
      );

      // Check if all options are resolved, then mark market as resolved
      if (resolvedCount === allOptions.length) {
        await MarketModel.update(
          marketId,
          {
            is_resolved: true,
            status: MarketStatus.RESOLVED,
          },
          client
        );
      }

      return {
        submission,
        resolved: true,
        option: await OptionModel.findById(optionId!, client),
        resolution_trace: resolutionTrace,
      };
    });

    return sendSuccess(res, { submission });
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    console.error("Submit resolution error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route GET /api/resolution/:marketId
 * @desc Get resolution information for a market
 * @access Public
 */
export const getResolution = async (
  req: GetResolutionRequest,
  res: Response
) => {
  try {
    const { marketId } = req.params;

    const market = await MarketModel.findById(marketId);
    if (!market) {
      return sendNotFound(res, "Market");
    }

    const resolution = await MarketResolutionModel.findByMarket(marketId);
    const submissions = await ResolutionSubmissionModel.findByMarket(marketId);

    return sendSuccess(res, {
      market: {
        id: market.id,
        question: market.question,
        resolution_mode: market.resolution_mode,
        bond_amount: market.bond_amount,
        status: market.status,
      },
      resolution,
      submissions,
    });
  } catch (error: any) {
    console.error("Get resolution error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};

/**
 * @route POST /api/resolution/dispute
 * @desc Dispute a market resolution
 * @access Private
 */
export const disputeResolution = async (
  req: DisputeResolutionRequest,
  res: Response
) => {
  try {
    const userId = req.id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }
    const { marketId, optionId, reason, evidence } = req.body;

    // Validate required fields
    const validation = validateFields([
      validateRequired(marketId, "Market ID"),
      validateRequired(optionId, "Option ID"),
      validateRequired(reason, "Reason"),
    ]);

    if (!validation.isValid) {
      return sendValidationError(res, validation.error!);
    }

    // Fixed dispute resolution fee: $100 USDC
    const DISPUTE_RESOLUTION_FEE_MICROUSDC = 100 * 1_000_000;

    await withTransaction(async (client) => {
      const market = await MarketModel.findById(marketId, client);
      if (!market) {
        throw new TransactionError(404, "Market not found");
      }

      // Get the specific option being disputed
      const option = await OptionModel.findById(optionId, client);
      if (!option) {
        throw new TransactionError(404, "Option not found");
      }

      if (option.market_id !== marketId) {
        throw new TransactionError(
          400,
          "Option does not belong to this market"
        );
      }

      // Only resolved options can be disputed
      if (!option.is_resolved) {
        throw new TransactionError(
          400,
          "Only resolved options can be disputed"
        );
      }

      // Check if dispute deadline has passed for this specific option
      // Dispute window is always exactly 2 hours from when resolution began
      if (!option.dispute_deadline) {
        throw new TransactionError(
          400,
          "This option does not have a dispute deadline (OPINION mode options cannot be disputed)"
        );
      }

      if (
        option.dispute_deadline > 0 &&
        option.dispute_deadline < Math.floor(Date.now() / 1000)
      ) {
        throw new TransactionError(
          400,
          "Dispute deadline has passed for this option"
        );
      }

      // Get user wallet and check balance
      const wallet = await WalletModel.findByUserId(userId, client);
      if (!wallet) {
        throw new TransactionError(404, "Wallet not found");
      }

      // Check sufficient balance for resolution fee
      if (Number(wallet.balance_usdc) < DISPUTE_RESOLUTION_FEE_MICROUSDC) {
        throw new TransactionError(
          400,
          `Insufficient USDC balance. Dispute resolution requires a $100 USDC fee.`
        );
      }

      // Deduct resolution fee from user's wallet
      await client.query(
        `UPDATE wallets SET balance_usdc = balance_usdc - $1, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
        [DISPUTE_RESOLUTION_FEE_MICROUSDC, wallet.id]
      );

      // Record the resolution fee as protocol fee (platform keeps it)
      // Pass 0 for creator fees since this is purely a platform fee
      await MoodringModel.recordFees(
        0,
        DISPUTE_RESOLUTION_FEE_MICROUSDC,
        client
      );

      // Update market status to DISPUTED
      await MarketModel.update(
        marketId,
        { status: MarketStatus.DISPUTED },
        client
      );
    });

    return sendSuccess(res, {
      message: "Dispute submitted. Market status updated to DISPUTED",
      resolutionFee: DISPUTE_RESOLUTION_FEE_MICROUSDC,
    });
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return sendError(res, error.statusCode, error.message, error.details);
    }
    console.error("Dispute resolution error:", error);
    return sendError(res, 500, error.message || "Internal server error");
  }
};
