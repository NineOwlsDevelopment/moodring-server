import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Keypair } from "@solana/web3.js";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useUserStore } from "@/stores/userStore";
import {
  createMarket,
  createOption,
  updateMarket,
  updateOption,
  deleteOption,
  initializeMarket,
  fetchCategories,
  fetchMarket,
  invalidateMarketCache,
  Category,
} from "@/api/api";
import { formatUSDC } from "@/utils/format";
import { ResolutionMode, ResolutionConfig } from "@/stores/resolutionStore";
import { sortCategories } from "@/utils/categorySort";
import { validateTextContent } from "@/utils/bannedWords";
import {
  compressMarketImage,
  compressOptionImage,
} from "@/utils/imageCompression";
import { ConfirmationModal } from "@/components/ConfirmationModal";

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

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
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
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
    {
      id: string | null;
      label: string;
      subLabel?: string | null;
      image: File | null;
      imageUrl?: string | null;
    }[]
  >([]);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [newOptionSubLabel, setNewOptionSubLabel] = useState("");
  const [showSubLabelInput, setShowSubLabelInput] = useState(false);
  const [newOptionImage, setNewOptionImage] = useState<File | null>(null);
  const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(
    null
  );
  const [editingOptionLabel, setEditingOptionLabel] = useState("");
  const [editingOptionSubLabel, setEditingOptionSubLabel] = useState("");
  const [showEditingSubLabelInput, setShowEditingSubLabelInput] =
    useState(false);
  const [editingOptionImage, setEditingOptionImage] = useState<File | null>(
    null
  );

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

  // Validation errors for banned words
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [optionLabelError, setOptionLabelError] = useState<string | null>(null);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [optionToDelete, setOptionToDelete] = useState<number | null>(null);

  // Load existing market if editing
  useEffect(() => {
    if (editMarketId) {
      loadExistingMarket(editMarketId);
    } else {
      // Clear form state when creating a new market
      setSelectedCategory([]);
    }
  }, [editMarketId]);

  // Auto-select Politics category when creating a new market
  useEffect(() => {
    if (
      !editMarketId &&
      categories.length > 0 &&
      selectedCategory.length === 0
    ) {
      const politicsCategory = categories.find(
        (cat) => cat.name.toLowerCase() === "politics"
      );
      if (politicsCategory) {
        setSelectedCategory([politicsCategory.id]);
      }
    }
  }, [categories, editMarketId, selectedCategory.length]);

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
            id: opt.id,
            label: opt.option_label,
            subLabel: opt.option_sub_label || null,
            image: null, // Can't recover the file object
            imageUrl: opt.option_image_url || null,
          }))
        );
      }

      // Load existing category (take the first one if multiple exist)
      if (
        (market as any).categories &&
        Array.isArray((market as any).categories) &&
        (market as any).categories.length > 0
      ) {
        setSelectedCategory([(market as any).categories[0].id]);
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
  }, []);

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

  // Prefill option label with "binary" for binary markets when entering options step
  const prevStepRef = useRef<Step>("details");
  useEffect(() => {
    // Only prefill when transitioning TO the options step (not on every render)
    if (
      currentStep === "options" &&
      prevStepRef.current !== "options" &&
      isBinary &&
      !newOptionLabel &&
      options.length === 0
    ) {
      setNewOptionLabel("binary");
    }
    prevStepRef.current = currentStep;
  }, [currentStep, isBinary, newOptionLabel, options.length]);

  const loadCategories = async () => {
    try {
      const { categories: cats } = await fetchCategories();
      const sortedCategories = sortCategories(cats);
      setCategories(sortedCategories);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Compress image before setting it
        const compressedFile = await compressMarketImage(file);
        setImage(compressedFile);
      } catch (error) {
        console.error("Failed to compress image:", error);
        toast.error("Failed to process image. Using original file.");
        // Fallback to original file if compression fails
        setImage(file);
      }
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

    // If market already exists, update it instead of creating
    if (createdMarketKey) {
      setIsCreatingMarket(true);
      setError(null);

      try {
        const expirationTimestamp = Math.floor(
          new Date(expirationDate).getTime() / 1000
        );

        await updateMarket({
          marketId: createdMarketKey,
          marketQuestion: question,
          marketDescription: description,
          marketExpirationDate: expirationTimestamp,
          categoryIds: selectedCategory ? selectedCategory : [],
          image,
        });

        setSuccessMessage("Market details updated successfully!");
        setTimeout(() => setSuccessMessage(null), 3000);
        setCurrentStep("options");
      } catch (error: any) {
        console.error("Failed to update market:", error);
        const errorMessage =
          error.response?.data?.error ||
          error.message ||
          "Failed to update market";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsCreatingMarket(false);
      }
      return;
    }

    // Check if user has sufficient balance for minimum liquidity requirement
    const requiredLiquidity = parseInt(initialLiquidity) || 100;
    if (user?.wallet?.balance_usdc !== undefined) {
      const userBalanceDisplay = user.wallet.balance_usdc / 1_000_000; // Convert microUSDC to USDC
      if (userBalanceDisplay < requiredLiquidity) {
        const formattedBalance = formatUSDC(user.wallet.balance_usdc).replace(
          "$",
          ""
        );
        const errorMsg = `Insufficient balance. You need at least ${requiredLiquidity} USDC for initial liquidity, but you have ${formattedBalance} USDC`;
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

      const { market } = await createMarket({
        base: baseKeypair.publicKey.toBase58(),
        marketQuestion: question,
        marketDescription: description,
        marketExpirationDate: expirationTimestamp,
        usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        isBinary,
        categoryIds: selectedCategory ? selectedCategory : [],
        image,
        resolutionMode,
      });

      setCreatedMarketKey(market);
      setSuccessMessage("Market created successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);

      // For binary markets, automatically created option is already on the backend
      // Fetch the market to get the automatically created option and skip options step
      if (isBinary) {
        try {
          // Invalidate cache to ensure we get fresh data with the automatically created option
          invalidateMarketCache(market);
          const { market: createdMarket } = await fetchMarket(market);
          if (createdMarket.options && createdMarket.options.length > 0) {
            setOptions(
              createdMarket.options.map((opt: any) => ({
                id: opt.id,
                label: opt.option_label,
                subLabel: opt.option_sub_label || null,
                image: null,
                imageUrl: opt.option_image_url || null,
              }))
            );
          }
          // Skip options step and go directly to review for binary markets
          setCurrentStep("review");
        } catch (error) {
          console.error("Failed to fetch created market:", error);
          // Fallback to options step if fetch fails
          setCurrentStep("options");
        }
      } else {
        // For non-binary markets, go to options step as before
        setCurrentStep("options");
      }
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
      const { option } = await createOption({
        market: createdMarketKey,
        optionLabel: newOptionLabel,
        optionSubLabel: newOptionSubLabel.trim() || undefined,
        image: newOptionImage || undefined,
      });

      setOptions([
        ...options,
        {
          id: option,
          label: newOptionLabel,
          subLabel: newOptionSubLabel.trim() || null,
          image: newOptionImage,
        },
      ]);
      setNewOptionLabel("");
      setNewOptionSubLabel("");
      setShowSubLabelInput(false);
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

  const handleEditOption = (index: number) => {
    const option = options[index];
    setEditingOptionIndex(index);
    setEditingOptionLabel(option.label);
    const subLabel = option.subLabel || "";
    setEditingOptionSubLabel(subLabel);
    setShowEditingSubLabelInput(!!subLabel);
    setEditingOptionImage(null);
  };

  const handleSaveOption = async () => {
    if (editingOptionIndex === null || !editingOptionLabel) {
      return;
    }

    const option = options[editingOptionIndex];
    if (!option.id) {
      setError("Cannot edit option that hasn't been saved yet");
      return;
    }

    // Validate for banned words
    const optionValidation = validateTextContent(
      editingOptionLabel,
      "Option label"
    );
    if (!optionValidation.isValid) {
      setError(optionValidation.error || "Invalid content in option label");
      return;
    }

    setIsCreatingOption(true);
    setError(null);

    try {
      await updateOption({
        optionId: option.id,
        optionLabel: editingOptionLabel,
        optionSubLabel: editingOptionSubLabel.trim() || null,
        image: editingOptionImage || undefined,
      });

      const updatedOptions = [...options];
      updatedOptions[editingOptionIndex] = {
        ...option,
        label: editingOptionLabel,
        subLabel: editingOptionSubLabel.trim() || null,
        image: editingOptionImage || option.image,
      };
      setOptions(updatedOptions);
      setEditingOptionIndex(null);
      setEditingOptionLabel("");
      setEditingOptionSubLabel("");
      setShowEditingSubLabelInput(false);
      setEditingOptionImage(null);
      setSuccessMessage("Option updated!");
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (error: any) {
      console.error("Failed to update option:", error);
      setError(
        error.response?.data?.error ||
          error.message ||
          "Failed to update option"
      );
    } finally {
      setIsCreatingOption(false);
    }
  };

  const handleDeleteOption = async (index: number) => {
    const option = options[index];
    if (!option.id) {
      // If option hasn't been saved yet, just remove it from local state
      setOptions(options.filter((_, i) => i !== index));
      return;
    }

    // Show confirmation modal
    setOptionToDelete(index);
    setShowDeleteModal(true);
  };

  const confirmDeleteOption = async () => {
    if (optionToDelete === null) return;

    const index = optionToDelete;
    const option = options[index];

    setShowDeleteModal(false);
    setOptionToDelete(null);

    setIsCreatingOption(true);
    setError(null);

    try {
      await deleteOption(option.id!);
      setOptions(options.filter((_, i) => i !== index));
      setSuccessMessage("Option deleted!");
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (error: any) {
      console.error("Failed to delete option:", error);
      setError(
        error.response?.data?.error ||
          error.message ||
          "Failed to delete option"
      );
    } finally {
      setIsCreatingOption(false);
    }
  };

  const handleInitializeMarket = async () => {
    if (!createdMarketKey) return;

    // Validate liquidity amount before submitting
    if (!initialLiquidity || initialLiquidity.trim() === "") {
      setError("Please enter an initial liquidity amount");
      return;
    }

    const liquidityAmount = parseFloat(initialLiquidity);

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
      <div className="min-h-[80vh] flex items-center justify-center bg-ink-black">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="w-20 h-20 mx-auto mb-8 border border-white/10 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-neon-iris/60"
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
          <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight text-white mb-4">
            Create a Market
          </h1>
          <p className="text-moon-grey/60 mb-8 max-w-md font-light">
            Connect your wallet to create prediction markets and earn creator
            fees on every trade.
          </p>
        </motion.div>
      </div>
    );
  }

  if (isLoadingMarket) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-ink-black">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-6 border border-white/10 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="w-6 h-6 border-2 border-neon-iris/30 border-t-neon-iris rounded-full"
            />
          </div>
          <p className="text-moon-grey/50 text-sm tracking-wide uppercase">
            Loading market...
          </p>
        </div>
      </div>
    );
  }

  const steps = [
    { id: "details" as const, label: "Market Details", number: 1 },
    { id: "options" as const, label: "Add Options", number: 2 },
    {
      id: "review" as const,
      label: "Review & Go Live",
      number: 3,
    },
  ];

  return (
    <div className="min-h-screen bg-ink-black overflow-hidden">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(33,246,210,0.06),transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.02] hidden sm:block"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/30 to-transparent" />

      {/* Hero Section */}
      <section className="relative pt-12 sm:pt-16 lg:pt-20 pb-8 sm:pb-12 border-b border-white/5">
        <div className="section-container">
          <motion.div
            className="text-center mb-10 sm:mb-14"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
              <div className="h-px w-8 sm:w-12 bg-gradient-to-r from-transparent to-neon-iris/60" />
              <span className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-moon-grey/70 font-medium">
                Market Creator
              </span>
              <div className="h-px w-8 sm:w-12 bg-gradient-to-l from-transparent to-neon-iris/60" />
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extralight tracking-tight text-white mb-4 sm:mb-6">
              Create Your Market
            </h1>
            <p className="text-base sm:text-lg text-moon-grey/60 max-w-xl mx-auto font-light">
              Launch a prediction market and earn fees on every trade
            </p>
          </motion.div>

          {/* Progress Steps */}
          <motion.div
            className="flex items-center justify-center gap-4 sm:gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center font-light text-base transition-all duration-300 ${
                      currentStep === step.id
                        ? "bg-neon-iris/20 text-neon-iris border border-neon-iris/50"
                        : steps.findIndex((s) => s.id === currentStep) > idx
                        ? "bg-aqua-pulse/10 text-aqua-pulse border border-aqua-pulse/30"
                        : "bg-white/[0.02] text-moon-grey/50 border border-white/10"
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
                      <span className="text-lg">{step.number}</span>
                    )}
                  </div>
                  <span
                    className={`mt-2 sm:mt-3 text-[10px] sm:text-xs tracking-[0.15em] uppercase hidden sm:block transition-colors ${
                      currentStep === step.id
                        ? "text-neon-iris/80"
                        : "text-moon-grey/40"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-12 sm:w-20 h-px mx-3 sm:mx-4 transition-colors ${
                      steps.findIndex((s) => s.id === currentStep) > idx
                        ? "bg-aqua-pulse/40"
                        : "bg-white/10"
                    }`}
                  />
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="relative py-10 sm:py-16">
        <div className="section-container max-w-4xl">
          {/* Messages */}
          {successMessage && (
            <motion.div
              className="mb-8 px-6 py-4 bg-aqua-pulse/5 border border-aqua-pulse/20"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 border border-aqua-pulse/30 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-aqua-pulse"
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
                <span className="text-aqua-pulse/90 font-light">
                  {successMessage}
                </span>
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div
              className="mb-8 px-6 py-4 bg-red-500/5 border border-red-500/20"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 border border-red-500/30 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-red-400"
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
                <span className="text-red-400/90 font-light">{error}</span>
              </div>
            </motion.div>
          )}

          {/* Step 1: Market Details */}
          {currentStep === "details" && (
            <motion.div
              className="space-y-10"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {/* Image Upload */}
              <motion.div className="relative group" variants={fadeInUp}>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/70 font-medium">
                    Cover Image <span className="text-red-400">*</span>
                  </label>
                </div>
                <div
                  className={`relative aspect-[21/9] border overflow-hidden transition-all duration-300 ${
                    imagePreview
                      ? "border-white/10"
                      : "border-dashed border-white/20 hover:border-neon-iris/40 bg-white/[0.02]"
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
                      <div className="absolute inset-0 bg-gradient-to-t from-ink-black/80 via-transparent to-transparent" />
                      <button
                        onClick={() => {
                          setImage(null);
                          setImagePreview(null);
                        }}
                        className="absolute top-4 right-4 w-10 h-10 bg-ink-black/80 backdrop-blur-sm text-white/70 hover:text-white hover:bg-red-500/80 transition-all flex items-center justify-center border border-white/10"
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
                            strokeWidth={1.5}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer px-4 sm:px-6 py-4">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 border border-white/10 flex items-center justify-center mb-4 sm:mb-5 group-hover:border-neon-iris/40 group-hover:bg-neon-iris/5 transition-all flex-shrink-0">
                        <svg
                          className="w-7 h-7 sm:w-8 sm:h-8 text-moon-grey/40 group-hover:text-neon-iris/70 transition-colors"
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
                      <span className="text-sm sm:text-base font-light text-moon-grey/60 group-hover:text-white transition-colors text-center">
                        Upload Cover Image
                      </span>
                      <span className="text-[10px] sm:text-xs text-moon-grey/40 mt-2 text-center">
                        PNG, JPG, or GIF • 1200×514 recommended
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
              </motion.div>

              {/* Question */}
              <motion.div className="space-y-4" variants={fadeInUp}>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/70 font-medium">
                    Market Question
                  </label>
                  <span
                    className={`text-[10px] sm:text-xs ${
                      question.length > MAX_QUESTION_LENGTH
                        ? "text-red-400"
                        : "text-moon-grey/40"
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
                  className={`w-full px-5 py-4 bg-white/[0.02] border text-white text-base sm:text-lg font-light placeholder-moon-grey/30 focus:ring-0 focus:outline-none transition-colors ${
                    questionError
                      ? "border-red-500/50 focus:border-red-500"
                      : "border-white/10 focus:border-neon-iris/50"
                  }`}
                  placeholder="Will Bitcoin reach $100,000 by December 2025?"
                />
                {questionError && (
                  <p className="text-xs text-red-400 flex items-center gap-2">
                    <svg
                      className="w-3.5 h-3.5"
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
              </motion.div>

              {/* Description */}
              <motion.div className="space-y-4" variants={fadeInUp}>
                <label className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/70 font-medium">
                  Description & Resolution Criteria
                </label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDescription(value);
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
                  className={`w-full px-5 py-4 bg-white/[0.02] border text-white font-light placeholder-moon-grey/30 focus:ring-0 focus:outline-none transition-colors resize-none ${
                    descriptionError
                      ? "border-red-500/50 focus:border-red-500"
                      : "border-white/10 focus:border-neon-iris/50"
                  }`}
                  placeholder="Provide context for traders and explain how this market will be resolved..."
                />
                {descriptionError && (
                  <p className="text-xs text-red-400 flex items-center gap-2">
                    <svg
                      className="w-3.5 h-3.5"
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
              </motion.div>

              {/* Two Column Layout */}
              <motion.div
                className="grid sm:grid-cols-2 gap-8"
                variants={fadeInUp}
              >
                {/* Expiration */}
                <div className="space-y-4">
                  <label className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/70 font-medium">
                    Expiration Date
                  </label>
                  <input
                    type="datetime-local"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full px-5 py-4 bg-white/[0.02] border border-white/10 text-white focus:border-neon-iris/50 focus:ring-0 focus:outline-none transition-colors"
                  />
                </div>

                {/* Market Type */}
                <div className="space-y-4">
                  <label className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/70 font-medium">
                    Market Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsBinary(true)}
                      className={`px-5 py-3.5 font-light text-sm transition-all ${
                        isBinary
                          ? "bg-neon-iris/20 text-neon-iris border border-neon-iris/50"
                          : "bg-white/[0.02] text-moon-grey/60 border border-white/10 hover:border-white/20"
                      }`}
                    >
                      Yes / No
                    </button>
                    <button
                      onClick={() => setIsBinary(false)}
                      className={`px-5 py-3.5 font-light text-sm transition-all ${
                        !isBinary
                          ? "bg-neon-iris/20 text-neon-iris border border-neon-iris/50"
                          : "bg-white/[0.02] text-moon-grey/60 border border-white/10 hover:border-white/20"
                      }`}
                    >
                      Multiple Choice
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Categories */}
              {categories.length > 0 && (
                <motion.div className="space-y-4" variants={fadeInUp}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/70 font-medium">
                      Category <span className="text-red-400">*</span>
                    </label>
                    <span
                      className={`text-[10px] sm:text-xs ${
                        selectedCategory.length > 0
                          ? "text-neon-iris/70"
                          : "text-moon-grey/40"
                      }`}
                    >
                      {selectedCategory.length > 0
                        ? "1/1 selected"
                        : "0/1 selected"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {categories.map((cat) => {
                      const isSelected = selectedCategory.includes(cat.id);

                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCategory([]);
                            } else {
                              setSelectedCategory([cat.id]);
                            }
                          }}
                          className={`px-4 py-2.5 text-sm font-light transition-all ${
                            isSelected
                              ? "bg-neon-iris/15 text-neon-iris border border-neon-iris/40"
                              : "bg-white/[0.02] text-moon-grey/60 border border-white/10 hover:border-white/20 hover:text-white"
                          }`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                  {selectedCategory.length === 0 && (
                    <p className="text-[10px] sm:text-xs text-amber-400/70 flex items-center gap-2">
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
                </motion.div>
              )}

              {/* Resolution Mode Selection */}
              <motion.div className="space-y-4" variants={fadeInUp}>
                <div>
                  <label className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/70 font-medium">
                    Resolution Mode
                  </label>
                  <p className="text-[10px] sm:text-xs text-moon-grey/40 mt-1">
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
                        className={`p-4 sm:p-5 border text-left transition-all ${
                          resolutionMode === mode
                            ? "border-neon-iris/50 bg-neon-iris/10"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20"
                        }`}
                      >
                        <div className="font-light text-white mb-1 text-sm">
                          {modeLabels[mode]}
                          {mode === ResolutionMode.ORACLE && (
                            <span className="ml-2 text-[10px] text-neon-iris/70">
                              Recommended
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] sm:text-xs text-moon-grey/50">
                          {modeDescriptions[mode]}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Resolution Config Fields - Only for AUTHORITY mode */}
                {resolutionMode === ResolutionMode.AUTHORITY && (
                  <div className="mt-4 p-5 bg-blue-500/5 border border-blue-500/20">
                    <p className="text-xs text-blue-300/80 font-medium mb-2">
                      About Disputes
                    </p>
                    <p className="text-[10px] sm:text-xs text-blue-200/50 font-light">
                      After you resolve, there's a 2-hour dispute window. Users
                      can dispute by posting a bond, which will be reviewed by
                      platform admins.
                    </p>
                  </div>
                )}
              </motion.div>

              {/* Initial Liquidity */}
              <motion.div
                className="p-6 sm:p-8 bg-neon-iris/5 border border-neon-iris/20"
                variants={fadeInUp}
              >
                <h3 className="text-lg sm:text-xl font-light text-white mb-3">
                  Initial Liquidity
                </h3>
                <p className="text-sm text-moon-grey/60 mb-6 font-light">
                  Seed the market with liquidity to launch it. You'll receive LP
                  shares and earn fees from all trades. Minimum: 100 USDC
                </p>
                <div className="relative">
                  <input
                    type="number"
                    value={initialLiquidity}
                    onChange={(e) => {
                      const value = e.target.value;
                      setInitialLiquidity(value);
                    }}
                    min="100"
                    step="1"
                    className="w-full px-5 py-4 pr-28 bg-white/[0.02] border border-white/10 text-white text-lg sm:text-xl font-light placeholder-moon-grey/30 focus:border-neon-iris/50 focus:ring-0 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="100"
                  />
                  <span className="absolute right-20 top-1/2 -translate-y-1/2 text-moon-grey/50 font-light">
                    USDC
                  </span>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col border border-white/10 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseInt(initialLiquidity) || 100;
                        const newValue = Math.max(100, current + 1);
                        setInitialLiquidity(String(newValue));
                      }}
                      className="w-7 h-6 flex items-center justify-center bg-white/[0.02] hover:bg-neon-iris/10 text-moon-grey/50 hover:text-neon-iris transition-all border-b border-white/10"
                      aria-label="Increment"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
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
                      className="w-7 h-6 flex items-center justify-center bg-white/[0.02] hover:bg-neon-iris/10 text-moon-grey/50 hover:text-neon-iris transition-all"
                      aria-label="Decrement"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                {user?.wallet?.balance_usdc !== undefined && (
                  <p
                    className={`text-xs mt-3 ${
                      user.wallet.balance_usdc / 1_000_000 >=
                      (parseInt(initialLiquidity) || 100)
                        ? "text-aqua-pulse/80"
                        : "text-red-400/80"
                    }`}
                  >
                    Your balance: {formatUSDC(user.wallet.balance_usdc)} USDC
                  </p>
                )}
              </motion.div>

              {/* Continue Button */}
              <motion.div className="pt-8" variants={fadeInUp}>
                {(() => {
                  const userBalanceDisplay =
                    user?.wallet?.balance_usdc !== undefined
                      ? user.wallet.balance_usdc / 1_000_000
                      : 0;
                  const requiredLiquidity = parseInt(initialLiquidity) || 100;
                  const hasEnoughBalance =
                    userBalanceDisplay >= requiredLiquidity;
                  const isLiquidityValid = requiredLiquidity >= 100;
                  const isButtonDisabled =
                    !canProceedToOptions ||
                    isCreatingMarket ||
                    !hasEnoughBalance ||
                    !isLiquidityValid;

                  return (
                    <>
                      <button
                        onClick={handleCreateMarket}
                        disabled={isButtonDisabled}
                        className={`group w-full py-4 sm:py-5 text-sm font-medium tracking-wide uppercase transition-all duration-300 inline-flex items-center justify-center gap-3 ${
                          !isButtonDisabled
                            ? "bg-white text-ink-black hover:bg-moon-grey-light"
                            : "bg-white/10 text-moon-grey/40 cursor-not-allowed"
                        }`}
                      >
                        {isCreatingMarket ? (
                          <span className="flex items-center justify-center gap-3">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                              className="w-5 h-5 border-2 border-ink-black/30 border-t-ink-black rounded-full"
                            />
                            {createdMarketKey
                              ? "Updating Market..."
                              : "Creating Market..."}
                          </span>
                        ) : (
                          <>
                            <span>
                              {createdMarketKey ? "Update" : "Create"} Market &
                              Add Options
                            </span>
                            <svg
                              className="w-4 h-4 transition-transform group-hover:translate-x-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M17 8l4 4m0 0l-4 4m4-4H3"
                              />
                            </svg>
                          </>
                        )}
                      </button>
                      {!hasEnoughBalance && !createdMarketKey && (
                        <p className="mt-4 text-center text-xs text-red-400/80">
                          You need at least {requiredLiquidity} USDC for initial
                          liquidity
                        </p>
                      )}
                      {!isLiquidityValid && (
                        <p className="mt-4 text-center text-xs text-red-400/80">
                          Minimum initial liquidity is 100 USDC
                        </p>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            </motion.div>
          )}

          {/* Step 2: Add Options */}
          {currentStep === "options" && (
            <motion.div
              className="space-y-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              {/* Market Preview Card */}
              <div className="relative overflow-hidden border border-white/10 bg-graphite-deep/50">
                <div className="aspect-[21/9] relative bg-ink-black">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Market"
                      loading="lazy"
                      className="w-full h-full object-cover max-w-full max-h-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://placehold.co/1200x514/0a0a0f/7c4dff?text=Market+Image";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-moon-grey/30">No image</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-black via-ink-black/60 to-transparent" />
                </div>
                <div className="p-6 sm:p-8 -mt-20 relative">
                  <h2 className="text-xl sm:text-2xl font-light text-white mb-3">
                    {question}
                  </h2>
                  <p className="text-moon-grey/50 text-sm font-light">
                    {description || "No description provided"}
                  </p>
                </div>
              </div>

              {/* Binary Market Info */}
              {isBinary && (
                <div className="p-5 bg-neon-iris/5 border border-neon-iris/20">
                  <p className="text-sm text-moon-grey/70 font-light">
                    <span className="text-neon-iris/80">Binary Market:</span>{" "}
                    Add one option. Traders will bet Yes or No on it.
                  </p>
                </div>
              )}

              {/* Added Options */}
              {options.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/70 font-medium">
                    {isBinary ? "Option" : `Options Added (${options.length})`}
                  </h3>
                  <div className="grid gap-3">
                    {options.map((opt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-4 px-5 sm:px-6 py-4 sm:py-5 bg-white/[0.02] border border-white/10"
                      >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 border border-neon-iris/30 bg-neon-iris/5 flex items-center justify-center text-neon-iris/80 font-light text-lg">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          {editingOptionIndex === idx ? (
                            <div className="space-y-4">
                              <input
                                type="text"
                                value={editingOptionLabel}
                                onChange={(e) =>
                                  setEditingOptionLabel(e.target.value)
                                }
                                maxLength={MAX_OPTION_LABEL_LENGTH}
                                className="w-full px-4 py-3 bg-white/[0.02] border border-neon-iris/50 text-white placeholder-moon-grey/30 focus:ring-0 focus:outline-none"
                                placeholder="Option label"
                              />
                              <div className="border border-white/10 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowEditingSubLabelInput(
                                      !showEditingSubLabelInput
                                    )
                                  }
                                  className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-light text-moon-grey/70">
                                      Sub-label
                                    </span>
                                    <span className="text-[10px] text-moon-grey/40">
                                      (Optional)
                                    </span>
                                  </div>
                                  <svg
                                    className={`w-4 h-4 text-moon-grey/40 transition-transform ${
                                      showEditingSubLabelInput
                                        ? "rotate-180"
                                        : ""
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={1.5}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </button>
                                {showEditingSubLabelInput && (
                                  <div className="p-4 bg-white/[0.01] border-t border-white/10">
                                    <div className="flex items-center justify-between mb-2">
                                      <label className="text-[10px] text-moon-grey/50">
                                        Add additional context
                                      </label>
                                      <span className="text-[10px] text-moon-grey/40">
                                        {editingOptionSubLabel.length}/100
                                      </span>
                                    </div>
                                    <input
                                      type="text"
                                      value={editingOptionSubLabel}
                                      onChange={(e) =>
                                        setEditingOptionSubLabel(e.target.value)
                                      }
                                      maxLength={100}
                                      className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 text-white placeholder-moon-grey/30 focus:ring-0 focus:outline-none focus:border-neon-iris/50 transition-colors"
                                      placeholder="e.g., Republican, Democratic, Independent..."
                                      autoFocus
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="space-y-3">
                                {(editingOptionImage || opt.imageUrl) && (
                                  <div className="relative w-28 h-28 overflow-hidden border border-white/10">
                                    <img
                                      src={
                                        editingOptionImage
                                          ? URL.createObjectURL(
                                              editingOptionImage
                                            )
                                          : opt.imageUrl || ""
                                      }
                                      alt="Option preview"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors">
                                    <svg
                                      className="w-4 h-4 text-moon-grey/40"
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
                                    <span className="text-moon-grey/50 text-sm font-light">
                                      {editingOptionImage
                                        ? editingOptionImage.name
                                        : opt.imageUrl
                                        ? "Change image"
                                        : "Option image (optional)"}
                                    </span>
                                  </div>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        try {
                                          const compressedFile =
                                            await compressOptionImage(file);
                                          setEditingOptionImage(compressedFile);
                                        } catch (error) {
                                          console.error(
                                            "Failed to compress image:",
                                            error
                                          );
                                          toast.error(
                                            "Failed to process image. Using original file."
                                          );
                                          setEditingOptionImage(file);
                                        }
                                      } else {
                                        setEditingOptionImage(null);
                                      }
                                    }}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                              <div className="flex gap-3">
                                <button
                                  onClick={handleSaveOption}
                                  disabled={isCreatingOption}
                                  className="px-4 py-2 bg-white text-ink-black text-sm font-medium hover:bg-moon-grey-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isCreatingOption ? "Saving..." : "Save"}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingOptionIndex(null);
                                    setEditingOptionLabel("");
                                    setEditingOptionSubLabel("");
                                    setShowEditingSubLabelInput(false);
                                    setEditingOptionImage(null);
                                  }}
                                  disabled={isCreatingOption}
                                  className="px-4 py-2 bg-white/[0.02] text-moon-grey/60 border border-white/10 text-sm font-light hover:border-white/20 transition-colors disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-4">
                              {(opt.image || opt.imageUrl) && (
                                <div className="relative w-14 h-14 overflow-hidden border border-white/10 flex-shrink-0">
                                  <img
                                    src={
                                      opt.image
                                        ? URL.createObjectURL(opt.image)
                                        : opt.imageUrl || ""
                                    }
                                    alt={opt.label}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (
                                        e.target as HTMLImageElement
                                      ).style.display = "none";
                                    }}
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="text-white font-light">
                                  {opt.label}
                                </span>
                                {opt.subLabel && (
                                  <div className="text-moon-grey/50 text-sm mt-1 font-light">
                                    {opt.subLabel}
                                  </div>
                                )}
                                {isBinary && (
                                  <p className="text-moon-grey/40 text-xs mt-1">
                                    Traders will bet Yes or No
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        {editingOptionIndex !== idx && (
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              onClick={() => handleEditOption(idx)}
                              className="p-2.5 bg-white/[0.02] border border-white/10 text-moon-grey/50 hover:text-neon-iris hover:border-neon-iris/30 transition-all"
                              title="Edit option"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteOption(idx)}
                              className="p-2.5 bg-white/[0.02] border border-white/10 text-moon-grey/50 hover:text-red-400 hover:border-red-500/30 transition-all"
                              title="Delete option"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Option - hide for binary markets that already have an option */}
              {canAddMoreOptions && (
                <div className="p-6 sm:p-8 bg-graphite-deep/50 border border-white/10">
                  <h3 className="text-lg sm:text-xl font-light text-white mb-6">
                    {isBinary ? "Add Your Option" : "Add New Option"}
                  </h3>
                  <div className="space-y-6">
                    {/* Option Label */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/70 font-medium">
                          Option Label <span className="text-red-400">*</span>
                        </label>
                        <span
                          className={`text-[10px] sm:text-xs ${
                            newOptionLabel.length > MAX_OPTION_LABEL_LENGTH
                              ? "text-red-400"
                              : "text-moon-grey/40"
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
                        className={`w-full px-5 py-4 bg-white/[0.02] border text-white font-light placeholder-moon-grey/30 focus:ring-0 focus:outline-none transition-colors ${
                          optionLabelError
                            ? "border-red-500/50 focus:border-red-500"
                            : "border-white/10 focus:border-neon-iris/50"
                        }`}
                        placeholder={
                          isBinary
                            ? "e.g., Bitcoin $100k, Trump wins, Lakers championship..."
                            : "e.g., Gavin Newsom, JD Vance, ..."
                        }
                      />
                      {optionLabelError && (
                        <p className="text-xs text-red-400 flex items-center gap-2 mt-2">
                          <svg
                            className="w-3.5 h-3.5"
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

                    {/* Sub-label Accordion */}
                    <div className="border border-white/10 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowSubLabelInput(!showSubLabelInput)}
                        className="w-full flex items-center justify-between px-5 py-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-light text-moon-grey/70">
                            Sub-label
                          </span>
                          <span className="text-[10px] text-moon-grey/40">
                            (Optional)
                          </span>
                        </div>
                        <svg
                          className={`w-4 h-4 text-moon-grey/40 transition-transform ${
                            showSubLabelInput ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      {showSubLabelInput && (
                        <div className="p-5 bg-white/[0.01] border-t border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] text-moon-grey/50">
                              Add additional context
                            </label>
                            <span className="text-[10px] text-moon-grey/40">
                              {newOptionSubLabel.length}/100
                            </span>
                          </div>
                          <input
                            type="text"
                            value={newOptionSubLabel}
                            onChange={(e) =>
                              setNewOptionSubLabel(e.target.value)
                            }
                            maxLength={100}
                            className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 text-white placeholder-moon-grey/30 focus:ring-0 focus:outline-none focus:border-neon-iris/50 transition-colors"
                            placeholder="e.g., Republican, Democratic, Independent..."
                            autoFocus
                          />
                        </div>
                      )}
                    </div>

                    {/* Image Upload */}
                    <div>
                      {newOptionImage && (
                        <div className="relative w-full mb-4 overflow-hidden border border-white/10">
                          <img
                            src={URL.createObjectURL(newOptionImage)}
                            alt="Option preview"
                            className="w-full h-40 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setNewOptionImage(null)}
                            className="absolute top-3 right-3 p-2 bg-ink-black/80 backdrop-blur-sm text-white/70 hover:text-white hover:bg-red-500/80 transition-all border border-white/10"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                      <label className="cursor-pointer block">
                        <div className="flex items-center gap-3 px-5 py-4 bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors">
                          <svg
                            className="w-5 h-5 text-moon-grey/40"
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
                          <span className="text-sm text-moon-grey/50 font-light">
                            {newOptionImage
                              ? "Change image"
                              : "Option image (optional)"}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const compressedFile =
                                  await compressOptionImage(file);
                                setNewOptionImage(compressedFile);
                              } catch (error) {
                                console.error(
                                  "Failed to compress image:",
                                  error
                                );
                                toast.error(
                                  "Failed to process image. Using original file."
                                );
                                setNewOptionImage(file);
                              }
                            } else {
                              setNewOptionImage(null);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Add Button */}
                    <button
                      onClick={handleAddOption}
                      disabled={
                        !newOptionLabel ||
                        isCreatingOption ||
                        !!optionLabelError
                      }
                      className={`w-full py-4 text-sm font-medium tracking-wide uppercase transition-all ${
                        newOptionLabel && !isCreatingOption && !optionLabelError
                          ? "bg-neon-iris/20 text-neon-iris border border-neon-iris/40 hover:bg-neon-iris/30"
                          : "bg-white/[0.02] text-moon-grey/30 border border-white/10 cursor-not-allowed"
                      }`}
                    >
                      {isCreatingOption ? (
                        <span className="flex items-center justify-center gap-3">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className="w-4 h-4 border-2 border-neon-iris/30 border-t-neon-iris rounded-full"
                          />
                          Adding Option...
                        </span>
                      ) : (
                        "Add Option"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="pt-8 space-y-4">
                <button
                  onClick={() => setCurrentStep("details")}
                  className="w-full py-3.5 font-light text-moon-grey/60 bg-white/[0.02] border border-white/10 hover:text-white hover:border-white/20 transition-all"
                >
                  ← Back to Market Details
                </button>
                {!canInitialize && (
                  <p className="text-center text-amber-400/70 text-sm flex items-center justify-center gap-2">
                    <svg
                      className="w-4 h-4"
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
                  className={`group w-full py-4 sm:py-5 text-sm font-medium tracking-wide uppercase transition-all inline-flex items-center justify-center gap-3 ${
                    canInitialize
                      ? "bg-aqua-pulse/20 text-aqua-pulse border border-aqua-pulse/40 hover:bg-aqua-pulse/30"
                      : "bg-white/[0.02] text-moon-grey/30 border border-white/10 cursor-not-allowed"
                  }`}
                >
                  <span>Review & Launch</span>
                  <svg
                    className="w-4 h-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Review & Launch */}
          {currentStep === "review" && (
            <motion.div
              className="space-y-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              {/* Final Preview */}
              <div className="overflow-hidden border border-white/10 bg-graphite-deep/50">
                <div className="aspect-[21/9] relative bg-ink-black">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Market"
                      loading="lazy"
                      className="w-full h-full object-cover max-w-full max-h-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://placehold.co/1200x514/0a0a0f/7c4dff?text=Market+Image";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-moon-grey/30">No image</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-black via-ink-black/60 to-transparent" />
                </div>
                <div className="p-6 sm:p-8 -mt-20 relative">
                  <h2 className="text-xl sm:text-2xl font-light text-white mb-3">
                    {question}
                  </h2>
                  <p className="text-moon-grey/50 mb-6 font-light">
                    {description || "No description provided"}
                  </p>

                  <div className="grid sm:grid-cols-3 gap-6 pt-6 border-t border-white/10">
                    <div>
                      <span className="text-[10px] sm:text-xs tracking-[0.15em] uppercase text-moon-grey/40">
                        Type
                      </span>
                      <p className="text-white font-light mt-2">
                        {isBinary ? "Yes / No" : "Multiple Choice"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] sm:text-xs tracking-[0.15em] uppercase text-moon-grey/40">
                        Options
                      </span>
                      <p className="text-white font-light mt-2">
                        {options.length} options
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] sm:text-xs tracking-[0.15em] uppercase text-moon-grey/40">
                        Expires
                      </span>
                      <p className="text-white font-light mt-2">
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
              <div className="space-y-4">
                <h3 className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-moon-grey/70 font-medium">
                  Market Options
                </h3>
                <div className="grid gap-3">
                  {options.map((opt, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-4 sm:gap-5 px-5 sm:px-6 py-4 sm:py-5 bg-white/[0.02] border border-white/10"
                    >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-neon-iris/10 border border-neon-iris/30 flex items-center justify-center text-neon-iris font-light text-lg">
                        {idx + 1}
                      </div>
                      <div>
                        <span className="text-white font-light text-base sm:text-lg">
                          {opt.label}
                        </span>
                        {opt.subLabel && (
                          <div className="text-moon-grey/50 text-sm mt-1 font-light">
                            {opt.subLabel}
                          </div>
                        )}
                      </div>
                      <span className="ml-auto text-moon-grey/40 text-xs sm:text-sm">
                        50% starting odds
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Initial Liquidity Summary */}
              <div className="p-6 sm:p-8 bg-neon-iris/5 border border-neon-iris/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-light text-white">
                      Initial Liquidity
                    </h3>
                    <p className="text-sm text-moon-grey/50 mt-1 font-light">
                      You'll receive LP shares and earn fees from all trades
                    </p>
                  </div>
                  <p className="text-2xl sm:text-3xl font-light text-neon-iris">
                    {initialLiquidity} USDC
                  </p>
                </div>
              </div>

              {/* Launch Button */}
              <div className="pt-8 space-y-4">
                <button
                  onClick={() => setCurrentStep("options")}
                  className="w-full py-3.5 font-light text-moon-grey/60 bg-white/[0.02] border border-white/10 hover:text-white hover:border-white/20 transition-all"
                >
                  ← Back to Edit Options
                </button>
                {(() => {
                  const requiredAmount = parseInt(initialLiquidity) || 0;
                  const userBalance = user?.wallet?.balance_usdc ?? 0;
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
                        className={`group w-full py-4 sm:py-5 text-sm font-medium tracking-wide uppercase transition-all duration-300 inline-flex items-center justify-center gap-3 ${
                          isInitializing
                            ? "bg-aqua-pulse/20 text-aqua-pulse border border-aqua-pulse/30 cursor-wait"
                            : !isButtonDisabled
                            ? "bg-white text-ink-black hover:bg-moon-grey-light"
                            : "bg-white/10 text-moon-grey/40 cursor-not-allowed"
                        }`}
                      >
                        {isInitializing ? (
                          <span className="flex items-center justify-center gap-3">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                              className="w-5 h-5 border-2 border-aqua-pulse/30 border-t-aqua-pulse rounded-full"
                            />
                            Launching Market...
                          </span>
                        ) : (
                          <>
                            <span>
                              Launch Market with {initialLiquidity} USDC
                            </span>
                            <svg
                              className="w-4 h-4 transition-transform group-hover:translate-x-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M17 8l4 4m0 0l-4 4m4-4H3"
                              />
                            </svg>
                          </>
                        )}
                      </button>
                      {!hasEnoughBalance && requiredAmount >= 100 && (
                        <div className="flex items-center justify-center gap-2 text-red-400/80 text-xs sm:text-sm">
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
                          <span>
                            Insufficient balance. You have{" "}
                            <span className="font-medium">
                              {formatUSDC(userBalance).replace("$", "")} USDC
                            </span>{" "}
                            but need{" "}
                            <span className="font-medium">
                              {requiredAmount.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              USDC
                            </span>
                          </span>
                        </div>
                      )}
                      {hasEnoughBalance && (
                        <p className="text-center text-moon-grey/40 text-xs sm:text-sm font-light">
                          Your {initialLiquidity} USDC will seed the liquidity
                          pool. You'll earn LP fees from all trades and redeem
                          initial liquidity after the market expires.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Delete Option Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setOptionToDelete(null);
        }}
        onConfirm={confirmDeleteOption}
        title="Delete Option"
        message="Are you sure you want to delete this option? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isCreatingOption}
      />
    </div>
  );
};
