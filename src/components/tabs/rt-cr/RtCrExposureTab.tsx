import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RtCrExposureFields } from '@/components/tabs/rt-cr/RtCrExposureFields';
import { CircumferentialPlanningCard } from '@/components/tabs/shared/CircumferentialPlanningCard';
import type { LengthUnit, NumberOrEmpty, RtCircumferentialPlan } from '@/types/rtFilm';
import type { RtCrExposureDefaults, RtCrSource } from '@/types/rtCr';

interface Props {
  data: RtCrExposureDefaults;
  source: RtCrSource;
  onChange: (data: RtCrExposureDefaults) => void;
  circumferentialPlan?: RtCircumferentialPlan;
  onCircumferentialPlanChange: (plan: RtCircumferentialPlan | null) => void;
  iso17636TestClass?: 'A' | 'B';
  nominalThickness: NumberOrEmpty;
  nominalThicknessUnit: LengthUnit;
}

export const RtCrExposureTab = ({
  data,
  source,
  onChange,
  circumferentialPlan,
  onCircumferentialPlanChange,
  iso17636TestClass,
  nominalThickness,
  nominalThicknessUnit,
}: Props) => (
  <Card>
    <CardHeader>
      <CardTitle>2. Exposure Defaults</CardTitle>
      <p className="text-sm text-muted-foreground">
        Starting values for new exposure views. Each view remains independently controlled and editable.
      </p>
    </CardHeader>
    <CardContent className="space-y-5">
      <RtCrExposureFields
        data={data}
        source={source}
        onChange={(patch) => onChange({ ...data, ...patch })}
      />
      <CircumferentialPlanningCard
        plan={circumferentialPlan}
        onChange={onCircumferentialPlanChange}
        iso17636TestClass={iso17636TestClass}
        wallThickness={nominalThickness}
        wallThicknessUnit={nominalThicknessUnit}
        sfd={data.sfd}
        sfdUnit={data.sfdUnit}
      />
    </CardContent>
  </Card>
);
