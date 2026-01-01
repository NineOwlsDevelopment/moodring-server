import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  fetchAdminSettings,
  updateAdminSettings,
  AdminSettings as AdminSettingsType,
  createCircleHotWallet,
  CircleHotWallet,
} from "@/api/api";
import { toast } from "sonner";

// Micro-USDC conversion constant (1 USDC = 1,000,000 micro-USDC)
const MICRO_USDC_PER_USDC = 1_000_000;

// Fields that are stored in micro-USDC and need conversion
const MICRO_USDC_FIELDS = {
  trading_limits: [
    "min_trade_amount",
    "max_trade_amount",
    "max_position_per_market",
    "max_daily_user_volume",
  ],
  liquidity_controls: ["min_initial_liquidity"],
  risk_controls: ["suspicious_trade_threshold", "circuit_breaker_threshold"],
  dispute_controls: ["required_dispute_bond"],
} as const;

// Convert micro-USDC to USDC for display
const microToUsdc = (micro: number): number => {
  return micro / MICRO_USDC_PER_USDC;
};

// Convert USDC to micro-USDC for storage
const usdcToMicro = (usdc: number): number => {
  return Math.round(usdc * MICRO_USDC_PER_USDC);
};

// Convert settings from backend (micro-USDC) to display format (USDC)
const convertSettingsForDisplay = (
  settings: AdminSettingsType
): AdminSettingsType => {
  const converted = { ...settings };

  // Convert trading_limits
  if (converted.trading_limits) {
    const limits = { ...converted.trading_limits };
    MICRO_USDC_FIELDS.trading_limits.forEach((field) => {
      if (limits[field as keyof typeof limits] !== undefined) {
        (limits as any)[field] = microToUsdc(
          limits[field as keyof typeof limits] as number
        );
      }
    });
    converted.trading_limits = limits;
  }

  // Convert liquidity_controls
  if (converted.liquidity_controls) {
    const liquidity = { ...converted.liquidity_controls };
    MICRO_USDC_FIELDS.liquidity_controls.forEach((field) => {
      if (liquidity[field as keyof typeof liquidity] !== undefined) {
        (liquidity as any)[field] = microToUsdc(
          liquidity[field as keyof typeof liquidity] as number
        );
      }
    });
    converted.liquidity_controls = liquidity;
  }

  // Convert risk_controls
  if (converted.risk_controls) {
    const risk = { ...converted.risk_controls };
    MICRO_USDC_FIELDS.risk_controls.forEach((field) => {
      if (risk[field as keyof typeof risk] !== undefined) {
        (risk as any)[field] = microToUsdc(
          risk[field as keyof typeof risk] as number
        );
      }
    });
    converted.risk_controls = risk;
  }

  // Convert dispute_controls
  if (converted.dispute_controls) {
    const dispute = { ...converted.dispute_controls };
    MICRO_USDC_FIELDS.dispute_controls.forEach((field) => {
      if (dispute[field as keyof typeof dispute] !== undefined) {
        (dispute as any)[field] = microToUsdc(
          dispute[field as keyof typeof dispute] as number
        );
      }
    });
    converted.dispute_controls = dispute;
  }

  return converted;
};

// Convert settings from display format (USDC) to backend format (micro-USDC)
const convertSettingsForBackend = (
  settings: AdminSettingsType
): AdminSettingsType => {
  const converted = { ...settings };

  // Convert trading_limits
  if (converted.trading_limits) {
    const limits = { ...converted.trading_limits };
    MICRO_USDC_FIELDS.trading_limits.forEach((field) => {
      if (limits[field as keyof typeof limits] !== undefined) {
        (limits as any)[field] = usdcToMicro(
          limits[field as keyof typeof limits] as number
        );
      }
    });
    converted.trading_limits = limits;
  }

  // Convert liquidity_controls
  if (converted.liquidity_controls) {
    const liquidity = { ...converted.liquidity_controls };
    MICRO_USDC_FIELDS.liquidity_controls.forEach((field) => {
      if (liquidity[field as keyof typeof liquidity] !== undefined) {
        (liquidity as any)[field] = usdcToMicro(
          liquidity[field as keyof typeof liquidity] as number
        );
      }
    });
    converted.liquidity_controls = liquidity;
  }

  // Convert risk_controls
  if (converted.risk_controls) {
    const risk = { ...converted.risk_controls };
    MICRO_USDC_FIELDS.risk_controls.forEach((field) => {
      if (risk[field as keyof typeof risk] !== undefined) {
        (risk as any)[field] = usdcToMicro(
          risk[field as keyof typeof risk] as number
        );
      }
    });
    converted.risk_controls = risk;
  }

  // Convert dispute_controls
  if (converted.dispute_controls) {
    const dispute = { ...converted.dispute_controls };
    MICRO_USDC_FIELDS.dispute_controls.forEach((field) => {
      if (dispute[field as keyof typeof dispute] !== undefined) {
        (dispute as any)[field] = usdcToMicro(
          dispute[field as keyof typeof dispute] as number
        );
      }
    });
    converted.dispute_controls = dispute;
  }

  return converted;
};

export const AdminSettings = () => {
  const [settings, setSettings] = useState<AdminSettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("admin_controls");
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [walletName, setWalletName] = useState("");
  const [createdWallets, setCreatedWallets] = useState<CircleHotWallet[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminSettings();
      setSettings(convertSettingsForDisplay(data.settings));
    } catch (error: any) {
      console.error("Failed to load settings:", error);
      toast.error(error.response?.data?.error || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      const convertedSettings = convertSettingsForBackend(settings);
      await updateAdminSettings(convertedSettings);
      toast.success("Settings updated successfully");
      await loadSettings();
    } catch (error: any) {
      console.error("Failed to update settings:", error);
      toast.error(error.response?.data?.error || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGroup = async (group: keyof AdminSettingsType) => {
    if (!settings) return;

    try {
      setSaving(true);
      const convertedSettings = convertSettingsForBackend(settings);
      await updateAdminSettings({
        [group]: convertedSettings[group],
      } as Partial<AdminSettingsType>);
      toast.success(
        `${
          tabs.find((t) => t.id === group)?.label || "Settings"
        } updated successfully`
      );
      await loadSettings();
    } catch (error: any) {
      console.error("Failed to update settings:", error);
      toast.error(error.response?.data?.error || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof AdminSettingsType>(
    group: K,
    key: keyof AdminSettingsType[K],
    value: any
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [group]: {
        ...settings[group],
        [key]: value,
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-neon-iris rounded-full animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-ink-black p-4 sm:p-8">
        <div className="bg-graphite-deep/30 border border-white/5 text-center py-20">
          <p className="text-moon-grey/40 text-sm font-light">
            Failed to load settings
          </p>
        </div>
      </div>
    );
  }

  const handleCreateWallet = async () => {
    try {
      setCreatingWallet(true);
      const result = await createCircleHotWallet(
        walletName.trim() || undefined
      );
      toast.success("Circle hot wallet created successfully");
      setCreatedWallets([...createdWallets, result.wallet]);
      setWalletName("");
    } catch (error: any) {
      console.error("Failed to create wallet:", error);
      toast.error(
        error.response?.data?.error || "Failed to create Circle hot wallet"
      );
    } finally {
      setCreatingWallet(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const tabs = [
    { id: "admin_controls", label: "Admin" },
    { id: "trading_limits", label: "Trading" },
    { id: "market_controls", label: "Markets" },
    { id: "resolution_controls", label: "Resolution" },
    { id: "liquidity_controls", label: "Liquidity" },
    { id: "risk_controls", label: "Risk" },
    { id: "dispute_controls", label: "Disputes" },
    { id: "feature_flags", label: "Features" },
    { id: "platform_fees", label: "Fees" },
    { id: "circle_wallets", label: "Wallets" },
  ];

  // Toggle component for reuse
  const Toggle = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-iris"></div>
    </label>
  );

  // Setting card component
  const SettingCard = ({
    label,
    description,
    children,
  }: {
    label: string;
    description?: string;
    children: React.ReactNode;
  }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-ink-black border border-white/5">
      <div className="flex-1 min-w-0">
        <label className="block text-sm font-light text-white">{label}</label>
        {description && (
          <p className="text-[10px] text-moon-grey/40 mt-1">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );

  // Input setting card
  const InputCard = ({
    label,
    description,
    value,
    onChange,
    step,
  }: {
    label: string;
    description?: string;
    value: number;
    onChange: (value: number) => void;
    step?: string;
  }) => (
    <div className="p-4 bg-ink-black border border-white/5">
      <label className="block text-sm font-light text-white mb-1">{label}</label>
      {description && (
        <p className="text-[10px] text-moon-grey/40 mb-3">{description}</p>
      )}
      <input
        type="number"
        step={step || "1"}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-graphite-deep border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:border-neon-iris/50 transition-colors"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-black">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,77,255,0.08),transparent_60%)]" />
      </div>

      <div className="relative px-4 py-6 sm:p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-10"
        >
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-neon-iris/80 font-medium mb-2 sm:mb-3">
              Administration
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extralight tracking-tight text-white">
              Platform Settings
            </h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save All"}
          </button>
        </motion.div>

        {/* Tabs - Scrollable on mobile */}
        <div className="mb-6 sm:mb-8 border-b border-white/5 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex overflow-x-auto hide-scrollbar gap-1 pb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs tracking-[0.1em] uppercase font-medium transition-colors whitespace-nowrap relative flex-shrink-0 ${
                  activeTab === tab.id
                    ? "text-white"
                    : "text-moon-grey/50 hover:text-white"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris to-transparent" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Admin Controls */}
        {activeTab === "admin_controls" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
              <h2 className="text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium">
                Admin Controls
              </h2>
              <button
                onClick={() => handleSaveGroup("admin_controls")}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Section"}
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <SettingCard
                label="Maintenance Mode"
                description="Disables all platform functionality"
              >
                <Toggle
                  checked={settings.admin_controls.maintenance_mode}
                  onChange={(checked) =>
                    updateSetting("admin_controls", "maintenance_mode", checked)
                  }
                />
              </SettingCard>
              <SettingCard
                label="Allow User Registration"
                description="Enable new user signups"
              >
                <Toggle
                  checked={settings.admin_controls.allow_user_registration}
                  onChange={(checked) =>
                    updateSetting(
                      "admin_controls",
                      "allow_user_registration",
                      checked
                    )
                  }
                />
              </SettingCard>
              <SettingCard
                label="Allow Market Creation"
                description="Enable users to create new markets"
              >
                <Toggle
                  checked={settings.admin_controls.allow_market_creation}
                  onChange={(checked) =>
                    updateSetting(
                      "admin_controls",
                      "allow_market_creation",
                      checked
                    )
                  }
                />
              </SettingCard>
              <SettingCard
                label="Allow Trading"
                description="Enable trading on all markets"
              >
                <Toggle
                  checked={settings.admin_controls.allow_trading}
                  onChange={(checked) =>
                    updateSetting("admin_controls", "allow_trading", checked)
                  }
                />
              </SettingCard>
              <SettingCard
                label="Allow Withdrawals"
                description="Enable user withdrawals"
              >
                <Toggle
                  checked={settings.admin_controls.allow_withdrawals}
                  onChange={(checked) =>
                    updateSetting("admin_controls", "allow_withdrawals", checked)
                  }
                />
              </SettingCard>
              <SettingCard
                label="Allow Deposits"
                description="Enable user deposits"
              >
                <Toggle
                  checked={settings.admin_controls.allow_deposits}
                  onChange={(checked) =>
                    updateSetting("admin_controls", "allow_deposits", checked)
                  }
                />
              </SettingCard>
            </div>
          </motion.div>
        )}

        {/* Trading Limits */}
        {activeTab === "trading_limits" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
              <h2 className="text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium">
                Trading Limits
              </h2>
              <button
                onClick={() => handleSaveGroup("trading_limits")}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Section"}
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <InputCard
                label="Min Trade Amount (USDC)"
                description="Minimum amount for a single trade"
                value={settings.trading_limits.min_trade_amount}
                onChange={(v) =>
                  updateSetting("trading_limits", "min_trade_amount", v)
                }
                step="0.01"
              />
              <InputCard
                label="Max Trade Amount (USDC)"
                description="Maximum amount for a single trade"
                value={settings.trading_limits.max_trade_amount}
                onChange={(v) =>
                  updateSetting("trading_limits", "max_trade_amount", v)
                }
                step="0.01"
              />
              <InputCard
                label="Max Position Per Market (USDC)"
                description="Maximum position size per market"
                value={settings.trading_limits.max_position_per_market}
                onChange={(v) =>
                  updateSetting("trading_limits", "max_position_per_market", v)
                }
                step="0.01"
              />
              <InputCard
                label="Max Daily User Volume (USDC)"
                description="Maximum daily trading volume per user"
                value={settings.trading_limits.max_daily_user_volume}
                onChange={(v) =>
                  updateSetting("trading_limits", "max_daily_user_volume", v)
                }
                step="0.01"
              />
            </div>
          </motion.div>
        )}

        {/* Market Controls */}
        {activeTab === "market_controls" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
              <h2 className="text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium">
                Market Controls
              </h2>
              <button
                onClick={() => handleSaveGroup("market_controls")}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Section"}
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <InputCard
                label="Max Markets Per User"
                description="Maximum total markets a user can create"
                value={settings.market_controls.max_markets_per_user}
                onChange={(v) =>
                  updateSetting("market_controls", "max_markets_per_user", v)
                }
              />
              <InputCard
                label="Max Open Markets Per User"
                description="Maximum active markets per user"
                value={settings.market_controls.max_open_markets_per_user}
                onChange={(v) =>
                  updateSetting(
                    "market_controls",
                    "max_open_markets_per_user",
                    v
                  )
                }
              />
              <InputCard
                label="Min Market Duration (hours)"
                description="Minimum market duration"
                value={settings.market_controls.min_market_duration_hours}
                onChange={(v) =>
                  updateSetting(
                    "market_controls",
                    "min_market_duration_hours",
                    v
                  )
                }
              />
              <InputCard
                label="Max Market Duration (days)"
                description="Maximum market duration"
                value={settings.market_controls.max_market_duration_days}
                onChange={(v) =>
                  updateSetting(
                    "market_controls",
                    "max_market_duration_days",
                    v
                  )
                }
              />
              <InputCard
                label="Max Market Options"
                description="Maximum options per market"
                value={settings.market_controls.max_market_options}
                onChange={(v) =>
                  updateSetting("market_controls", "max_market_options", v)
                }
              />
            </div>
          </motion.div>
        )}

        {/* Resolution Controls */}
        {activeTab === "resolution_controls" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
              <h2 className="text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium">
                Resolution Controls
              </h2>
              <button
                onClick={() => handleSaveGroup("resolution_controls")}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Section"}
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <SettingCard
                label="Auto Resolve Markets"
                description="Automatically resolve markets when conditions are met"
              >
                <Toggle
                  checked={settings.resolution_controls.auto_resolve_markets}
                  onChange={(checked) =>
                    updateSetting(
                      "resolution_controls",
                      "auto_resolve_markets",
                      checked
                    )
                  }
                />
              </SettingCard>
              <SettingCard
                label="Oracle Resolution Enabled"
                description="Enable oracle-based resolution"
              >
                <Toggle
                  checked={
                    settings.resolution_controls.resolution_oracle_enabled
                  }
                  onChange={(checked) =>
                    updateSetting(
                      "resolution_controls",
                      "resolution_oracle_enabled",
                      checked
                    )
                  }
                />
              </SettingCard>
              <SettingCard
                label="Authority Resolution Enabled"
                description="Enable authority-based resolution"
              >
                <Toggle
                  checked={
                    settings.resolution_controls.authority_resolution_enabled
                  }
                  onChange={(checked) =>
                    updateSetting(
                      "resolution_controls",
                      "authority_resolution_enabled",
                      checked
                    )
                  }
                />
              </SettingCard>
              <SettingCard
                label="Opinion Resolution Enabled"
                description="Enable opinion-based resolution"
              >
                <Toggle
                  checked={
                    settings.resolution_controls.opinion_resolution_enabled
                  }
                  onChange={(checked) =>
                    updateSetting(
                      "resolution_controls",
                      "opinion_resolution_enabled",
                      checked
                    )
                  }
                />
              </SettingCard>
            </div>
          </motion.div>
        )}

        {/* Liquidity Controls */}
        {activeTab === "liquidity_controls" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
              <h2 className="text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium">
                Liquidity Controls
              </h2>
              <button
                onClick={() => handleSaveGroup("liquidity_controls")}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Section"}
              </button>
            </div>
            <InputCard
              label="Min Initial Liquidity (USDC)"
              description="Minimum liquidity required to initialize a market"
              value={settings.liquidity_controls.min_initial_liquidity}
              onChange={(v) =>
                updateSetting(
                  "liquidity_controls",
                  "min_initial_liquidity",
                  v
                )
              }
              step="0.01"
            />
          </motion.div>
        )}

        {/* Risk Controls */}
        {activeTab === "risk_controls" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
              <h2 className="text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium">
                Risk Controls
              </h2>
              <button
                onClick={() => handleSaveGroup("risk_controls")}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Section"}
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <InputCard
                label="Max Market Volatility Threshold"
                description="Maximum allowed market volatility"
                value={settings.risk_controls.max_market_volatility_threshold}
                onChange={(v) =>
                  updateSetting(
                    "risk_controls",
                    "max_market_volatility_threshold",
                    v
                  )
                }
              />
              <InputCard
                label="Suspicious Trade Threshold (USDC)"
                description="Threshold for flagging suspicious trades"
                value={settings.risk_controls.suspicious_trade_threshold}
                onChange={(v) =>
                  updateSetting(
                    "risk_controls",
                    "suspicious_trade_threshold",
                    v
                  )
                }
                step="0.01"
              />
              <InputCard
                label="Circuit Breaker Threshold (USDC)"
                description="Threshold for triggering circuit breaker"
                value={settings.risk_controls.circuit_breaker_threshold}
                onChange={(v) =>
                  updateSetting(
                    "risk_controls",
                    "circuit_breaker_threshold",
                    v
                  )
                }
                step="0.01"
              />
            </div>
          </motion.div>
        )}

        {/* Dispute Controls */}
        {activeTab === "dispute_controls" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
              <h2 className="text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium">
                Dispute Controls
              </h2>
              <button
                onClick={() => handleSaveGroup("dispute_controls")}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Section"}
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <InputCard
                label="Default Dispute Period (hours)"
                description="Default time window for disputes"
                value={settings.dispute_controls.default_dispute_period_hours}
                onChange={(v) =>
                  updateSetting(
                    "dispute_controls",
                    "default_dispute_period_hours",
                    v
                  )
                }
              />
              <InputCard
                label="Required Dispute Bond (USDC)"
                description="Bond required to file a dispute"
                value={settings.dispute_controls.required_dispute_bond}
                onChange={(v) =>
                  updateSetting(
                    "dispute_controls",
                    "required_dispute_bond",
                    v
                  )
                }
                step="0.01"
              />
            </div>
          </motion.div>
        )}

        {/* Feature Flags */}
        {activeTab === "feature_flags" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
              <h2 className="text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium">
                Feature Flags
              </h2>
              <button
                onClick={() => handleSaveGroup("feature_flags")}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Section"}
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <SettingCard
                label="Enable Copy Trading"
                description="Allow users to copy trades from other users"
              >
                <Toggle
                  checked={settings.feature_flags.enable_copy_trading}
                  onChange={(checked) =>
                    updateSetting(
                      "feature_flags",
                      "enable_copy_trading",
                      checked
                    )
                  }
                />
              </SettingCard>
              <SettingCard
                label="Enable Social Feed"
                description="Enable social feed features"
              >
                <Toggle
                  checked={settings.feature_flags.enable_social_feed}
                  onChange={(checked) =>
                    updateSetting(
                      "feature_flags",
                      "enable_social_feed",
                      checked
                    )
                  }
                />
              </SettingCard>
              <SettingCard
                label="Enable Live Rooms"
                description="Enable live trading rooms"
              >
                <Toggle
                  checked={settings.feature_flags.enable_live_rooms}
                  onChange={(checked) =>
                    updateSetting("feature_flags", "enable_live_rooms", checked)
                  }
                />
              </SettingCard>
              <SettingCard
                label="Enable Referrals"
                description="Enable referral program"
              >
                <Toggle
                  checked={settings.feature_flags.enable_referrals}
                  onChange={(checked) =>
                    updateSetting("feature_flags", "enable_referrals", checked)
                  }
                />
              </SettingCard>
              <SettingCard
                label="Enable Notifications"
                description="Enable push and email notifications"
              >
                <Toggle
                  checked={settings.feature_flags.enable_notifications}
                  onChange={(checked) =>
                    updateSetting(
                      "feature_flags",
                      "enable_notifications",
                      checked
                    )
                  }
                />
              </SettingCard>
            </div>
          </motion.div>
        )}

        {/* Platform Fees */}
        {activeTab === "platform_fees" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
              <h2 className="text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium">
                Platform Fees
              </h2>
              <button
                onClick={() => handleSaveGroup("platform_fees")}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Section"}
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <InputCard
                label="LP Fee Rate (%)"
                description="Fee rate for liquidity providers"
                value={settings.platform_fees.lp_fee_rate}
                onChange={(v) =>
                  updateSetting("platform_fees", "lp_fee_rate", v)
                }
                step="0.01"
              />
              <InputCard
                label="Protocol Fee Rate (%)"
                description="Fee rate for the protocol"
                value={settings.platform_fees.protocol_fee_rate}
                onChange={(v) =>
                  updateSetting("platform_fees", "protocol_fee_rate", v)
                }
                step="0.01"
              />
              <InputCard
                label="Creator Fee Rate (%)"
                description="Fee rate for market creators"
                value={settings.platform_fees.creator_fee_rate}
                onChange={(v) =>
                  updateSetting("platform_fees", "creator_fee_rate", v)
                }
                step="0.01"
              />
            </div>
          </motion.div>
        )}

        {/* Circle Wallets */}
        {activeTab === "circle_wallets" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-graphite-deep/30 border border-white/5 p-4 sm:p-6"
          >
            <div className="mb-6 sm:mb-8">
              <h2 className="text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium mb-2 sm:mb-3">
                Circle Hot Wallets
              </h2>
              <p className="text-xs sm:text-sm text-moon-grey/50 font-light">
                Create new Circle hot wallets for platform use.
              </p>
            </div>

            {/* Create Wallet Form */}
            <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-ink-black border border-white/5">
              <h3 className="text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium mb-4 sm:mb-6">
                Create New Hot Wallet
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-moon-grey/50 mb-2 sm:mb-3">
                    Wallet Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={walletName}
                    onChange={(e) => setWalletName(e.target.value)}
                    placeholder="e.g., Main Hot Wallet"
                    className="w-full bg-graphite-deep border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder-moon-grey/40 focus:outline-none focus:border-neon-iris/50 transition-colors"
                  />
                </div>
                <button
                  onClick={handleCreateWallet}
                  disabled={creatingWallet}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 text-xs tracking-wide uppercase font-medium bg-white text-ink-black hover:bg-moon-grey-light transition-all duration-300 disabled:opacity-50"
                >
                  {creatingWallet ? "Creating..." : "Create Hot Wallet"}
                </button>
              </div>
            </div>

            {/* Created Wallets List */}
            {createdWallets.length > 0 && (
              <div>
                <h3 className="text-sm tracking-[0.15em] uppercase text-moon-grey/70 font-medium mb-4 sm:mb-6">
                  Recently Created Wallets
                </h3>
                <div className="space-y-4">
                  {createdWallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      className="p-4 bg-ink-black border border-white/5"
                    >
                      {wallet.name && (
                        <div className="text-sm font-light text-white mb-3">
                          {wallet.name}
                        </div>
                      )}
                      <div className="space-y-3">
                        <div>
                          <div className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/40 mb-1">
                            Wallet ID
                          </div>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            <code className="text-xs text-moon-grey/70 font-mono bg-graphite-deep px-3 py-1.5 border border-white/5 break-all">
                              {wallet.id}
                            </code>
                            <button
                              onClick={() =>
                                copyToClipboard(wallet.id, "Wallet ID")
                              }
                              className="text-[10px] tracking-[0.1em] uppercase text-neon-iris hover:text-neon-iris/80 transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] tracking-[0.1em] uppercase text-moon-grey/40 mb-1">
                            Address
                          </div>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            <code className="text-xs text-moon-grey/70 font-mono bg-graphite-deep px-3 py-1.5 border border-white/5 break-all">
                              {wallet.address}
                            </code>
                            <button
                              onClick={() =>
                                copyToClipboard(wallet.address, "Address")
                              }
                              className="text-[10px] tracking-[0.1em] uppercase text-neon-iris hover:text-neon-iris/80 whitespace-nowrap transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <p className="text-[10px] text-moon-grey/40">
                          💡 Save the Wallet ID to use as CIRCLE_HOT_WALLET_ID
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {createdWallets.length === 0 && (
              <div className="text-center py-12 sm:py-16 text-moon-grey/40 text-sm font-light">
                <p>No wallets created yet.</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};
