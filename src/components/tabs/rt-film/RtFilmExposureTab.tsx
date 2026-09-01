import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RtFilmExposureFields } from '@/components/tabs/rt-film/RtFilmExposureFields';
import { CircumferentialPlanningCard } from '@/components/tabs/shared/CircumferentialPlanningCard';
import type {
  NumberOrEmpty,
  LengthUnit,
  RtCircumferentialPlan,
  RtFilmExposureDefaults,
  RtFilmSource,
} from '@/types/rtFilm';

interface Props {
  data: RtFilmExposureDefaults;
  source: RtFilmSource;
  ps811000Applicable: boolean;
  onChange: (data: RtFilmExposureDefaults) => void;
  circumferentialPlan?: RtCircumferentialPlan;
  onCircumferentialPlanChange: (plan: RtCircumferentialPlan | null) => void;
  iso17636TestClass?: 'A' | 'B';
  nominalThickness: NumberOrEmpty;
  nominalThicknessUnit: LengthUnit;
}

export const RtFilmExposureTab = ({
  data,
  source,
  ps811000Applicable,
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
      <p className="note-clamp text-sm text-muted-foreground">
        Starting values for new exposure views. Each view remains independently controlled and editable.
      </p>
    </CardHeader>
    <CardContent className="space-y-5">
      <RtFilmExposureFields
        data={data}
        source={source}
        ps811000Applicable={ps811000Applicable}
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
