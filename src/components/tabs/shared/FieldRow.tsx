import { ReactNode, useId } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface FieldShellProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  hintKind?: 'help' | 'unit';
  className?: string;
  children: ReactNode;
}

export const FieldShell = ({ label, htmlFor, hint, hintKind = 'help', className, children }: FieldShellProps) => (
  <div className={cn('field-shell flex min-w-0 flex-col gap-1.5', className)}>
    <Label htmlFor={htmlFor} className="flex min-h-5 flex-wrap items-center gap-1.5 text-xs font-medium tracking-[0.01em] text-muted-foreground">
      <span>{label}</span>
      {hint ? (
        hintKind === 'unit'
          ? <span className="field-unit">{hint}</span>
          : <span className="text-xs font-normal text-muted-foreground">— {hint}</span>
      ) : null}
    </Label>
    {children}
  </div>
);

interface TextFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
}

export const TextField = ({ id: providedId, label, value, onChange, placeholder, hint, disabled }: TextFieldProps) => {
  const generatedId = useId();
  const id = providedId ?? `${label.replace(/\s+/g, '-').toLowerCase()}-${generatedId.replace(/:/g, '')}`;
  return (
    <FieldShell label={label} htmlFor={id} hint={hint}>
      <Input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} />
    </FieldShell>
  );
};

interface TextAreaFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}

export const TextAreaField = ({ id: providedId, label, value, onChange, placeholder, rows = 3 }: TextAreaFieldProps) => {
  const generatedId = useId();
  const id = providedId ?? `${label.replace(/\s+/g, '-').toLowerCase()}-${generatedId.replace(/:/g, '')}`;
  return (
    <FieldShell label={label} htmlFor={id} className="md:col-span-2">
      <Textarea id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} />
    </FieldShell>
  );
};

interface NumberFieldProps {
  id?: string;
  label: string;
  value: number | '';
  onChange: (v: number | '') => void;
  unit?: string;
  step?: string | number;
  min?: number;
  max?: number;
  disabled?: boolean;
  readOnly?: boolean;
}

export const NumberField = ({ id: providedId, label, value, onChange, unit, step, min, max, disabled, readOnly }: NumberFieldProps) => {
  const generatedId = useId();
  const id = providedId ?? `${label.replace(/\s+/g, '-').toLowerCase()}-${generatedId.replace(/:/g, '')}`;
  return (
    <FieldShell label={label} htmlFor={id} hint={unit} hintKind="unit">
      <Input
        id={id}
        type="number"
        value={value === '' ? '' : value}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        readOnly={readOnly}
        onChange={e => {
          const raw = e.target.value;
          onChange(raw === '' ? '' : Number(raw));
        }}
      />
    </FieldShell>
  );
};

interface DateFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export const DateField = ({ id: providedId, label, value, onChange }: DateFieldProps) => {
  const generatedId = useId();
  const id = providedId ?? `${label.replace(/\s+/g, '-').toLowerCase()}-${generatedId.replace(/:/g, '')}`;
  return (
    <FieldShell label={label} htmlFor={id}>
      <Input id={id} type="date" value={value} onChange={e => onChange(e.target.value)} />
    </FieldShell>
  );
};

interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps<T extends string> {
  id?: string;
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<SelectOption | string>;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
}

export function SelectField<T extends string>({
  id: providedId,
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  disabled,
}: SelectFieldProps<T>) {
  const generatedId = useId();
  const id = providedId ?? `${label.replace(/\s+/g, '-').toLowerCase()}-${generatedId.replace(/:/g, '')}`;
  const normalised = options.map(o => (typeof o === 'string' ? { label: o, value: o } : o));
  return (
    <FieldShell label={label} htmlFor={id} hint={hint}>
      <Select value={value} onValueChange={v => onChange(v as T)} disabled={disabled}>
        <SelectTrigger id={id} disabled={disabled}>
          <SelectValue placeholder={placeholder ?? 'Select…'} />
        </SelectTrigger>
        <SelectContent>
          {normalised.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}
