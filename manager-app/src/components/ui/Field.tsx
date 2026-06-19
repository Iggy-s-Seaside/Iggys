import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

interface FieldRenderProps {
  /** Wire this onto the control: <input id={id} .../> or <Select id={id} .../>. */
  id: string;
  /** Set as aria-describedby when a hint or error is shown. */
  'aria-describedby'?: string;
  /** True when an error is present — useful for aria-invalid. */
  'aria-invalid'?: boolean;
}

interface FieldProps {
  /** The visible field label (rendered with the app's .label style). */
  label: string;
  /**
   * The control. Either a single element (the generated id is cloned in) or a
   * render-prop that receives the id + a11y props to spread onto your control.
   */
  children: ReactElement | ((props: FieldRenderProps) => ReactNode);
  /** Helper text under the control. Hidden when an error is showing. */
  hint?: string;
  /** Error text — replaces the hint and tints the message in danger. */
  error?: string;
  /** Shows a danger asterisk after the label. */
  required?: boolean;
  /** Explicit id; otherwise a stable useId() value is generated. */
  id?: string;
  /** Extra classes for the wrapping element. */
  className?: string;
}

/**
 * Label + control wrapper that wires htmlFor/id via useId, plus optional hint,
 * error and required marker — replacing the repeated
 * `<label className="label">…</label>` + control + helper-text trios. Works with
 * a plain <input className="input-field"> (id is cloned in) or the themed
 * <Select> (which accepts an `id` prop), and with a render-prop for full control.
 */
export function Field({
  label,
  children,
  hint,
  error,
  required = false,
  id,
  className,
}: FieldProps) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const messageId = `${fieldId}-msg`;
  const describedBy = error || hint ? messageId : undefined;

  const renderProps: FieldRenderProps = {
    id: fieldId,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
  };

  let control: ReactNode;
  if (typeof children === 'function') {
    control = children(renderProps);
  } else if (isValidElement(children)) {
    control = cloneElement(
      children as ReactElement<Record<string, unknown>>,
      renderProps as unknown as Record<string, unknown>,
    );
  } else {
    control = children;
  }

  return (
    <div className={className}>
      <label htmlFor={fieldId} className="label">
        {label}
        {required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
      </label>
      {control}
      {error ? (
        <p id={messageId} className="text-xs text-danger mt-1.5">{error}</p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-text-muted mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

export default Field;
