import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Company wordmark shown at the top-left of the radiography workstation.
 * The full string is kept intact for assistive technology while the visual
 * layout splits it into an emblem, a wordmark, a tagline and the modality chips.
 */
export const RONEX_BRAND_TEXT = "RONEX RADIOGRAPHIC TEST DR/CR/FILM";

const MODALITIES = ["DR", "CR", "FILM"] as const;

interface RonexBrandMarkProps {
  /** `toolbar` = compact header variant, `page` = larger landing/activation variant. */
  variant?: "toolbar" | "page";
  className?: string;
}

/**
 * Radiography emblem: source point, beam cone and detector plane, framed by
 * aperture corner ticks. Drawn on a 44-unit grid so the strokes stay on whole
 * pixels at the 44px toolbar size; the cone keeps explicit edge strokes so it
 * still reads as a beam where the fill gradient is nearly transparent.
 */
const RonexEmblem = ({ beamGradientId }: { beamGradientId: string }) => (
  <svg viewBox="0 0 44 44" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={beamGradientId} x1="22" y1="12" x2="22" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="currentColor" stopOpacity="0.34" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0.08" />
      </linearGradient>
    </defs>
    {/* aperture corner ticks */}
    <g stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round">
      <path d="M6.5 11 V7 h4.2" />
      <path d="M33.3 7 h4.2 v4" />
      <path d="M37.5 33 v4 h-4.2" />
      <path d="M10.7 37 H6.5 v-4" />
    </g>
    {/* beam cone from the source down to the detector */}
    <path d="M22 12 31 29.4 H13 Z" fill={`url(#${beamGradientId})`} />
    <path d="M22 12 13 29.4 M22 12 31 29.4" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.15" strokeLinecap="round" />
    <circle cx="22" cy="12" r="2.8" fill="currentColor" />
    {/* detector / film plane */}
    <path d="M12 30.6 h20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const RonexBrandMark = ({ variant = "toolbar", className }: RonexBrandMarkProps) => {
  const isPage = variant === "page";
  // useId() emits colons, which are not safe inside a url(#…) reference.
  const beamGradientId = `ronex-beam-${useId().replace(/:/g, "")}`;

  return (
    <div
      className={cn("ronex-brand group flex min-w-fit items-center", isPage ? "gap-3.5" : "gap-3", className)}
      aria-label={RONEX_BRAND_TEXT}
      title={RONEX_BRAND_TEXT}
    >
      <span className={cn("ronex-emblem", isPage ? "h-14 w-14" : "h-11 w-11")} aria-hidden="true">
        <RonexEmblem beamGradientId={beamGradientId} />
        <span className="ronex-emblem-sweep" />
      </span>

      <div className="min-w-0" aria-hidden="true">
        {/* Bahnschrift is condensed, so it needs a touch more size than the UI face. */}
        <div className={cn("ronex-brand-word", isPage ? "text-[2.05rem]" : "text-[1.38rem]")}>RONEX</div>
        <div className={cn("ronex-brand-rule", isPage ? "" : "hidden lg:block")} />
        <div className={cn("ronex-brand-sub", isPage ? "flex" : "hidden lg:flex")}>
          <span className={cn("ronex-brand-tagline", isPage ? "text-[0.7rem]" : "text-[0.62rem]")}>
            Radiographic Test
          </span>
          <span className="ronex-brand-modes">
            {MODALITIES.map(modality => (
              <span key={modality} className={cn("ronex-brand-mode", isPage ? "text-[0.58rem]" : "text-[0.55rem]")}>
                {modality}
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
};
