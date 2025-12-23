import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Keypair } from "@solana/web3.js";
import { toast } from "sonner";
import { useUserStore } from "@/stores/userStore";
import {
  createMarket,
  createOption,
  initializeMarket,
  fetchCategories,
  fetchMarket,
  getMarketCreationFee,
  Category,
} from "@/api/api";
import { capitalizeWords, formatUSDC } from "@/utils/format";
import { ResolutionMode, ResolutionConfig } from "@/stores/resolutionStore";
import { sortCategories } from "@/utils/categorySort";
import { validateTextContent } from "@/utils/bannedWords";

type Step = "details" | "options" | "review";

// Character limits (must match backend)
const MAX_QUESTION_LENGTH = 200;
const MAX_OPTION_LABEL_LENGTH = 100;

export const CreateMarket = () => {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editMarketId = searchParams.get("market");
  const [currentStep, setCurrentStep] = useState<Step>("details");
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);

  // Form state
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [isBinary, setIsBinary] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Resolution state
  const [resolutionMode, setResolutionMode] = useState<ResolutionMode>(
    ResolutionMode.ORACLE
  );
  const [_, setResolutionConfig] = useState<ResolutionConfig>({
    bondAmount: 0.5, // Stored in USDC (will be converted to microUSDC when sending)
    // Dispute window is fixed at 2 hours (non-editable)
    disputeWindowHours: 2,
  });

  // Options state
  const [options, setOptions] = useState<
    { label: string; image: File | null }[]
  >([]);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [newOptionImage, setNewOptionImage] = useState<File | null>(null);

  // Liquidity state
  const [initialLiquidity, setInitialLiquidity] = useState<string>("100");

  // API state
  const [categories, setCategories] = useState<Category[]>([]);
  const [createdMarketKey, setCreatedMarketKey] = useState<string | null>(null);
  const [isCreatingMarket, setIsCreatingMarket] = useState(false);
  const [isCreatingOption, setIsCreatingOption] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [creationFee, setCreationFee] = useState<number>(0);
  const [isLoadingFee, setIsLoadingFee] = useState(false);

  // Validation errors for banned words
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [optionLabelError, setOptionLabelError] = useState<string | null>(null);

  // Load existing market if editing
  useEffect(() => {
    if (editMarketId) {
      loadExistingMarket(editMarketId);
    }
  }, [editMarketId]);

  const loadExistingMarket = async (marketId: string) => {
    setIsLoadingMarket(true);
    try {
      const { market } = await fetchMarket(marketId);

      // Populate form state from existing market
      setQuestion(market.question);
      setDescription(market.market_description || "");
      setIsBinary(market.is_binary);
      setCreatedMarketKey(market.id);

      // Set image preview from existing market image URL
      if (market.image_url) {
        setImagePreview(market.image_url);
      }

      // Convert timestamp to datetime-local format
      if (market.expiration_timestamp) {
        try {
          // Handle various timestamp formats
          let timestamp: number;
          if (typeof market.expiration_timestamp === "number") {
            // If it's a small number, it's likely seconds; if large, it's milliseconds
            timestamp =
              market.expiration_timestamp > 1e12
                ? market.expiration_timestamp
                : market.expiration_timestamp * 1000;
          } else {
            // It's a string or Date object
            timestamp = new Date(market.expiration_timestamp).getTime();
          }
          const date = new Date(timestamp);
          if (!isNaN(date.getTime())) {
            setExpirationDate(date.toISOString().slice(0, 16));
          }
        } catch (e) {
          console.error("Failed to parse expiration timestamp:", e);
        }
      }

      // Load existing options
      if (market.options && market.options.length > 0) {
        setOptions(
          market.options.map((opt: any) => ({
            label: opt.option_label,
            image: null, // Can't recover the file object
          }))
        );
      }

      // Load existing category (take the first one if multiple exist)
      if (
        (market as any).categories &&
        Array.isArray((market as any).categories) &&
        (market as any).categories.length > 0
      ) {
        setSelectedCategory((market as any).categories[0].id);
      }

      // Load resolution mode and config if available
      if ((market as any).resolution_mode) {
        setResolutionMode((market as any).resolution_mode);
      }
      if ((market as any).resolution_config) {
        const config = (market as any).resolution_config;
        // Convert bondAmount from microUSDC to USDC for display
        const configForDisplay = { ...config };
        if (config.bondAmount && typeof config.bondAmount === "number") {
          // If bondAmount is large (likely microUSDC), convert to USDC
          // microUSDC values are typically >= 100000 (0.1 USDC)
          if (config.bondAmount >= 1000) {
            configForDisplay.bondAmount = config.bondAmount / 1_000_000;
          }
          // Otherwise assume it's already in USDC (for backward compatibility)
        }
        setResolutionConfig(configForDisplay);
      }

      // Determine which step to show
      if (market.options && market.options.length >= 2) {
        // Has enough options, go to review/liquidity step
        setCurrentStep("review");
      } else {
        // Needs more options
        setCurrentStep("options");
      }

      toast.success("Loaded market for editing");
    } catch (err: any) {
      console.error("Failed to load market:", err);
      toast.error("Failed to load market");
      navigate("/my-markets");
    } finally {
      setIsLoadingMarket(false);
    }
  };

  useEffect(() => {
    loadCategories();
    loadCreationFee();
  }, []);

  const loadCreationFee = async () => {
    setIsLoadingFee(true);
    try {
      const feeData = await getMarketCreationFee();
      setCreationFee(feeData.creation_fee_display);
    } catch (error) {
      console.error("Failed to load creation fee:", error);
      // Default to 0 if we can't fetch it
      setCreationFee(0);
    } finally {
      setIsLoadingFee(false);
    }
  };

  useEffect(() => {
    if (image) {
      const url = URL.createObjectURL(image);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [image]);

  // Automatically set resolver when AUTHORITY mode is selected
  // Clear bond/dispute window when switching to OPINION or ORACLE mode
  useEffect(() => {
    if (resolutionMode === ResolutionMode.AUTHORITY && user) {
      setResolutionConfig((prev) => ({
        ...prev,
        authorityResolverId: user.id,
      }));
    } else if (resolutionMode !== ResolutionMode.AUTHORITY) {
      // Clear authorityResolverId when switching away from AUTHORITY
      setResolutionConfig((prev) => {
        const { authorityResolverId, ...rest } = prev;
        return rest;
      });
    }

    // Clear bond and dispute window when switching to OPINION or ORACLE mode
    // ORACLE: admins resolve, no bond/dispute window needed
    // OPINION: market-determined, no bond/dispute window needed
    if (
      resolutionMode === ResolutionMode.OPINION ||
      resolutionMode === ResolutionMode.ORACLE
    ) {
      setResolutionConfig((prev) => {
        const { bondAmount, disputeWindowHours, ...rest } = prev;
        return rest;
      });
    }
  }, [resolutionMode, user]);

  // Prefill option label with question for binary markets when entering options step
  const prevStepRef = useRef<Step>("details");
  useEffect(() => {
    // Only prefill when transitioning TO the options step (not on every render)
    if (
      currentStep === "options" &&
      prevStepRef.current !== "options" &&
      isBinary &&
      question &&
      !newOptionLabel &&
      options.length === 0
    ) {
      setNewOptionLabel(question);
    }
    prevStepRef.current = currentStep;
  }, [currentStep, isBinary, question, newOptionLabel, options.length]);

  const loadCategories = async () => {
    try {
      const { categories: cats } = await fetchCategories();
      const sortedCategories = sortCategories(cats);
      setCategories(sortedCategories);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
    }
  };

  const handleCreateMarket = async () => {
    if (!question || !expirationDate || !image || !selectedCategory) {
      let errorMessage = "Please fill in all required fields";
      if (!image) {
        errorMessage = "Cover image is required. Please upload a cover image.";
      } else if (!selectedCategory) {
        errorMessage = "Please select a category for your market.";
      }
      setError(errorMessage);
      toast.error(errorMessage);
      return;
    }

    // Validate for banned words before submission
    const questionValidation = validateTextContent(question, "Market question");
    if (!questionValidation.isValid) {
      const errorMsg =
        questionValidation.error || "Invalid content in market question";
      setQuestionError(questionValidation.error || null);
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (description) {
      const descriptionValidation = validateTextContent(
        description,
        "Market description"
      );
      if (!descriptionValidation.isValid) {
        const errorMsg =
          descriptionValidation.error ||
          "Invalid content in market description";
        setDescriptionError(descriptionValidation.error || null);
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }
    }

    // Check if user has sufficient balance for creation fee
    if (user?.wallet?.balance_usdc !== undefined && creationFee > 0) {
      const userBalanceDisplay = user.wallet.balance_usdc / 1_000_000; // Convert microUSDC to USDC
      if (userBalanceDisplay < creationFee) {
        const formattedBalance = formatUSDC(user.wallet.balance_usdc).replace(
          "$",
          ""
        );
        const errorMsg = `Insufficient balance. Market creation fee is ${creationFee.toLocaleString(
          undefined,
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )} USDC, but you have ${formattedBalance} USDC`;
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }
    }

    // ORACLE mode doesn't require data sources (platform admins resolve)

    setIsCreatingMarket(true);
    setError(null);

    try {
      const baseKeypair = Keypair.generate();
      const expirationTimestamp = Math.floor(
        new Date(expirationDate).getTime() / 1000
      );

      const { market, creation_fee_display } = await createMarket({
        base: baseKeypair.publicKey.toBase58(),
        marketQuestion: question,
        marketDescription: description,
        marketExpirationDate: expirationTimestamp,
        usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        isBinary,
        categoryIds: selectedCategory ? [selectedCategory] : undefined,
        image,
        resolutionMode,
      });

      setCreatedMarketKey(market);
      setSuccessMessage(
        `Market created successfully! ${
          creation_fee_display > 0
            ? `Creation fee of ${creation_fee_display.toFixed(2)} USDC charged.`
            : ""
        }`
      );
      setTimeout(() => setSuccessMessage(null), 3000);
      setCurrentStep("options");
    } catch (error: any) {
      console.error("Failed to create market:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to create market";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsCreatingMarket(false);
    }
  };

  const handleAddOption = async () => {
    if (!createdMarketKey || !newOptionLabel) {
      setError("Please enter an option label");
      return;
    }

    // Validate for banned words before submission
    const optionValidation = validateTextContent(
      newOptionLabel,
      "Option label"
    );
    if (!optionValidation.isValid) {
      setOptionLabelError(optionValidation.error || null);
      setError(optionValidation.error || "Invalid content in option label");
      return;
    }

    setIsCreatingOption(true);
    setError(null);

    try {
      await createOption({
        market: createdMarketKey,
        optionLabel: newOptionLabel,
        image: newOptionImage || undefined,
      });

      setOptions([
        ...options,
        { label: newOptionLabel, image: newOptionImage },
      ]);
      setNewOptionLabel("");
      setNewOptionImage(null);
      setSuccessMessage("Option added!");
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (error: any) {
      console.error("Failed to create option:", error);
      setError(
        error.response?.data?.error ||
          error.message ||
          "Failed to create option"
      );
    } finally {
      setIsCreatingOption(false);
    }
  };

  const handleInitializeMarket = async () => {
    if (!createdMarketKey) return;

    const liquidityAmount = parseInt(initialLiquidity);

    if (isNaN(liquidityAmount) || liquidityAmount < 100) {
      setError("Minimum initial liquidity is 100 USDC");
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      // Convert to micro-units (multiply by 1000 for USDC with 6 decimals stored as integers)
      const liquidityMicroUnits = liquidityAmount * 1_000_000;

      await initializeMarket(createdMarketKey, liquidityMicroUnits);
      setSuccessMessage("Market is now live with liquidity!");
      // Keep isInitializing true until navigation happens
      setTimeout(() => {
        navigate(`/market/${createdMarketKey}`);
      }, 1500);
      // Don't set isInitializing to false here - let it stay true until navigation
    } catch (error: any) {
      console.error("Failed to initialize market:", error);
      setError(
        error.response?.data?.error ||
          error.message ||
          "Failed to initialize market"
      );
      // Only set to false on error so user can retry
      setIsInitializing(false);
    }
  };

  const canProceedToOptions =
    question && expirationDate && image && selectedCategory;
  // Binary markets need exactly 1 option, multi-choice needs at least 2
  const canInitialize = isBinary ? options.length === 1 : options.length >= 2;
  // For binary markets, don't allow adding more than 1 option
  const canAddMoreOptions = !isBinary || options.length < 1;

  if (!user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary-500/20 to-primary-700/20 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-primary-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            Create a Market
          </h1>
          <p className="text-gray-400 mb-6 max-w-md">
            Connect your wallet to create prediction markets and earn creator
            fees on every trade.
          </p>
        </div>
      </div>
    );
  }

  if (isLoadingMarket) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4">
            <svg
              className="animate-spin w-full h-full text-primary-500"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <p className="text-gray-400">Loading market...</p>
        </div>
      </div>
    );
  }

  const steps = [
    { id: "details" as const, label: "Market Details", number: 1 },
    { id: "options" as const, label: "Add Options", number: 2 },
    {
      id: "review" as const,
      label: "Add Liquidity & Go Live",
      number: 3,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-900/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary-500/5 blur-[120px] rounded-full" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight">
              Create Your Market
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Launch a prediction market and earn fees on every trade
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-3 sm:gap-6">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-base transition-all ${
                      currentStep === step.id
                        ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30"
                        : steps.findIndex((s) => s.id === currentStep) > idx
                        ? "bg-success-500/20 text-success-400 border border-success-500/50"
                        : "bg-dark-800 text-gray-500 border border-dark-700"
                    }`}
                  >
                    {steps.findIndex((s) => s.id === currentStep) > idx ? (
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </div>
                  <span
                    className={`mt-1.5 text-xs font-medium hidden sm:block ${
                      currentStep === step.id
                        ? "text-primary-400"
                        : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-8 sm:w-16 h-0.5 mx-2 sm:mx-3 rounded-full transition-colors ${
                      steps.findIndex((s) => s.id === currentStep) > idx
                        ? "bg-success-500/50"
                        : "bg-dark-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Messages */}
        {successMessage && (
          <div className="mb-6 px-5 py-4 bg-success-500/10 border border-success-500/30 rounded-2xl backdrop-blur-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-success-500/20 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-success-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span className="text-success-300 font-medium">
                {successMessage}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 px-5 py-4 bg-danger-500/10 border border-danger-500/30 rounded-2xl backdrop-blur-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-danger-500/20 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-danger-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span className="text-danger-300">{error}</span>
            </div>
          </div>
        )}

        {/* Step 1: Market Details */}
        {currentStep === "details" && (
          <div className="space-y-8 animate-fade-in">
            {/* Image Upload */}
            <div className="relative group">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-300 uppercase tracking-wide">
                  Cover Image <span className="text-danger-400">*</span>
                </label>
              </div>
              <div
                className={`relative aspect-[21/9] rounded-2xl border-2 border-dashed overflow-hidden transition-all duration-300 ${
                  imagePreview
                    ? "border-transparent"
                    : "border-dark-600 hover:border-primary-500/50 bg-dark-900/50"
                }`}
              >
                {imagePreview ? (
                  <>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      loading="lazy"
                      className="w-full h-full object-cover max-w-full max-h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-950/80 via-transparent to-transparent" />
                    <button
                      onClick={() => {
                        setImage(null);
                        setImagePreview(null);
                      }}
                      className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-dark-900/80 backdrop-blur-sm text-white hover:bg-danger-500 transition-colors flex items-center justify-center"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </>
                ) : (
                  <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                    <div className="w-20 h-20 rounded-2xl bg-dark-800 flex items-center justify-center mb-4 group-hover:bg-primary-500/20 transition-colors">
                      <svg
                        className="w-10 h-10 text-gray-500 group-hover:text-primary-400 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <span className="text-lg font-medium text-gray-400 group-hover:text-white transition-colors">
                      Upload Cover Image{" "}
                      <span className="text-danger-400">*</span>
                    </span>
                    <span className="text-sm text-gray-600 mt-1">
                      PNG, JPG, or GIF (Recommended: 1200×514) - Required
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Question */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-300 uppercase tracking-wide">
                  Market Question
                </label>
                <span
                  className={`text-xs ${
                    question.length > MAX_QUESTION_LENGTH
                      ? "text-danger-400"
                      : "text-gray-500"
                  }`}
                >
                  {question.length}/{MAX_QUESTION_LENGTH}
                </span>
              </div>
              <input
                type="text"
                value={question}
                onChange={(e) => {
                  const value = e.target.value;
                  setQuestion(value);
                  // Check for banned words
                  const validation = validateTextContent(
                    value,
                    "Market question"
                  );
                  if (!validation.isValid) {
                    setQuestionError(validation.error || null);
                  } else {
                    setQuestionError(null);
                  }
                }}
                maxLength={MAX_QUESTION_LENGTH}
                className={`w-full px-5 py-3.5 bg-dark-900/50 border-2 rounded-xl text-white text-lg placeholder-gray-600 focus:ring-0 transition-colors ${
                  questionError
                    ? "border-danger-500 focus:border-danger-500"
                    : "border-dark-700 focus:border-primary-500"
                }`}
                placeholder="Will Bitcoin reach $100,000 by December 2025?"
              />
              {questionError && (
                <p className="text-sm text-danger-400 flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {questionError}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-300 uppercase tracking-wide">
                Description & Resolution Criteria
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  const value = e.target.value;
                  setDescription(value);
                  // Check for banned words
                  const validation = validateTextContent(
                    value,
                    "Market description"
                  );
                  if (!validation.isValid) {
                    setDescriptionError(validation.error || null);
                  } else {
                    setDescriptionError(null);
                  }
                }}
                rows={4}
                className={`w-full px-5 py-3.5 bg-dark-900/50 border-2 rounded-xl text-white placeholder-gray-600 focus:ring-0 transition-colors resize-none ${
                  descriptionError
                    ? "border-danger-500 focus:border-danger-500"
                    : "border-dark-700 focus:border-primary-500"
                }`}
                placeholder="Provide context for traders and explain how this market will be resolved..."
              />
              {descriptionError && (
                <p className="text-sm text-danger-400 flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {descriptionError}
                </p>
              )}
            </div>

            {/* Two Column Layout */}
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Expiration */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-300 uppercase tracking-wide">
                  Expiration Date
                </label>
                <input
                  type="datetime-local"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full px-5 py-3.5 bg-dark-900/50 border-2 border-dark-700 rounded-xl text-white focus:border-primary-500 focus:ring-0 transition-colors"
                />
              </div>

              {/* Market Type */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-300 uppercase tracking-wide">
                  Market Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIsBinary(true)}
                    className={`px-5 py-3 rounded-xl font-medium transition-all ${
                      isBinary
                        ? "bg-primary-500 text-white shadow-lg shadow-primary-500/25"
                        : "bg-dark-800 text-gray-400 border-2 border-dark-700 hover:border-primary-500/50"
                    }`}
                  >
                    Yes / No
                  </button>
                  <button
                    onClick={() => setIsBinary(false)}
                    className={`px-5 py-3 rounded-xl font-medium transition-all ${
                      !isBinary
                        ? "bg-primary-500 text-white shadow-lg shadow-primary-500/25"
                        : "bg-dark-800 text-gray-400 border-2 border-dark-700 hover:border-primary-500/50"
                    }`}
                  >
                    Multiple Choice
                  </button>
                </div>
              </div>
            </div>

            {/* Categories */}
            {categories.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-300 uppercase tracking-wide">
                    Category <span className="text-danger-400">*</span>
                  </label>
                  <span
                    className={`text-xs ${
                      selectedCategory ? "text-primary-400" : "text-gray-500"
                    }`}
                  >
                    {selectedCategory ? "1/1 selected" : "0/1 selected"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const isSelected = selectedCategory === cat.id;

                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCategory(null);
                          } else {
                            setSelectedCategory(cat.id);
                          }
                        }}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          isSelected
                            ? "bg-primary-500/20 text-primary-300 border border-primary-500/50"
                            : "bg-dark-800 text-gray-400 border border-dark-700 hover:border-primary-500/30 hover:text-white"
                        }`}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
                {!selectedCategory && (
                  <p className="text-xs text-amber-400 flex items-center gap-1.5">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Please select a category (required)
                  </p>
                )}
              </div>
            )}

            {/* Resolution Mode Selection */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-300 uppercase tracking-wide mb-1">
                  Resolution Mode
                </label>
                <p className="text-xs text-gray-500">
                  How this market will be resolved (cannot be changed)
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  ResolutionMode.ORACLE,
                  ResolutionMode.AUTHORITY,
                  ResolutionMode.OPINION,
                ].map((mode) => {
                  const modeLabels: Record<ResolutionMode, string> = {
                    [ResolutionMode.ORACLE]: "Oracle",
                    [ResolutionMode.AUTHORITY]: "Authority",
                    [ResolutionMode.OPINION]: "Opinion",
                  };

                  const modeDescriptions: Record<ResolutionMode, string> = {
                    [ResolutionMode.ORACLE]: "Platform admins resolve",
                    [ResolutionMode.AUTHORITY]: "You resolve the outcome",
                    [ResolutionMode.OPINION]: "Market price determines",
                  };

                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setResolutionMode(mode)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        resolutionMode === mode
                          ? "border-primary-500 bg-primary-500/20"
                          : "border-dark-700 bg-dark-800/50 hover:border-primary-500/50"
                      }`}
                    >
                      <div className="font-semibold text-white mb-1 text-sm">
                        {modeLabels[mode]}
                        {mode === ResolutionMode.ORACLE && (
                          <span className="ml-2 text-xs text-primary-400">
                            (Recommended)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {modeDescriptions[mode]}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Resolution Config Fields - Only for AUTHORITY mode */}
              {resolutionMode === ResolutionMode.AUTHORITY && (
                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-xs text-blue-200/90 font-semibold mb-2">
                    About Disputes
                  </p>
                  <p className="text-xs text-blue-200/70">
                    After you resolve, there's a 2-hour dispute window. Users
                    can dispute by posting a bond, which will be reviewed by
                    platform admins.
                  </p>
                </div>
              )}
            </div>

            {/* Market Creation Cost */}
            {creationFee > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-amber-300">
                      Creation Fee
                    </p>
                    {user?.wallet?.balance_usdc !== undefined && (
                      <p
                        className={`text-xs mt-0.5 ${
                          user.wallet.balance_usdc / 1_000_000 >= creationFee
                            ? "text-success-400"
                            : "text-danger-400"
                        }`}
                      >
                        Balance: {formatUSDC(user.wallet.balance_usdc)} USDC
                      </p>
                    )}
                  </div>
                  <p className="text-lg font-bold text-amber-300">
                    {isLoadingFee ? "..." : `${creationFee.toFixed(2)} USDC`}
                  </p>
                </div>
              </div>
            )}

            {/* Continue Button */}
            <div className="pt-6">
              {(() => {
                const userBalanceDisplay =
                  user?.wallet?.balance_usdc !== undefined
                    ? user.wallet.balance_usdc / 1_000_000
                    : 0;
                const hasEnoughBalance =
                  creationFee === 0 || userBalanceDisplay >= creationFee;
                const isButtonDisabled =
                  !canProceedToOptions || isCreatingMarket || !hasEnoughBalance;

                return (
                  <>
                    <button
                      onClick={handleCreateMarket}
                      disabled={isButtonDisabled}
                      className={`w-full py-4 rounded-xl font-semibold text-base transition-all ${
                        !isButtonDisabled
                          ? "bg-primary-500 text-white shadow-lg shadow-primary-500/25 hover:bg-primary-600"
                          : "bg-dark-800 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {isCreatingMarket ? (
                        <span className="flex items-center justify-center gap-3">
                          <svg
                            className="animate-spin h-6 w-6"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Creating Market...
                        </span>
                      ) : (
                        `Create Market & Add Options${
                          creationFee > 0
                            ? ` (${creationFee.toFixed(2)} USDC)`
                            : ""
                        } →`
                      )}
                    </button>
                    {!hasEnoughBalance && creationFee > 0 && (
                      <p className="mt-3 text-center text-sm text-danger-400">
                        You need {creationFee.toFixed(2)} USDC to create a
                        market
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Step 2: Add Options */}
        {currentStep === "options" && (
          <div className="space-y-8 animate-fade-in">
            {/* Market Preview Card */}
            <div className="relative rounded-2xl overflow-hidden border border-dark-700 bg-dark-900/50 backdrop-blur-sm">
              <div className="aspect-[21/9] relative bg-dark-800">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Market"
                    loading="lazy"
                    className="w-full h-full object-cover max-w-full max-h-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://placehold.co/1200x514/1a1a2e/6366f1?text=Market+Image";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-gray-500">No image</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/50 to-transparent" />
              </div>
              <div className="p-6 -mt-20 relative">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {question}
                </h2>
                <p className="text-gray-400 text-sm">
                  {description || "No description provided"}
                </p>
              </div>
            </div>

            {/* Binary Market Info */}
            {isBinary && (
              <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/30">
                <p className="text-sm text-primary-200/90">
                  <span className="font-semibold text-primary-300">
                    Binary Market:
                  </span>{" "}
                  Add one option. Traders will bet Yes or No on it.
                </p>
              </div>
            )}

            {/* Added Options */}
            {options.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                  {isBinary ? "Option" : `Options Added (${options.length})`}
                </h3>
                <div className="grid gap-3">
                  {options.map((opt, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-4 px-5 py-4 bg-dark-800/50 rounded-2xl border border-dark-700"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-700/20 flex items-center justify-center text-primary-400 font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <span className="text-white font-medium">
                          {capitalizeWords(opt.label)}
                        </span>
                        {isBinary && (
                          <p className="text-gray-500 text-sm mt-0.5">
                            Traders will bet Yes or No
                          </p>
                        )}
                      </div>
                      <div className="ml-auto">
                        <svg
                          className="w-5 h-5 text-success-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Option - hide for binary markets that already have an option */}
            {canAddMoreOptions && (
              <div className="p-5 rounded-2xl bg-dark-800/30 border-2 border-dashed border-dark-700">
                <h3 className="text-base font-semibold text-white mb-4">
                  {isBinary ? "Add Your Option" : "Add Option"}
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">
                        Option Label
                      </span>
                      <span
                        className={`text-xs ${
                          newOptionLabel.length > MAX_OPTION_LABEL_LENGTH
                            ? "text-danger-400"
                            : "text-gray-500"
                        }`}
                      >
                        {newOptionLabel.length}/{MAX_OPTION_LABEL_LENGTH}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={newOptionLabel}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewOptionLabel(value);
                        // Check for banned words
                        const validation = validateTextContent(
                          value,
                          "Option label"
                        );
                        if (!validation.isValid) {
                          setOptionLabelError(validation.error || null);
                        } else {
                          setOptionLabelError(null);
                        }
                      }}
                      maxLength={MAX_OPTION_LABEL_LENGTH}
                      className={`w-full px-5 py-3.5 bg-dark-900/50 border-2 rounded-xl text-white placeholder-gray-600 focus:ring-0 transition-colors ${
                        optionLabelError
                          ? "border-danger-500 focus:border-danger-500"
                          : "border-dark-700 focus:border-primary-500"
                      }`}
                      placeholder={
                        isBinary
                          ? "e.g., Bitcoin $100k, Trump wins, Lakers championship..."
                          : "e.g., Team A, Team B, Draw..."
                      }
                    />
                    {optionLabelError && (
                      <p className="text-sm text-danger-400 flex items-center gap-1.5 mt-2">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {optionLabelError}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <label className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-3 px-5 py-3 bg-dark-800 rounded-xl border border-dark-700 hover:border-primary-500/50 transition-colors">
                        <svg
                          className="w-5 h-5 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="text-gray-400 text-sm">
                          {newOptionImage
                            ? newOptionImage.name
                            : "Option image (optional)"}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          setNewOptionImage(e.target.files?.[0] || null)
                        }
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={handleAddOption}
                      disabled={
                        !newOptionLabel ||
                        isCreatingOption ||
                        !!optionLabelError
                      }
                      className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                        newOptionLabel && !isCreatingOption && !optionLabelError
                          ? "bg-primary-500 text-white hover:bg-primary-600"
                          : "bg-dark-700 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {isCreatingOption ? "Adding..." : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Initialize Button */}
            <div className="pt-4">
              {!canInitialize && (
                <p className="text-center text-amber-400 mb-4 flex items-center justify-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {isBinary
                    ? "Add 1 option to launch your binary market"
                    : "Add at least 2 options to launch your market"}
                </p>
              )}
              <button
                onClick={() => setCurrentStep("review")}
                disabled={!canInitialize}
                className={`w-full py-4 rounded-xl font-semibold text-base transition-all ${
                  canInitialize
                    ? "bg-success-500 text-white shadow-lg shadow-success-500/25 hover:bg-success-600"
                    : "bg-dark-800 text-gray-500 cursor-not-allowed"
                }`}
              >
                Review & Launch →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Launch */}
        {currentStep === "review" && (
          <div className="space-y-8 animate-fade-in">
            {/* Final Preview */}
            <div className="rounded-2xl overflow-hidden border border-dark-700 bg-dark-900/50 backdrop-blur-sm">
              <div className="aspect-[21/9] relative bg-dark-800">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Market"
                    loading="lazy"
                    className="w-full h-full object-cover max-w-full max-h-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://placehold.co/1200x514/1a1a2e/6366f1?text=Market+Image";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-gray-500">No image</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/50 to-transparent" />
              </div>
              <div className="p-6 -mt-20 relative">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {question}
                </h2>
                <p className="text-gray-400 mb-4">
                  {description || "No description provided"}
                </p>

                <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-dark-700">
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      Type
                    </span>
                    <p className="text-white font-medium mt-1">
                      {isBinary ? "Yes / No" : "Multiple Choice"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      Options
                    </span>
                    <p className="text-white font-medium mt-1">
                      {options.length} options
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      Expires
                    </span>
                    <p className="text-white font-medium mt-1">
                      {new Date(expirationDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Options List */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                Market Options
              </h3>
              <div className="grid gap-3">
                {options.map((opt, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 px-5 py-4 bg-dark-800/50 rounded-2xl border border-dark-700"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-lg">
                      {idx + 1}
                    </div>
                    <span className="text-white font-semibold text-lg">
                      {capitalizeWords(opt.label)}
                    </span>
                    <span className="ml-auto text-gray-500 text-sm">
                      50% starting odds
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Initial Liquidity */}
            <div className="p-5 rounded-2xl bg-primary-500/10 border border-primary-500/30">
              <h3 className="text-base font-semibold text-white mb-3">
                Initial Liquidity
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Seed the market with liquidity. You'll receive LP shares and
                earn fees from all trades.
              </p>
              <div className="relative">
                <input
                  type="number"
                  value={initialLiquidity}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "") {
                      setInitialLiquidity("");
                      return;
                    }
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                      // Round up to nearest integer
                      const rounded = Math.ceil(numValue);
                      setInitialLiquidity(String(Math.max(100, rounded)));
                    } else {
                      setInitialLiquidity(value);
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === "") {
                      setInitialLiquidity("100");
                      return;
                    }
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                      const rounded = Math.ceil(numValue);
                      setInitialLiquidity(String(Math.max(100, rounded)));
                    }
                  }}
                  min="100"
                  step="1"
                  className="w-full px-5 py-3 pr-24 bg-dark-900/50 border-2 border-dark-600 rounded-xl text-white text-lg font-semibold placeholder-gray-600 focus:border-primary-500 focus:ring-0 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="100"
                />
                <span className="absolute right-20 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                  USDC
                </span>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col border border-dark-600 rounded-md overflow-hidden bg-dark-800/50 backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseInt(initialLiquidity) || 100;
                      const newValue = Math.max(100, current + 1);
                      setInitialLiquidity(String(newValue));
                    }}
                    className="w-7 h-6 flex items-center justify-center bg-dark-800/80 hover:bg-primary-500/20 hover:border-primary-500/50 text-gray-400 hover:text-primary-400 active:bg-primary-500/30 transition-all duration-200 border-b border-dark-600/50 group"
                    aria-label="Increment"
                  >
                    <svg
                      className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseInt(initialLiquidity) || 100;
                      const newValue = Math.max(100, current - 1);
                      setInitialLiquidity(String(newValue));
                    }}
                    className="w-7 h-6 flex items-center justify-center bg-dark-800/80 hover:bg-primary-500/20 hover:border-primary-500/50 text-gray-400 hover:text-primary-400 active:bg-primary-500/30 transition-all duration-200 group"
                    aria-label="Decrement"
                  >
                    <svg
                      className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Minimum: 100 USDC</p>
            </div>

            {/* Launch Button */}
            <div className="pt-6 space-y-4">
              <button
                onClick={() => setCurrentStep("options")}
                className="w-full py-3 rounded-xl font-medium text-gray-400 bg-dark-800 border border-dark-700 hover:text-white hover:border-primary-500/50 transition-all"
              >
                ← Back to Edit Options
              </button>
              {(() => {
                const requiredAmount = parseInt(initialLiquidity) || 0;
                const userBalance = user?.wallet?.balance_usdc ?? 0;
                // balance_usdc is stored in micro-units (USDC * 1_000_000), convert to display
                const userBalanceDisplay = userBalance / 1_000_000;
                const hasEnoughBalance = userBalanceDisplay >= requiredAmount;
                const isButtonDisabled =
                  isInitializing ||
                  !initialLiquidity ||
                  requiredAmount < 100 ||
                  !hasEnoughBalance;

                return (
                  <>
                    <button
                      onClick={handleInitializeMarket}
                      disabled={isButtonDisabled || isInitializing}
                      className={`w-full py-4 rounded-xl font-semibold text-base transition-all ${
                        isInitializing
                          ? "bg-success-500/70 text-white cursor-wait"
                          : !isButtonDisabled
                          ? "bg-success-500 text-white shadow-lg shadow-success-500/25 hover:bg-success-600"
                          : "bg-dark-800 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {isInitializing ? (
                        <span className="flex items-center justify-center gap-3">
                          <svg
                            className="animate-spin h-6 w-6"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Launching Market...
                        </span>
                      ) : (
                        <>🚀 Launch Market with {initialLiquidity} USDC</>
                      )}
                    </button>
                    {!hasEnoughBalance && requiredAmount >= 100 && (
                      <div className="flex items-center justify-center gap-2 text-danger-400 text-sm">
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>
                          Insufficient balance. You have{" "}
                          <span className="font-semibold">
                            {formatUSDC(userBalance).replace("$", "")} USDC
                          </span>{" "}
                          but need at{" "}
                          <span className="font-semibold">
                            {requiredAmount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            USDC
                          </span>{" "}
                          to launch this market.
                        </span>
                      </div>
                    )}
                    {hasEnoughBalance && (
                      <p className="text-center text-gray-500 text-sm">
                        Your {initialLiquidity} USDC will seed the liquidity
                        pool. You'll earn LP fees from all trades and redeem
                        initial liquidity after the market expires.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
