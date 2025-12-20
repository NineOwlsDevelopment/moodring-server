import { useEffect, useState } from "react";
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
      // Convert micro-USDC to USDC for display
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
      // Convert USDC back to micro-USDC before sending
      const convertedSettings = convertSettingsForBackend(settings);
      await updateAdminSettings(convertedSettings);
      toast.success("Settings updated successfully");
      // Reload settings to get any server-side validations
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
      // Convert USDC back to micro-USDC before sending
      const convertedSettings = convertSettingsForBackend(settings);
      // Only send the specific group being saved
      await updateAdminSettings({
        [group]: convertedSettings[group],
      } as Partial<AdminSettingsType>);
      toast.success(
        `${
          tabs.find((t) => t.id === group)?.label || "Settings"
        } updated successfully`
      );
      // Reload settings to get any server-side validations
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
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8">
        <div className="card text-center py-12">
          <p className="text-gray-400">Failed to load settings</p>
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
    { id: "admin_controls", label: "Admin Controls" },
    { id: "trading_limits", label: "Trading Limits" },
    { id: "market_controls", label: "Market Controls" },
    { id: "resolution_controls", label: "Resolution" },
    { id: "liquidity_controls", label: "Liquidity" },
    { id: "risk_controls", label: "Risk Controls" },
    { id: "dispute_controls", label: "Disputes" },
    { id: "feature_flags", label: "Feature Flags" },
    { id: "platform_fees", label: "Platform Fees" },
    { id: "circle_wallets", label: "Circle Wallets" },
  ];

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Platform Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? "Saving..." : "Save All Settings"}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-dark-700">
        <div className="flex space-x-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-primary-400 border-b-2 border-primary-400"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Admin Controls */}
      {activeTab === "admin_controls" && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">Admin Controls</h2>
            <button
              onClick={() => handleSaveGroup("admin_controls")}
              disabled={saving}
              className="btn btn-primary text-sm"
            >
              {saving ? "Saving..." : "Save This Section"}
            </button>
          </div>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Maintenance Mode
                </label>
                <p className="text-xs text-gray-400">
                  Disables all platform functionality
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.admin_controls.maintenance_mode}
                  onChange={(e) =>
                    updateSetting(
                      "admin_controls",
                      "maintenance_mode",
                      e.target.checked
                    )
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Allow User Registration
                </label>
                <p className="text-xs text-gray-400">Enable new user signups</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.admin_controls.allow_user_registration}
                  onChange={(e) =>
                    updateSetting(
                      "admin_controls",
                      "allow_user_registration",
                      e.target.checked
                    )
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Allow Market Creation
                </label>
                <p className="text-xs text-gray-400">
                  Enable users to create new markets
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.admin_controls.allow_market_creation}
                  onChange={(e) =>
                    updateSetting(
                      "admin_controls",
                      "allow_market_creation",
                      e.target.checked
                    )
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Allow Trading
                </label>
                <p className="text-xs text-gray-400">
                  Enable trading on all markets
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.admin_controls.allow_trading}
                  onChange={(e) =>
                    updateSetting(
                      "admin_controls",
                      "allow_trading",
                      e.target.checked
                    )
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Allow Withdrawals
                </label>
                <p className="text-xs text-gray-400">Enable user withdrawals</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.admin_controls.allow_withdrawals}
                  onChange={(e) =>
                    updateSetting(
                      "admin_controls",
                      "allow_withdrawals",
                      e.target.checked
                    )
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Allow Deposits
                </label>
                <p className="text-xs text-gray-400">Enable user deposits</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.admin_controls.allow_deposits}
                  onChange={(e) =>
                    updateSetting(
                      "admin_controls",
                      "allow_deposits",
                      e.target.checked
                    )
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Trading Limits */}
      {activeTab === "trading_limits" && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">Trading Limits</h2>
            <button
              onClick={() => handleSaveGroup("trading_limits")}
              disabled={saving}
              className="btn btn-primary text-sm"
            >
              {saving ? "Saving..." : "Save This Section"}
            </button>
          </div>
          <div className="space-y-6">
            {[
              {
                key: "min_trade_amount",
                label: "Min Trade Amount (USDC)",
                description: "Minimum amount for a single trade",
              },
              {
                key: "max_trade_amount",
                label: "Max Trade Amount (USDC)",
                description: "Maximum amount for a single trade",
              },
              {
                key: "max_position_per_market",
                label: "Max Position Per Market (USDC)",
                description: "Maximum position size per market",
              },
              {
                key: "max_daily_user_volume",
                label: "Max Daily User Volume (USDC)",
                description: "Maximum daily trading volume per user",
              },
            ].map(({ key, label, description }) => (
              <div key={key} className="p-4 bg-dark-800 rounded-lg">
                <label className="block text-sm font-medium text-white mb-1">
                  {label}
                </label>
                <p className="text-xs text-gray-400 mb-2">{description}</p>
                <input
                  type="number"
                  step="0.01"
                  value={
                    settings.trading_limits[
                      key as keyof typeof settings.trading_limits
                    ]
                  }
                  onChange={(e) =>
                    updateSetting(
                      "trading_limits",
                      key as any,
                      Number(e.target.value)
                    )
                  }
                  className="input w-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market Controls */}
      {activeTab === "market_controls" && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">
              Market Controls
            </h2>
            <button
              onClick={() => handleSaveGroup("market_controls")}
              disabled={saving}
              className="btn btn-primary text-sm"
            >
              {saving ? "Saving..." : "Save This Section"}
            </button>
          </div>
          <div className="space-y-6">
            {[
              {
                key: "max_markets_per_user",
                label: "Max Markets Per User",
                description: "Maximum total markets a user can create",
              },
              {
                key: "max_open_markets_per_user",
                label: "Max Open Markets Per User",
                description: "Maximum active markets per user",
              },
              {
                key: "min_market_duration_hours",
                label: "Min Market Duration (hours)",
                description: "Minimum market duration",
              },
              {
                key: "max_market_duration_days",
                label: "Max Market Duration (days)",
                description: "Maximum market duration",
              },
              {
                key: "max_market_options",
                label: "Max Market Options",
                description: "Maximum options per market",
              },
            ].map(({ key, label, description }) => (
              <div key={key} className="p-4 bg-dark-800 rounded-lg">
                <label className="block text-sm font-medium text-white mb-1">
                  {label}
                </label>
                <p className="text-xs text-gray-400 mb-2">{description}</p>
                <input
                  type="number"
                  value={
                    settings.market_controls[
                      key as keyof typeof settings.market_controls
                    ]
                  }
                  onChange={(e) =>
                    updateSetting(
                      "market_controls",
                      key as any,
                      Number(e.target.value)
                    )
                  }
                  className="input w-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolution Controls */}
      {activeTab === "resolution_controls" && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">
              Resolution Controls
            </h2>
            <button
              onClick={() => handleSaveGroup("resolution_controls")}
              disabled={saving}
              className="btn btn-primary text-sm"
            >
              {saving ? "Saving..." : "Save This Section"}
            </button>
          </div>
          <div className="space-y-6">
            {[
              {
                key: "auto_resolve_markets",
                label: "Auto Resolve Markets",
                description:
                  "Automatically resolve markets when conditions are met",
              },
              {
                key: "resolution_oracle_enabled",
                label: "Oracle Resolution Enabled",
                description: "Enable oracle-based resolution",
              },
              {
                key: "authority_resolution_enabled",
                label: "Authority Resolution Enabled",
                description: "Enable authority-based resolution",
              },
              {
                key: "opinion_resolution_enabled",
                label: "Opinion Resolution Enabled",
                description: "Enable opinion-based resolution",
              },
            ].map(({ key, label, description }) => (
              <div
                key={key}
                className="flex items-center justify-between p-4 bg-dark-800 rounded-lg"
              >
                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    {label}
                  </label>
                  <p className="text-xs text-gray-400">{description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      settings.resolution_controls[
                        key as keyof typeof settings.resolution_controls
                      ] as boolean
                    }
                    onChange={(e) =>
                      updateSetting(
                        "resolution_controls",
                        key as any,
                        e.target.checked
                      )
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liquidity Controls */}
      {activeTab === "liquidity_controls" && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">
              Liquidity Controls
            </h2>
            <button
              onClick={() => handleSaveGroup("liquidity_controls")}
              disabled={saving}
              className="btn btn-primary text-sm"
            >
              {saving ? "Saving..." : "Save This Section"}
            </button>
          </div>
          <div className="space-y-6">
            <div className="p-4 bg-dark-800 rounded-lg">
              <label className="block text-sm font-medium text-white mb-1">
                Min Initial Liquidity (USDC)
              </label>
              <p className="text-xs text-gray-400 mb-2">
                Minimum liquidity required to initialize a market
              </p>
              <input
                type="number"
                step="0.01"
                value={settings.liquidity_controls.min_initial_liquidity}
                onChange={(e) =>
                  updateSetting(
                    "liquidity_controls",
                    "min_initial_liquidity",
                    Number(e.target.value)
                  )
                }
                className="input w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Risk Controls */}
      {activeTab === "risk_controls" && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">Risk Controls</h2>
            <button
              onClick={() => handleSaveGroup("risk_controls")}
              disabled={saving}
              className="btn btn-primary text-sm"
            >
              {saving ? "Saving..." : "Save This Section"}
            </button>
          </div>
          <div className="space-y-6">
            {[
              {
                key: "max_market_volatility_threshold",
                label: "Max Market Volatility Threshold",
                description: "Maximum allowed market volatility",
              },
              {
                key: "suspicious_trade_threshold",
                label: "Suspicious Trade Threshold (USDC)",
                description: "Threshold for flagging suspicious trades",
              },
              {
                key: "circuit_breaker_threshold",
                label: "Circuit Breaker Threshold (USDC)",
                description: "Threshold for triggering circuit breaker",
              },
            ].map(({ key, label, description }) => (
              <div key={key} className="p-4 bg-dark-800 rounded-lg">
                <label className="block text-sm font-medium text-white mb-1">
                  {label}
                </label>
                <p className="text-xs text-gray-400 mb-2">{description}</p>
                <input
                  type="number"
                  step={
                    key === "max_market_volatility_threshold"
                      ? undefined
                      : "0.01"
                  }
                  value={
                    settings.risk_controls[
                      key as keyof typeof settings.risk_controls
                    ]
                  }
                  onChange={(e) =>
                    updateSetting(
                      "risk_controls",
                      key as any,
                      Number(e.target.value)
                    )
                  }
                  className="input w-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dispute Controls */}
      {activeTab === "dispute_controls" && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">
              Dispute Controls
            </h2>
            <button
              onClick={() => handleSaveGroup("dispute_controls")}
              disabled={saving}
              className="btn btn-primary text-sm"
            >
              {saving ? "Saving..." : "Save This Section"}
            </button>
          </div>
          <div className="space-y-6">
            {[
              {
                key: "default_dispute_period_hours",
                label: "Default Dispute Period (hours)",
                description: "Default time window for disputes",
              },
              {
                key: "required_dispute_bond",
                label: "Required Dispute Bond (USDC)",
                description: "Bond required to file a dispute",
              },
            ].map(({ key, label, description }) => (
              <div key={key} className="p-4 bg-dark-800 rounded-lg">
                <label className="block text-sm font-medium text-white mb-1">
                  {label}
                </label>
                <p className="text-xs text-gray-400 mb-2">{description}</p>
                <input
                  type="number"
                  step={
                    key === "default_dispute_period_hours" ? undefined : "0.01"
                  }
                  value={
                    settings.dispute_controls[
                      key as keyof typeof settings.dispute_controls
                    ]
                  }
                  onChange={(e) =>
                    updateSetting(
                      "dispute_controls",
                      key as any,
                      Number(e.target.value)
                    )
                  }
                  className="input w-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature Flags */}
      {activeTab === "feature_flags" && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">Feature Flags</h2>
            <button
              onClick={() => handleSaveGroup("feature_flags")}
              disabled={saving}
              className="btn btn-primary text-sm"
            >
              {saving ? "Saving..." : "Save This Section"}
            </button>
          </div>
          <div className="space-y-6">
            {[
              {
                key: "enable_copy_trading",
                label: "Enable Copy Trading",
                description: "Allow users to copy trades from other users",
              },
              {
                key: "enable_social_feed",
                label: "Enable Social Feed",
                description: "Enable social feed features",
              },
              {
                key: "enable_live_rooms",
                label: "Enable Live Rooms",
                description: "Enable live trading rooms",
              },
              {
                key: "enable_referrals",
                label: "Enable Referrals",
                description: "Enable referral program",
              },
              {
                key: "enable_notifications",
                label: "Enable Notifications",
                description: "Enable push and email notifications",
              },
            ].map(({ key, label, description }) => (
              <div
                key={key}
                className="flex items-center justify-between p-4 bg-dark-800 rounded-lg"
              >
                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    {label}
                  </label>
                  <p className="text-xs text-gray-400">{description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      settings.feature_flags[
                        key as keyof typeof settings.feature_flags
                      ] as boolean
                    }
                    onChange={(e) =>
                      updateSetting(
                        "feature_flags",
                        key as any,
                        e.target.checked
                      )
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform Fees */}
      {activeTab === "platform_fees" && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">Platform Fees</h2>
            <button
              onClick={() => handleSaveGroup("platform_fees")}
              disabled={saving}
              className="btn btn-primary text-sm"
            >
              {saving ? "Saving..." : "Save This Section"}
            </button>
          </div>
          <div className="space-y-6">
            {[
              {
                key: "lp_fee_rate",
                label: "LP Fee Rate (%)",
                description: "Fee rate for liquidity providers",
              },
              {
                key: "protocol_fee_rate",
                label: "Protocol Fee Rate (%)",
                description: "Fee rate for the protocol",
              },
              {
                key: "creator_fee_rate",
                label: "Creator Fee Rate (%)",
                description: "Fee rate for market creators",
              },
            ].map(({ key, label, description }) => (
              <div key={key} className="p-4 bg-dark-800 rounded-lg">
                <label className="block text-sm font-medium text-white mb-1">
                  {label}
                </label>
                <p className="text-xs text-gray-400 mb-2">{description}</p>
                <input
                  type="number"
                  step="0.01"
                  value={
                    settings.platform_fees[
                      key as keyof typeof settings.platform_fees
                    ]
                  }
                  onChange={(e) =>
                    updateSetting(
                      "platform_fees",
                      key as any,
                      Number(e.target.value)
                    )
                  }
                  className="input w-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Circle Wallets */}
      {activeTab === "circle_wallets" && (
        <div className="card">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">
              Circle Hot Wallets
            </h2>
            <p className="text-sm text-gray-400">
              Create new Circle hot wallets for platform use. These wallets can
              be used for deposits, withdrawals, and other platform operations.
            </p>
          </div>

          {/* Create Wallet Form */}
          <div className="mb-8 p-6 bg-dark-800 rounded-lg border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              Create New Hot Wallet
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Wallet Name (Optional)
                </label>
                <input
                  type="text"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  placeholder="e.g., Main Hot Wallet, Withdrawal Wallet"
                  className="input w-full"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Optional label to help identify this wallet
                </p>
              </div>
              <button
                onClick={handleCreateWallet}
                disabled={creatingWallet}
                className="btn btn-primary"
              >
                {creatingWallet ? "Creating..." : "Create Hot Wallet"}
              </button>
            </div>
          </div>

          {/* Created Wallets List */}
          {createdWallets.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Recently Created Wallets
              </h3>
              <div className="space-y-3">
                {createdWallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className="p-4 bg-dark-800 rounded-lg border border-dark-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {wallet.name && (
                          <div className="text-sm font-medium text-white mb-1">
                            {wallet.name}
                          </div>
                        )}
                        <div className="space-y-2">
                          <div>
                            <div className="text-xs text-gray-400 mb-1">
                              Wallet ID
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="text-sm text-gray-300 font-mono bg-dark-900 px-2 py-1 rounded">
                                {wallet.id}
                              </code>
                              <button
                                onClick={() =>
                                  copyToClipboard(wallet.id, "Wallet ID")
                                }
                                className="text-xs text-primary-400 hover:text-primary-300"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">
                              Address
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="text-sm text-gray-300 font-mono bg-dark-900 px-2 py-1 rounded break-all">
                                {wallet.address}
                              </code>
                              <button
                                onClick={() =>
                                  copyToClipboard(wallet.address, "Address")
                                }
                                className="text-xs text-primary-400 hover:text-primary-300 whitespace-nowrap"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-dark-700">
                      <p className="text-xs text-gray-500">
                        💡 Save the Wallet ID to use as CIRCLE_HOT_WALLET_ID in
                        your environment variables
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {createdWallets.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>No wallets created yet. Create your first hot wallet above.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
