import type { RtFilmGammaSourcePlan } from '@/types/rtFilm';
import { calculateDecayedActivity, resolveRtIsotope, RT_SUPPORTED_ISOTOPE_IDS } from '@/lib/rtIsotopeDecay';

const SUPPORTED_ISOTOPES = RT_SUPPORTED_ISOTOPE_IDS;

/** Local calendar date as YYYY-MM-DD, for the advisory "as of today" line only. */
const localIsoDate = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const formatActivity = (value: number, unit: string): string => (unit ? `${value} ${unit}` : `${value}`);

interface Props {
  gamma: RtFilmGammaSourcePlan;
  /** The technique's planned inspection date (general.date); drives the printed PDF value. */
  plannedInspectionDate: string;
}

/**
 * Computed half-life decay planning for a gamma source plan. Advisory only:
 * nothing here writes into the controlled document. Shared by the RT-Film and
 * RT-CR equipment tabs.
 */
export const GammaDecayPlanningPanel = ({ gamma, plannedInspectionDate }: Props) => {
  const isotope = resolveRtIsotope(gamma.isotope);
  const today = localIsoDate();
  const decayToday = isotope
    ? calculateDecayedActivity(gamma.activity, gamma.activityReferenceDate, today, isotope.halfLifeDays)
    : null;
  const decayAtPlannedDate = isotope
    ? calculateDecayedActivity(gamma.activity, gamma.activityReferenceDate, plannedInspectionDate, isotope.halfLifeDays)
    : null;

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm md:col-span-2">
      <div className="font-semibold">Decay planning (computed)</div>
      {!gamma.isotope ? (
        <div className="mt-1 text-muted-foreground">
          Enter the isotope to enable half-life decay planning. Built-in half-life data: {SUPPORTED_ISOTOPES}.
        </div>
      ) : !isotope ? (
        <div className="mt-1 text-muted-foreground">
          "{gamma.isotope}" is not in the built-in half-life library ({SUPPORTED_ISOTOPES}); decay is not computed.
        </div>
      ) : (
        <div className="mt-1 space-y-1 text-muted-foreground">
          <div>
            Half-life basis: {isotope.halfLifeDays} days ({isotope.displayName}, {isotope.id}).
          </div>
          {decayToday ? (
            <div>
              Activity today ({today}): <span className="font-medium text-foreground">{formatActivity(decayToday.decayedActivity, gamma.activityUnit)}</span>
              {' '}— decay factor {decayToday.decayFactor}, exposure-time correction x{decayToday.exposureTimeMultiplier}. Advisory only; not stored.
            </div>
          ) : (
            <div>Enter a positive planned activity and a valid activity reference date to compute decayed activity.</div>
          )}
          {decayAtPlannedDate ? (
            decayAtPlannedDate.elapsedDays >= 0 ? (
              <div>
                Activity at planned inspection date ({plannedInspectionDate}): <span className="font-medium text-foreground">{formatActivity(decayAtPlannedDate.decayedActivity, gamma.activityUnit)}</span>
                {' '}— decay factor {decayAtPlannedDate.decayFactor}, exposure-time correction x{decayAtPlannedDate.exposureTimeMultiplier}. Printed on the technique PDF.
              </div>
            ) : (
              <div className="text-amber-600 dark:text-amber-400">
                The activity reference date is after the planned inspection date; check the source certificate date.
              </div>
            )
          ) : (
            <div>Set the planned inspection date (General tab) to compute the activity used on the technique PDF.</div>
          )}
        </div>
      )}
    </div>
  );
};
