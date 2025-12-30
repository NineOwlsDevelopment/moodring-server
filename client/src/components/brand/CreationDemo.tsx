import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Step = "question" | "options" | "launch" | "success";

const DEMO_QUESTIONS = [
  "Will Bitcoin reach $100k by 2025?",
  "Will AI replace 50% of jobs by 2030?",
  "Will the Lakers win the NBA championship?",
  "Will it rain tomorrow?",
];

const DEMO_OPTIONS = [
  { yes: "YES", no: "NO" },
  { yes: "YES", no: "NO" },
  { yes: "YES", no: "NO" },
  { yes: "YES", no: "NO" },
];

export const CreationDemo = () => {
  const [currentStep, setCurrentStep] = useState<Step>("question");
  const [questionIndex, setQuestionIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        switch (prev) {
          case "question":
            return "options";
          case "options":
            return "launch";
          case "launch":
            return "success";
          case "success":
            setQuestionIndex((i) => (i + 1) % DEMO_QUESTIONS.length);
            return "question";
          default:
            return "question";
        }
      });
    }, 3000); // Change step every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const currentQuestion = DEMO_QUESTIONS[questionIndex];
  const currentOptions = DEMO_OPTIONS[questionIndex];

  return (
    <div className="relative w-full pointer-events-none">
      <div className="relative w-full">
        <AnimatePresence mode="wait">
          {currentStep === "question" && (
            <motion.div
              key="question"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="bg-graphite-deep/80 backdrop-blur-xl rounded-3xl border border-white/10 p-8 lg:p-10 shadow-2xl">
                <div className="text-xs text-moon-grey/50 uppercase tracking-wider mb-3">
                  Step 1: Ask Your Question
                </div>
                <motion.div
                  className="bg-graphite-light rounded-xl p-6 border border-white/5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="text-white font-medium text-lg lg:text-xl">
                    {currentQuestion}
                  </div>
                </motion.div>
                <motion.div
                  className="mt-4 flex items-center gap-2 text-xs text-moon-grey/40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="w-2 h-2 rounded-full bg-neon-iris animate-pulse" />
                  <span>Type your prediction question...</span>
                </motion.div>
              </div>
            </motion.div>
          )}

          {currentStep === "options" && (
            <motion.div
              key="options"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="bg-graphite-deep/80 backdrop-blur-xl rounded-3xl border border-white/10 p-8 lg:p-10 shadow-2xl">
                <div className="text-xs text-moon-grey/50 uppercase tracking-wider mb-3">
                  Step 2: Set Options
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <motion.div
                    className="bg-gradient-to-br from-neon-iris/30 to-neon-iris/15 rounded-xl p-6 border border-neon-iris/40"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="text-white font-semibold text-base lg:text-lg">
                      {currentOptions.yes}
                    </div>
                    <div className="text-neon-iris/60 text-xs mt-1">55%</div>
                  </motion.div>
                  <motion.div
                    className="bg-graphite-light rounded-xl p-6 border border-white/5"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="text-white font-semibold text-base lg:text-lg">
                      {currentOptions.no}
                    </div>
                    <div className="text-moon-grey/60 text-xs mt-1">45%</div>
                  </motion.div>
                </div>
                <motion.div
                  className="mt-4 flex items-center gap-2 text-xs text-moon-grey/40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="w-2 h-2 rounded-full bg-aqua-pulse animate-pulse" />
                  <span>Choose YES/NO or add custom options...</span>
                </motion.div>
              </div>
            </motion.div>
          )}

          {currentStep === "launch" && (
            <motion.div
              key="launch"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="bg-graphite-deep/80 backdrop-blur-xl rounded-3xl border border-white/10 p-8 lg:p-10 shadow-2xl">
                <div className="text-xs text-moon-grey/50 uppercase tracking-wider mb-3">
                  Step 3: Launch
                </div>
                <motion.div
                  className="bg-gradient-to-r from-neon-iris to-aqua-pulse rounded-xl p-6 text-center cursor-pointer relative overflow-hidden"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-neon-iris via-aqua-pulse to-neon-iris bg-[length:200%_100%]"
                    animate={{
                      backgroundPosition: ["0% 0%", "200% 0%"],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <div className="relative text-white font-semibold text-base lg:text-lg flex items-center justify-center gap-2">
                    <span>Create Market</span>
                    <motion.svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      animate={{ x: [0, 4, 0] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </motion.svg>
                  </div>
                </motion.div>
                <motion.div
                  className="mt-4 flex items-center gap-2 text-xs text-moon-grey/40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="w-2 h-2 rounded-full bg-aqua-pulse animate-pulse" />
                  <span>Add initial liquidity and launch...</span>
                </motion.div>
              </div>
            </motion.div>
          )}

          {currentStep === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="bg-graphite-deep/80 backdrop-blur-xl rounded-3xl border border-aqua-pulse/30 p-8 lg:p-10 shadow-2xl relative overflow-hidden">
                {/* Success glow effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-radial-aqua opacity-20 blur-3xl"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.2, 0.3, 0.2],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <div className="relative text-center">
                  <motion.div
                    className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-aqua-pulse/20 mb-6"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                      delay: 0.2,
                    }}
                  >
                    <motion.svg
                      className="w-10 h-10 text-aqua-pulse"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: 0.4 }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </motion.svg>
                  </motion.div>
                  <motion.h3
                    className="text-2xl lg:text-3xl font-bold text-white mb-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    Market Created!
                  </motion.h3>
                  <motion.p
                    className="text-moon-grey/70 text-sm lg:text-base"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    Your market is live on Solana
                  </motion.p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress indicators */}
        <div className="flex justify-center gap-2 mt-6">
          {(["question", "options", "launch", "success"] as Step[]).map(
            (step) => (
              <motion.div
                key={step}
                className={`h-1.5 rounded-full ${
                  currentStep === step
                    ? "bg-neon-iris w-8"
                    : "bg-white/10 w-1.5"
                }`}
                animate={{
                  width: currentStep === step ? 32 : 6,
                  opacity: currentStep === step ? 1 : 0.3,
                }}
                transition={{ duration: 0.3 }}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};
