/**
 * Reusable UserAvatar component
 * Shows user's profile picture if available, otherwise shows a gradient circle with initial
 */
interface UserAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
  xl: "w-12 h-12 text-base",
};

const gradients = [
  "from-rose-400 to-pink-500",
  "from-violet-400 to-purple-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-fuchsia-400 to-pink-500",
];

export const UserAvatar = ({
  name,
  imageUrl,
  size = "md",
  className = "",
}: UserAvatarProps) => {
  const gradientIndex = name.charCodeAt(0) % gradients.length;

  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className={`${sizes[size]} rounded-full object-cover ring-2 ring-white/10`}
          onError={(e) => {
            // Fallback to gradient if image fails to load
            const img = e.target as HTMLImageElement;
            img.style.display = "none";
            const parent = img.parentElement;
            if (parent && !parent.querySelector(".avatar-fallback")) {
              const fallback = document.createElement("div");
              fallback.className = `avatar-fallback ${sizes[size]} rounded-full bg-gradient-to-br ${gradients[gradientIndex]} flex items-center justify-center font-bold text-white ring-2 ring-white/10`;
              fallback.textContent = name.charAt(0).toUpperCase();
              parent.appendChild(fallback);
            }
          }}
        />
      ) : (
        <div
          className={`${sizes[size]} rounded-full bg-gradient-to-br ${gradients[gradientIndex]} flex items-center justify-center font-bold text-white ring-2 ring-white/10`}
        >
          {name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
};
