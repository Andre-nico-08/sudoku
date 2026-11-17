import React from "react";

export type AvatarMood = "idle" | "scanning" | "thinking" | "hint" | "error" | "solved";

interface TutorAvatarProps {
  mood: AvatarMood;
  size?: number;
}

export const TutorAvatar: React.FC<TutorAvatarProps> = ({ mood, size = 56 }) => {
  const accentColor =
    mood === "error"
      ? "#DC2626"
      : mood === "solved"
      ? "#059669"
      : mood === "hint"
      ? "#D97706"
      : "#0284C7";

  const bgTint =
    mood === "error"
      ? "#FEF2F2"
      : mood === "solved"
      ? "#ECFDF5"
      : mood === "hint"
      ? "#FFFBEB"
      : "#F0F9FF";

  return (
    <div
      className="relative shrink-0 select-none"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full transition-transform duration-300"
      >
        {/* Soft geometric backdrop */}
        <rect
          x="4"
          y="4"
          width="56"
          height="56"
          rx="16"
          fill={bgTint}
          stroke={accentColor}
          strokeWidth="1.5"
          strokeOpacity="0.35"
        />

        {/* Owl ears / geometric crown */}
        <path
          d="M18 20L24 14L27 20"
          stroke="#0F172A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M46 20L40 14L37 20"
          stroke="#0F172A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Face frame */}
        <rect
          x="16"
          y="19"
          width="32"
          height="28"
          rx="12"
          fill="#FFFFFF"
          stroke="#0F172A"
          strokeWidth="2"
        />

        {/* Eyes based on mood */}
        {mood === "solved" ? (
          <>
            <path
              d="M22 31C23.5 28.5 26.5 28.5 28 31"
              stroke="#059669"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M36 31C37.5 28.5 40.5 28.5 42 31"
              stroke="#059669"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </>
        ) : mood === "error" ? (
          <>
            <path d="M23 28L27 32M27 28L23 32" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M37 28L41 32M41 28L37 32" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round" />
          </>
        ) : mood === "thinking" ? (
          <>
            <circle cx="25" cy="30" r="3" fill="#0F172A" />
            <circle cx="39" cy="29" r="3" fill="#0F172A" />
            <path d="M21 25L28 26" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M36 26L43 24" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" />
          </>
        ) : mood === "scanning" ? (
          <>
            <rect x="21" y="28" width="8" height="4" rx="2" fill="#0284C7" />
            <rect x="35" y="28" width="8" height="4" rx="2" fill="#0284C7" />
            <line
              x1="18"
              y1="30"
              x2="46"
              y2="30"
              stroke="#0284C7"
              strokeWidth="1.2"
              strokeDasharray="2 2"
            />
          </>
        ) : (
          <>
            <circle cx="25" cy="30" r="3.2" fill="#0F172A" />
            <circle cx="26" cy="29" r="1" fill="#FFFFFF" />
            <circle cx="39" cy="30" r="3.2" fill="#0F172A" />
            <circle cx="40" cy="29" r="1" fill="#FFFFFF" />
          </>
        )}

        {/* Beak / expression */}
        {mood === "solved" ? (
          <path
            d="M28 38C30 40.5 34 40.5 36 38"
            stroke="#059669"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        ) : mood === "error" ? (
          <path
            d="M28 40C30 38 34 38 36 40"
            stroke="#DC2626"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : (
          <path d="M30 36L32 39L34 36H30Z" fill={accentColor} />
        )}

        {/* Hint lightbulb spark */}
        {mood === "hint" && (
          <g>
            <circle cx="52" cy="12" r="5" fill="#D97706" />
            <path d="M52 9.5V14.5M49.5 12H54.5" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </div>
  );
};
