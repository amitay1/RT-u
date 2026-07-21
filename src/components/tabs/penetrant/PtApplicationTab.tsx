import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  PenetrantMethod,
  PtApplication,
  PtMethodARinse,
  PtMethodBdEmulsifier,
  PtMethodCRemoval,
  PtMethodDRinses,
  PtRemoval,
  TemperatureUnit,
  TimeUnit,
} from '@/types/penetrant';
import { NumberField, SelectField, TextAreaField, TextField } from '@/components/tabs/shared/FieldRow';

interface Props {
  data: PtApplication;
  onChange: (d: PtApplication) => void;
  method: PenetrantMethod;
  removal: PtRemoval;
  onRemovalChange: (d: PtRemoval) => void;
}

const TIME_UNIT_OPTIONS = [
  { label: 'seconds', value: 's' },
  { label: 'minutes', value: 'min' },
] as const;

const TEMPERATURE_UNIT_OPTIONS = [
  { label: '°C', value: 'degC' },
  { label: '°F', value: 'degF' },
] as const;

interface TemperatureRangeFieldsProps {
  label: string;
  minValue: PtApplication['partTemperatureMin'];
  maxValue: PtApplication['partTemperatureMax'];
  unit: TemperatureUnit;
  onMinChange: (value: PtApplication['partTemperatureMin']) => void;
  onMaxChange: (value: PtApplication['partTemperatureMax']) => void;
  onUnitChange: (value: TemperatureUnit) => void;
}

const temperatureUnitLabel = (unit: TemperatureUnit) => {
  if (unit === 'degC') return '°C';
  if (unit === 'degF') return '°F';
  return '';
};

const TemperatureRangeFields = ({
  label,
  minValue,
  maxValue,
  unit,
  onMinChange,
  onMaxChange,
  onUnitChange,
}: TemperatureRangeFieldsProps) => (
  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px] md:col-span-2">
    <NumberField label={`${label} — Minimum`} value={minValue} onChange={onMinChange} unit={temperatureUnitLabel(unit)} />
    <NumberField label={`${label} — Maximum`} value={maxValue} onChange={onMaxChange} unit={temperatureUnitLabel(unit)} />
    <SelectField label="Unit" value={unit} onChange={onUnitChange} options={TEMPERATURE_UNIT_OPTIONS} />
  </div>
);

interface MethodARemovalFieldsProps {
  data: PtMethodARinse;
  onChange: (data: PtMethodARinse) => void;
}

const MethodARemovalFields = ({ data, onChange }: MethodARemovalFieldsProps) => {
  const set = <K extends keyof PtMethodARinse>(key: K, value: PtMethodARinse[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <TextAreaField
          label="Water-Rinse Instructions"
          value={data.instructions}
          onChange={v => set('instructions', v)}
          placeholder="Specify rinse technique, duration, nozzle distance, and completion criteria"
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px] md:col-span-2">
        <NumberField label="Rinse Pressure — Minimum" value={data.pressureMin} onChange={v => set('pressureMin', v)} unit={data.pressureUnit} min={0} />
        <NumberField label="Rinse Pressure — Maximum" value={data.pressureMax} onChange={v => set('pressureMax', v)} unit={data.pressureUnit} min={0} />
        <TextField label="Unit" value={data.pressureUnit} onChange={v => set('pressureUnit', v)} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px] md:col-span-2">
        <NumberField
          label="Rinse Temperature — Minimum"
          value={data.temperatureMin}
          onChange={v => set('temperatureMin', v)}
          unit={temperatureUnitLabel(data.temperatureUnit)}
        />
        <NumberField
          label="Rinse Temperature — Maximum"
          value={data.temperatureMax}
          onChange={v => set('temperatureMax', v)}
          unit={temperatureUnitLabel(data.temperatureUnit)}
        />
        <SelectField
          label="Unit"
          value={data.temperatureUnit}
          onChange={(v: TemperatureUnit) => set('temperatureUnit', v)}
          options={TEMPERATURE_UNIT_OPTIONS}
        />
      </div>
    </div>
  );
};

interface MethodBdRemovalFieldsProps {
  data: PtMethodBdEmulsifier;
  onChange: (data: PtMethodBdEmulsifier) => void;
  method: 'B' | 'D';
}

const MethodBdRemovalFields = ({ data, onChange, method }: MethodBdRemovalFieldsProps) => {
  const set = <K extends keyof PtMethodBdEmulsifier>(key: K, value: PtMethodBdEmulsifier[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <TextField
        label={method === 'B' ? 'Lipophilic Emulsifier Type' : 'Hydrophilic Remover Type'}
        value={data.type}
        onChange={v => set('type', v)}
        placeholder={method === 'B' ? 'Specified lipophilic emulsifier' : 'Specified hydrophilic remover'}
      />
      {method === 'D' ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
          <NumberField
            label="Planned Hydrophilic Concentration"
            value={data.concentration}
            onChange={v => set('concentration', v)}
            unit={data.concentrationUnit}
            min={0}
          />
          <TextField label="Unit" value={data.concentrationUnit} onChange={v => set('concentrationUnit', v)} />
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
        <NumberField
          label="Planned Contact Time"
          value={data.contactTime}
          onChange={v => set('contactTime', v)}
          unit={data.contactTimeUnit}
          min={0}
        />
        <SelectField
          label="Unit"
          value={data.contactTimeUnit}
          onChange={(v: TimeUnit) => set('contactTimeUnit', v)}
          options={TIME_UNIT_OPTIONS}
        />
      </div>
      <div className="md:col-span-2">
        <TextAreaField
          label={method === 'B' ? 'Lipophilic Emulsifier Application Instructions' : 'Hydrophilic Remover Application Instructions'}
          value={data.applicationMethod}
          onChange={v => set('applicationMethod', v)}
          placeholder="Specify application technique and process controls"
        />
      </div>
      <div className="md:col-span-2">
        <TextAreaField
          label="Post-Emulsification Water-Rinse Instructions"
          value={data.postEmulsifierRinseInstructions}
          onChange={v => set('postEmulsifierRinseInstructions', v)}
          placeholder="Specify the required water rinse and completion criteria"
        />
      </div>
    </div>
  );
};

interface MethodCRemovalFieldsProps {
  data: PtMethodCRemoval;
  onChange: (data: PtMethodCRemoval) => void;
}

const MethodCRemovalFields = ({ data, onChange }: MethodCRemovalFieldsProps) => (
  <TextAreaField
    label="Solvent-Removal Instructions"
    value={data.removerInstructions}
    onChange={removerInstructions => onChange({ ...data, removerInstructions })}
    placeholder="Specify wiping sequence, remover application restrictions, and completion criteria"
  />
);

interface MethodDRinseFieldsProps {
  data: PtMethodDRinses;
  onChange: (data: PtMethodDRinses) => void;
}

const MethodDRinseFields = ({ data, onChange }: MethodDRinseFieldsProps) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div className="md:col-span-2">
      <TextAreaField
        label="Pre-Rinse Instructions"
        value={data.preRinseInstructions}
        onChange={preRinseInstructions => onChange({ ...data, preRinseInstructions })}
        placeholder="Specify the pre-rinse before hydrophilic remover application"
      />
    </div>
    <div className="md:col-span-2">
      <TextAreaField
        label="Final-Rinse Instructions"
        value={data.finalRinseInstructions}
        onChange={finalRinseInstructions => onChange({ ...data, finalRinseInstructions })}
        placeholder="Specify the final rinse and removal completion criteria"
      />
    </div>
  </div>
);

export const PtApplicationTab = ({ data, onChange, method, removal, onRemovalChange }: Props) => {
  const set = <K extends keyof PtApplication>(k: K, v: PtApplication[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>4. Application Process</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Penetrant Application Plan</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="Application Method / Instructions"
              value={data.applicationMethod}
              onChange={v => set('applicationMethod', v)}
              placeholder="Specify spray, immersion, brush, or other approved technique"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
              <NumberField
                label="Required Penetrant Dwell Time"
                value={data.dwellTime}
                onChange={v => set('dwellTime', v)}
                unit={data.dwellTimeUnit}
                min={0}
              />
              <SelectField
                label="Unit"
                value={data.dwellTimeUnit}
                onChange={(v: TimeUnit) => set('dwellTimeUnit', v)}
                options={TIME_UNIT_OPTIONS}
              />
            </div>
            <TemperatureRangeFields
              label="Required Part Temperature"
              minValue={data.partTemperatureMin}
              maxValue={data.partTemperatureMax}
              unit={data.partTemperatureUnit}
              onMinChange={v => set('partTemperatureMin', v)}
              onMaxChange={v => set('partTemperatureMax', v)}
              onUnitChange={v => set('partTemperatureUnit', v)}
            />
            <TemperatureRangeFields
              label="Required Penetrant Temperature"
              minValue={data.penetrantTemperatureMin}
              maxValue={data.penetrantTemperatureMax}
              unit={data.penetrantTemperatureUnit}
              onMinChange={v => set('penetrantTemperatureMin', v)}
              onMaxChange={v => set('penetrantTemperatureMax', v)}
              onUnitChange={v => set('penetrantTemperatureUnit', v)}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Excess Penetrant Removal Plan</h3>
            {method ? <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">Method {method}</span> : null}
          </div>

          {!method ? (
            <p className="text-sm text-muted-foreground">
              Select Method A, B, C, or D in Materials to configure the applicable removal controls.
            </p>
          ) : null}
          {method === 'A' ? (
            <MethodARemovalFields
              data={removal.methodA}
              onChange={methodA => onRemovalChange({ ...removal, methodA })}
            />
          ) : null}
          {method === 'B' ? (
            <MethodBdRemovalFields
              data={removal.methodBD}
              method="B"
              onChange={methodBD => onRemovalChange({ ...removal, methodBD })}
            />
          ) : null}
          {method === 'C' ? (
            <MethodCRemovalFields
              data={removal.methodC}
              onChange={methodC => onRemovalChange({ ...removal, methodC })}
            />
          ) : null}
          {method === 'D' ? (
            <div className="space-y-6">
              <MethodDRinseFields
                data={removal.methodD}
                onChange={methodD => onRemovalChange({ ...removal, methodD })}
              />
              <MethodBdRemovalFields
                data={removal.methodBD}
                method="D"
                onChange={methodBD => onRemovalChange({ ...removal, methodBD })}
              />
            </div>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
};
