import { useId } from 'react';
import type { SelectHTMLAttributes } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
}
export function Dropdown({
  label,
  options,
  id,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: DropdownOption[];
}) {
  const generated = useId();
  const controlId = id ?? generated;
  return (
    <div className="ui-field">
      <label htmlFor={controlId}>{label}</label>
      <select {...props} id={controlId}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
