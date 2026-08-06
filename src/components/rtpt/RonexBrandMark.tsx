import { ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Company wordmark shown at the top-left of the radiography workstation.
 * The full string is kept intact for assistive technology while the visual
 * layout splits it into a wordmark, a tagline and the modality badge.
 */
export const RONEX_BRAND_TEXT = "RONEX RADIOGRAPHYC TEST DR/CR/FILM";

interface RonexBrandMarkProps {
  /** `toolbar` = compact header variant, `page` = larger landing/activation variant. */
  variant?: "toolbar" | "page";
  className?: string;
}

export const RonexBrandMark = ({ variant = "toolbar", className }: RonexBrandMarkProps) => {
  const isPage = variant === "page";

  return (
    <div
      className={cn("flex min-w-fit items-center gap-3", className)}
      aria-label={RONEX_BRAND_TEXT}
      title={RONEX_BRAND_TEXT}
    >
      <div
        className={cn("ronex-brand-mark flex-none", isPage ? "h-12 w-12" : "h-10 w-10")}
        aria-hidden="true"
      >
        <ScanLine className={isPage ? "h-6 w-6" : "h-5 w-5"} />
      </div>

      <div className="leading-none" aria-hidden="true">
        {/* Bahnschrift is condensed, so it needs a touch more size than the UI face. */}
        <div className={cn("ronex-brand-word", isPage ? "text-[1.95rem]" : "text-xl")}>RONEX</div>
        <div className={cn("mt-1.5 flex items-center gap-2", isPage ? "" : "hidden lg:flex")}>
          <span className={cn("ronex-brand-tagline", isPage ? "text-[0.66rem]" : "text-[0.6rem]")}>
            Radiographyc Test
          </span>
          <span className="ronex-brand-divider" />
          <span className={cn("ronex-brand-modes", isPage ? "text-[0.6rem]" : "text-[0.55rem]")}>
            DR<i>/</i>CR<i>/</i>FILM
          </span>
        </div>
      </div>
    </div>
  );
};
