interface GradientAccentProps {
  color?: "neon-iris" | "rose" | "emerald" | "aqua-pulse";
  position?: "top" | "bottom" | "both";
  className?: string;
}

export const GradientAccent = ({
  color = "neon-iris",
  position = "both",
  className = "",
}: GradientAccentProps) => {
  const colorClass =
    color === "neon-iris"
      ? "via-neon-iris"
      : color === "rose"
      ? "via-rose-500"
      : color === "emerald"
      ? "via-emerald-500"
      : "via-aqua-pulse";

  return (
    <>
      {(position === "top" || position === "both") && (
        <div
          className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${colorClass}/50 to-transparent ${className}`}
        />
      )}
      {(position === "bottom" || position === "both") && (
        <div
          className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${colorClass}/30 to-transparent ${className}`}
        />
      )}
    </>
  );
};

