import { NumberField, SelectField } from '@/components/tabs/shared/FieldRow';
import type { LengthUnit, NumberOrEmpty, RtCircumferentialPlan, RtCircumferentialSetupPlan } from '@/types/rtFilm';
import { calculateCircumferentialExposureCount } from '@/lib/rtCircumferential';
import type { Iso17636TestClass } from '@/lib/rtIso17636';

interface Props {
  plan?: RtCircumferentialPlan;
  onChange: (plan: RtCircumferentialPlan | null) => void;
  iso17636TestClass?: Iso17636TestClass;
  wallThickness: NumberOrEmpty;
  wallThicknessUnit: LengthUnit;
  sfd: NumberOrEmpty;
  sfdUnit: LengthUnit;
}

const LENGTH_UNITS: ReadonlyArray<{ label: string; value: LengthUnit }> = [
  { label: 'mm', value: 'mm' },
  { label: 'inch', value: 'inch' },
];

const SETUP_OPTIONS: ReadonlyArray<{ label: string; value: RtCircumferentialSetupPlan }> = [
  { label: 'External source, double wall (film-side weld)', value: 'external-double-wall' },
  { label: 'Internal source, centred panoramic', value: 'internal-panoramic' },
];

/**
 * Computed circumferential-coverage planning aid, shared by the RT-Film and
 * RT-CR exposure tabs. Clearing the pipe diameter removes the plan from the
 * controlled document entirely.
 */
export const CircumferentialPlanningCard = ({
  plan,
  onChange,
  iso17636TestClass,
  wallThickness,
  wallThicknessUnit,
  sfd,
  sfdUnit,
}: Props) => {
  const setDiameter = (value: NumberOrEmpty) => {
    if (value === '' || value <= 0) {
      onChange(null);
      return;
    }
    onChange({
      pipeOuterDiameter: value,
      pipeOuterDiameterUnit: plan?.pipeOuterDiameterUnit ?? 'mm',
      setup: plan?.setup ?? 'external-double-wall',
    });
  };

  const computeFor = (testClass: Iso17636TestClass) => (plan
    ? calculateCircumferentialExposureCount({
      setup: plan.setup,
      testClass,
      outerDiameter: plan.pipeOuterDiameter,
      outerDiameterUnit: plan.pipeOuterDiameterUnit,
      wallThickness,
      wallThicknessUnit,
      sfd,
      sfdUnit,
    })
    : null);

  const classes: Iso17636TestClass[] = iso17636TestClass ? [iso17636TestClass] : ['A', 'B'];

  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Circumferential coverage planning (computed)</h3>
        <p className="text-xs text-muted-foreground">
          Exact ray-geometry planning aid for pipe welds: the minimum number of exposures keeping the
          penetrated-thickness increase within the ISO 17636 class limit (20% class A / 10% class B).
          Uses the nominal wall thickness and default SFD; clear the pipe diameter to remove the plan.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
          <NumberField
            label="Pipe Outer Diameter"
            value={plan?.pipeOuterDiameter ?? ''}
            onChange={setDiameter}
            min={0}
          />
          <SelectField
            label="Unit"
            value={plan?.pipeOuterDiameterUnit ?? 'mm'}
            onChange={(pipeOuterDiameterUnit) => plan && onChange({ ...plan, pipeOuterDiameterUnit })}
            options={LENGTH_UNITS}
            disabled={!plan}
          />
        </div>
        <div className="md:col-span-2">
          <SelectField
            label="Exposure Setup"
            value={plan?.setup ?? 'external-double-wall'}
            onChange={(setup) => plan && onChange({ ...plan, setup })}
            options={SETUP_OPTIONS}
            disabled={!plan}
          />
        </div>
      </div>
      {plan ? (
        <div className="space-y-1 text-sm text-muted-foreground">
          {classes.map((testClass) => {
            const result = computeFor(testClass);
            return (
              <div key={testClass}>
                {result ? (
                  <>
                    Class {testClass}: minimum{' '}
                    <span className="font-medium text-foreground">{result.minimumExposureCount} exposures</span>
                    {' '}(coverage half-angle {result.coverageHalfAngleDeg}&deg;, limit x{result.thicknessIncreaseLimit}).
                  </>
                ) : (
                  <>Class {testClass}: enter a positive nominal wall thickness and default SFD (SFD must clear the pipe diameter).</>
                )}
              </div>
            );
          })}
          <div className="text-xs">
            Basis: film-side wall traced through the annulus; the controlled standard nomograms govern release.
          </div>
        </div>
      ) : null}
    </section>
  );
};
