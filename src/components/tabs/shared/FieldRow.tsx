import { ReactNode } from 'react';
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

interface FieldShellProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export const FieldShell = ({ label, htmlFor, hint, className, children }: FieldShellProps) => (
  <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
    <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground/85">
      {label}
      {hint ? <span className="ml-1 text-xs text-muted-foreground">({hint})</span> : null}
    </Label>
    {children}
  </div>
);

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}

export const TextField = ({ label, value, onChange, placeholder, hint }: TextFieldProps) => {
  const id = label.replace(/\s+/g, '-').toLowerCase();
  return (
    <FieldShell label={label} htmlFor={id} hint={hint}>
      <Input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </FieldShell>
  );
};

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}

export const TextAreaField = ({ label, value, onChange, placeholder, rows = 3 }: TextAreaFieldProps) => {
  const id = label.replace(/\s+/g, '-').toLowerCase();
  return (
    <FieldShell label={label} htmlFor={id} className="col-span-2">
      <Textarea id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} />
    </FieldShell>
  );
};

interface NumberFieldProps {
  label: string;
  value: number | '';
  onChange: (v: number | '') => void;
  unit?: string;
  step?: string | number;
  min?: number;
  max?: number;
}

export const NumberField = ({ label, value, onChange, unit, step, min, max }: NumberFieldProps) => {
  const id = label.replace(/\s+/g, '-').toLowerCase();
  return (
    <FieldShell label={label} htmlFor={id} hint={unit}>
      <Input
        id={id}
        type="number"
        value={value === '' ? '' : value}
        step={step}
        min={min}
        max={max}
        onChange={e => {
          const raw = e.target.value;
          onChange(raw === '' ? '' : Number(raw));
        }}
      />
    </FieldShell>
  );
};

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export const DateField = ({ label, value, onChange }: DateFieldProps) => {
  const id = label.replace(/\s+/g, '-').toLowerCase();
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
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<SelectOption | string>;
  placeholder?: string;
  hint?: string;
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
}: SelectFieldProps<T>) {
  const id = label.replace(/\s+/g, '-').toLowerCase();
  const normalised = options.map(o => (typeof o === 'string' ? { label: o, value: o } : o));
  return (
    <FieldShell label={label} htmlFor={id} hint={hint}>
      <Select value={value || undefined} onValueChange={v => onChange(v as T)}>
        <SelectTrigger id={id}>
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
