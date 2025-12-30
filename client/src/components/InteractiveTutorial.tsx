import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

const CRYPTO_QUESTIONS = [
  "Will Bitcoin reach $150,000 by end of 2026?",
  "Will Ethereum be above $8,000 by end of 2026?",
  "Will Solana reach $500 by end of 2026?",
  "Will Bitcoin be below $50,000 by end of 2026?",
  "Will Ethereum be above $10,000 by end of 2026?",
  "Will Solana be above $300 by end of 2026?",
  "Will Bitcoin reach $200,000 by end of 2026?",
  "Will Ethereum reach $12,000 by end of 2026?",
];

export const InteractiveTutorial = () => {
  const [selectedSide, setSelectedSide] = useState<"yes" | "no" | null>("yes");
  const [hasBought, setHasBought] = useState(false);
  const [isResolved, setIsResolved] = useState(false);
  const [won, setWon] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(
    CRYPTO_QUESTIONS[Math.floor(Math.random() * CRYPTO_QUESTIONS.length)]
  );

  const handleBuy = () => {
    if (selectedSide) {
      setHasBought(true);
      // Randomly resolve after a short delay
      setTimeout(() => {
        const randomResult = Math.random() > 0.5;
        setIsResolved(true);
        setWon(randomResult === (selectedSide === "yes"));
      }, 1500);
    }
  };

  const handleTryAgain = () => {
    setSelectedSide("yes");
    setHasBought(false);
    setIsResolved(false);
    setWon(false);
    setCurrentQuestion(
      CRYPTO_QUESTIONS[Math.floor(Math.random() * CRYPTO_QUESTIONS.length)]
    );
  };

  const yesPrice = 0.55;
  const noPrice = 0.45;

  return (
    <section className="relative py-16 lg:py-20 bg-ink-black overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid opacity-20" />
      <motion.div
        className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial-iris opacity-[0.03] blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.03, 0.05, 0.03],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <div className="section-container relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-6"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 tracking-tight">
            Try It{" "}
            <span className="bg-gradient-to-r from-neon-iris to-aqua-pulse bg-clip-text text-transparent">
              Yourself
            </span>
          </h2>
          <p className="text-lg text-moon-grey/80 font-light max-w-2xl mx-auto">
            Learn how prediction markets work with this interactive demo
          </p>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-graphite-deep rounded-3xl border border-white/10 p-6 lg:p-8 overflow-hidden relative">
            {/* Gradient accents */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-aqua-pulse/30 to-transparent" />

            {/* Question */}
            <div className="mb-6">
              <div className="text-xs text-moon-grey/60 mb-3 uppercase tracking-wider">
                Market Question
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white leading-tight">
                {currentQuestion}
              </h3>
            </div>

            <AnimatePresence mode="wait">
              {!isResolved ? (
                <motion.div
                  key="trading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* YES/NO Selection */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <motion.button
                      onClick={() => !hasBought && setSelectedSide("yes")}
                      disabled={hasBought}
                      className={`p-6 rounded-2xl border-2 transition-all ${
                        selectedSide === "yes"
                          ? "border-aqua-pulse bg-aqua-pulse/20 shadow-lg shadow-aqua-pulse/25"
                          : "border-white/10 bg-graphite-hover hover:border-aqua-pulse/50 hover:bg-aqua-pulse/5"
                      } ${hasBought ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      whileHover={!hasBought ? { scale: 1.02 } : {}}
                      whileTap={!hasBought ? { scale: 0.98 } : {}}
                    >
                      <div className="text-center">
                        <div className="text-xl font-bold text-aqua-pulse mb-2">
                          YES
                        </div>
                        <div className="text-3xl font-black text-white">
                          {(yesPrice * 100).toFixed(0)}¢
                        </div>
                      </div>
                    </motion.button>

                    <motion.button
                      onClick={() => !hasBought && setSelectedSide("no")}
                      disabled={hasBought}
                      className={`p-6 rounded-2xl border-2 transition-all ${
                        selectedSide === "no"
                          ? "border-rose-500 bg-rose-500/20 shadow-lg shadow-rose-500/25"
                          : "border-white/10 bg-graphite-hover hover:border-rose-500/50 hover:bg-rose-500/5"
                      } ${hasBought ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      whileHover={!hasBought ? { scale: 1.02 } : {}}
                      whileTap={!hasBought ? { scale: 0.98 } : {}}
                    >
                      <div className="text-center">
                        <div className="text-xl font-bold text-rose-400 mb-2">
                          NO
                        </div>
                        <div className="text-3xl font-black text-white">
                          {(noPrice * 100).toFixed(0)}¢
                        </div>
                      </div>
                    </motion.button>
                  </div>

                  {/* Buy Button */}
                  {selectedSide && !hasBought && (
                    <motion.button
                      onClick={handleBuy}
                      className="w-full py-4 rounded-xl font-semibold text-lg bg-neon-iris text-white hover:bg-neon-iris-light transition-all"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Buy {selectedSide.toUpperCase()} Share
                    </motion.button>
                  )}

                  {/* Processing state */}
                  {hasBought && !isResolved && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-8"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="w-12 h-12 border-4 border-neon-iris/30 border-t-neon-iris rounded-full mx-auto mb-4"
                      />
                      <div className="text-moon-grey/80">Resolving...</div>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-center py-8"
                >
                  <h3
                    className={`text-3xl font-bold mb-3 ${
                      won ? "text-aqua-pulse" : "text-rose-400"
                    }`}
                  >
                    {won ? "You Won" : "You Lost"}
                  </h3>
                  <p className="text-moon-grey/80 mb-6 text-lg">
                    {won
                      ? "The market resolved in your favor. You would have earned $1 per share!"
                      : "The market resolved against you. Better luck next time!"}
                  </p>
                  <motion.button
                    onClick={handleTryAgain}
                    className="px-8 py-3 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20 transition-all"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Try Again
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* CTA */}
          <div className="mt-8 text-center">
            <Link
              to="/markets"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-neon-iris text-white hover:bg-neon-iris-light transition-all"
            >
              Start Trading Real Markets
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
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
