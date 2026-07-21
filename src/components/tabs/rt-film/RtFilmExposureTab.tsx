import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RtFilmExposureFields } from '@/components/tabs/rt-film/RtFilmExposureFields';
import type { RtFilmExposureDefaults, RtFilmSource } from '@/types/rtFilm';

interface Props {
  data: RtFilmExposureDefaults;
  source: RtFilmSource;
  ps811000Applicable: boolean;
  onChange: (data: RtFilmExposureDefaults) => void;
}

export const RtFilmExposureTab = ({ data, source, ps811000Applicable, onChange }: Props) => (
  <Card>
    <CardHeader>
      <CardTitle>2. Exposure Defaults</CardTitle>
      <p className="text-sm text-muted-foreground">
        Starting values for new exposure views. Each view remains independently controlled and editable.
      </p>
    </CardHeader>
    <CardContent>
      <RtFilmExposureFields
        data={data}
        source={source}
        ps811000Applicable={ps811000Applicable}
        onChange={(patch) => onChange({ ...data, ...patch })}
      />
    </CardContent>
  </Card>
);
