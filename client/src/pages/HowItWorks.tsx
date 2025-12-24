import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  GradientDivider,
  SectionHeader,
  StepCard,
  FeatureCard,
  LMSRAnimationSimple,
} from "@/components/brand";

export const HowItWorks = () => {
  return (
    <div className="min-h-screen bg-graphite-deep">
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-ink-black" />
        <div className="absolute inset-0 bg-mesh" />
        <motion.div
          className="absolute inset-0 bg-grid opacity-40"
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%"],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gradient-radial-iris opacity-25 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-radial-aqua opacity-25 blur-3xl" />

        <div className="section-container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
              How It Works
            </h1>
            <p className="text-xl md:text-2xl text-moon-grey max-w-3xl mx-auto leading-relaxed">
              Learn how Moodring's prediction markets work, from creating
              markets to earning rewards. Built on Solana for speed, powered by
              LMSR for liquidity.
            </p>
          </motion.div>
        </div>
      </section>

      <GradientDivider className="max-w-4xl mx-auto" />

      {/* Getting Started Section */}
      <section className="section-padding bg-graphite-deep relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial-iris opacity-10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-radial-aqua opacity-10 blur-3xl" />
        <div className="absolute inset-0 bg-grid opacity-5" />

        <div className="section-container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <SectionHeader
              title="Getting Started"
              subtitle="Start trading on predictions in just a few simple steps"
              align="center"
              size="lg"
            />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16 mt-20">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <StepCard
                step={1}
                title="Connect Your Wallet"
                description="Connect a Solana-compatible wallet like Phantom or Solflare. No account creation needed—your wallet is your identity."
                index={0}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <StepCard
                step={2}
                title="Browse Markets"
                description="Explore active prediction markets across politics, crypto, sports, economics, and entertainment. Filter by category or search for specific events."
                index={1}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <StepCard
                step={3}
                title="Make Your Prediction"
                description="Buy YES or NO shares based on your prediction. Prices update in real-time based on market activity and the LMSR algorithm."
                index={2}
              />
            </motion.div>
          </div>
        </div>
      </section>

      <GradientDivider className="max-w-4xl mx-auto" />

      {/* Creating Markets Section */}
      <section className="section-padding bg-ink-black relative overflow-hidden">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-gradient-radial-iris opacity-5 blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-gradient-radial-aqua opacity-5 blur-3xl" />

        <div className="section-container relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <SectionHeader
                badge="Market Creation"
                title="Create Your Own Market"
                subtitle="Anyone can create a prediction market on Moodring. Define a clear question, set outcomes, and provide initial liquidity to launch your market."
                animated={true}
              />

              <div className="mt-10 space-y-6">
                <div className="p-6 bg-graphite-deep rounded-xl border border-white/5">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Market Question
                  </h3>
                  <p className="text-moon-grey text-sm leading-relaxed">
                    Formulate a clear, binary question that can be definitively
                    resolved. Examples: "Will Bitcoin reach $100k by Dec 2024?"
                    or "Will the Lakers win the NBA championship?"
                  </p>
                </div>
                <div className="p-6 bg-graphite-deep rounded-xl border border-white/5">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Resolution Criteria
                  </h3>
                  <p className="text-moon-grey text-sm leading-relaxed">
                    Specify how the market will be resolved. Include sources,
                    dates, and clear conditions. This helps resolvers make fair
                    decisions.
                  </p>
                </div>
                <div className="p-6 bg-graphite-deep rounded-xl border border-white/5">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Initial Liquidity
                  </h3>
                  <p className="text-moon-grey text-sm leading-relaxed">
                    Provide initial liquidity in USDC to bootstrap your market.
                    More liquidity means tighter spreads and better trading
                    experience for participants.
                  </p>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-8"
              >
                <Link
                  to="/create"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-brand text-white font-semibold rounded-xl hover:shadow-button-primary-hover transition-all duration-200"
                >
                  Create a Market
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
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="p-8 bg-graphite-deep rounded-2xl border border-white/5">
                <h3 className="text-2xl font-semibold text-white mb-6">
                  Market Lifecycle
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-neon-iris/20 flex items-center justify-center text-neon-iris font-semibold">
                      1
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">Creation</h4>
                      <p className="text-moon-grey text-sm">
                        Market creator defines question and provides liquidity
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-neon-iris/20 flex items-center justify-center text-neon-iris font-semibold">
                      2
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">Trading</h4>
                      <p className="text-moon-grey text-sm">
                        Participants buy and sell shares based on predictions
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-neon-iris/20 flex items-center justify-center text-neon-iris font-semibold">
                      3
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">
                        Resolution
                      </h4>
                      <p className="text-moon-grey text-sm">
                        Bonded resolvers determine the outcome based on criteria
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-neon-iris/20 flex items-center justify-center text-neon-iris font-semibold">
                      4
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">Payout</h4>
                      <p className="text-moon-grey text-sm">
                        Winners receive USDC payouts automatically
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <GradientDivider className="max-w-4xl mx-auto" />

      {/* Trading Section */}
      <section className="section-padding bg-graphite-deep relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-5" />
        <div className="section-container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <SectionHeader
              title="How Trading Works"
              subtitle="Understanding shares, prices, and the LMSR mechanism"
              align="center"
              size="lg"
            />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mt-16">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <FeatureCard
                icon="📊"
                title="Binary Markets"
                description="Each market has two outcomes: YES and NO. You buy shares of the outcome you believe will happen. Each share is worth $1 if correct, $0 if wrong."
                index={0}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <FeatureCard
                icon="💰"
                title="Dynamic Pricing"
                description="Share prices reflect the market's collective probability. As more people buy YES, the YES price increases. Prices always sum to $1 per outcome pair."
                index={1}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <FeatureCard
                icon="⚡"
                title="Instant Execution"
                description="No order books or waiting for counterparties. Trades execute instantly against the AMM. You can buy or sell shares at any time."
                index={2}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <FeatureCard
                icon="📈"
                title="Profit & Loss"
                description="If you buy YES shares at $0.60 and the market resolves YES, you profit $0.40 per share. You can also sell shares before resolution to lock in gains or losses."
                index={3}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <FeatureCard
                icon="🔄"
                title="Liquidity Pools"
                description="Liquidity providers earn fees from trades. You can add liquidity to any market to earn passive income, but be aware of impermanent loss risks."
                index={4}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <FeatureCard
                icon="🎯"
                title="Portfolio Tracking"
                description="Track all your positions, P&L, and trading history in your portfolio. Monitor your performance across all markets you've participated in."
                index={5}
              />
            </motion.div>
          </div>
        </div>
      </section>

      <GradientDivider className="max-w-4xl mx-auto" />

      {/* LMSR Technology Section */}
      <section className="section-padding bg-ink-black relative overflow-hidden">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-gradient-radial-iris opacity-5 blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-gradient-radial-aqua opacity-5 blur-3xl" />

        <div className="section-container relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
            <motion.div
              className="order-2 lg:order-1"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="relative">
                <LMSRAnimationSimple />
                <div className="absolute inset-0 bg-gradient-radial-iris opacity-20 blur-3xl -z-10" />
              </div>
            </motion.div>

            <motion.div
              className="order-1 lg:order-2"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <SectionHeader
                badge="Technology"
                title={
                  <>
                    Powered by <span className="text-gradient">LMSR</span>{" "}
                    Liquidity
                  </>
                }
                subtitle="Logarithmic Market Scoring Rule ensures infinite liquidity, tight spreads, and mathematically optimal price discovery."
                animated={true}
              />

              <div className="mt-10 space-y-4">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <div className="p-4 bg-graphite-deep rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      No Order Books
                    </h3>
                    <p className="text-moon-grey text-sm leading-relaxed">
                      Trade instantly against the AMM - no waiting for
                      counterparties. The LMSR algorithm automatically provides
                      liquidity at all times.
                    </p>
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <div className="p-4 bg-graphite-deep rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Fair Pricing
                    </h3>
                    <p className="text-moon-grey text-sm leading-relaxed">
                      Prices reflect true probability based on market activity.
                      The LMSR formula ensures prices are always mathematically
                      consistent and arbitrage-free.
                    </p>
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <div className="p-4 bg-graphite-deep rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Deep Liquidity
                    </h3>
                    <p className="text-moon-grey text-sm leading-relaxed">
                      Always execute trades, even in low-volume markets. The
                      LMSR guarantees liquidity for any trade size, though
                      larger trades may have higher slippage.
                    </p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <GradientDivider className="max-w-4xl mx-auto" />

      {/* Resolution Section */}
      <section className="section-padding bg-graphite-deep relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-5" />
        <div className="section-container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <SectionHeader
              title="Market Resolution"
              subtitle="How outcomes are determined and payouts are distributed"
              align="center"
              size="lg"
            />
          </motion.div>

          <div className="max-w-4xl mx-auto mt-16 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="p-8 bg-ink-black rounded-2xl border border-white/5"
            >
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-neon-iris/20 flex items-center justify-center text-2xl">
                  🎯
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-white mb-3">
                    Bonded Resolvers
                  </h3>
                  <p className="text-moon-grey leading-relaxed mb-4">
                    Markets are resolved by bonded resolvers who stake USDC as
                    collateral. This economic incentive ensures honest
                    resolution. Resolvers who resolve incorrectly lose their
                    bond.
                  </p>
                  <ul className="space-y-2 text-moon-grey text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-neon-iris mt-1">•</span>
                      <span>
                        Resolvers review the market's resolution criteria and
                        real-world evidence
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-neon-iris mt-1">•</span>
                      <span>
                        They submit a resolution decision (YES or NO) with
                        evidence
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-neon-iris mt-1">•</span>
                      <span>
                        If the resolution is disputed, a dispute process begins
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-neon-iris mt-1">•</span>
                      <span>
                        Honest resolvers earn fees; dishonest ones lose their
                        bond
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="p-8 bg-ink-black rounded-2xl border border-white/5"
            >
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-neon-iris/20 flex items-center justify-center text-2xl">
                  💸
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-white mb-3">
                    Automatic Payouts
                  </h3>
                  <p className="text-moon-grey leading-relaxed mb-4">
                    Once a market is resolved, payouts happen automatically on
                    Solana. No manual withdrawal needed—your USDC appears in
                    your wallet instantly.
                  </p>
                  <ul className="space-y-2 text-moon-grey text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-neon-iris mt-1">•</span>
                      <span>Each winning share is worth exactly $1 USDC</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-neon-iris mt-1">•</span>
                      <span>
                        Payouts are sent directly to your connected wallet
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-neon-iris mt-1">•</span>
                      <span>
                        You can withdraw your USDC to any Solana wallet at any
                        time
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <GradientDivider className="max-w-4xl mx-auto" />

      {/* CTA Section */}
      <section className="section-padding bg-ink-black relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="section-container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Start Trading?
            </h2>
            <p className="text-xl text-moon-grey mb-8 leading-relaxed">
              Join thousands of traders making predictions on future events.
              Connect your wallet and start trading in seconds.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/markets"
                className="px-8 py-4 bg-gradient-brand text-white font-semibold rounded-xl hover:shadow-button-primary-hover transition-all duration-200"
              >
                Browse Markets
              </Link>
              <Link
                to="/create"
                className="px-8 py-4 bg-graphite-deep border border-white/10 text-white font-semibold rounded-xl hover:border-neon-iris/50 hover:bg-graphite-hover transition-all duration-200"
              >
                Create a Market
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};
