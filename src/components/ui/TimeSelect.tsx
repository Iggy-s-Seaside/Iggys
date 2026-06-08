import { Clock } from 'lucide-react';
import Select from './Select';
import { timeSelectOptions, type BusyWindow, type Space } from '../../lib/calendarDates';

interface TimeSelectProps {
  value: number | null;
  onChange: (value: number | null) => void;
  /** End pickers pass the chosen start so earlier/overlapping slots disable. */
  minValue?: number | null;
  /** Busy windows on the chosen date — overlapping slots show disabled inline. */
  busyWindows?: BusyWindow[];
  /** Space being booked — windows in a non-conflicting space won't disable slots. */
  space?: Space;
  /** Slot to center on open when nothing is selected (e.g. 1080 = 6:00 PM). */
  defaultScrollTo?: number;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  variant?: 'glass' | 'manager';
  id?: string;
}

export default function TimeSelect({
  value, onChange, minValue = null, busyWindows = [], space,
  defaultScrollTo, disabled, label, placeholder = 'Select…',
  variant = 'glass', id,
}: TimeSelectProps) {
  const options = timeSelectOptions({ minValue, busyWindows, space });
  return (
    <Select<number>
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      label={label}
      id={id}
      disabled={disabled}
      variant={variant}
      leadingIcon={Clock}
      defaultScrollTo={defaultScrollTo}
    />
  );
}
