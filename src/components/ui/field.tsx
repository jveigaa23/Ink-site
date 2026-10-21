"use client";

import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";

/** Erros de validação do servidor por nome de campo, fornecidos pelo formulário. */
export const FormErrorsContext = createContext<Record<string, string> | undefined>(undefined);

function useFieldError(name: string | undefined, explicit?: string) {
  const ctx = useContext(FormErrorsContext);
  if (explicit) return explicit;
  if (!name || !ctx) return undefined;
  return ctx[name] ?? ctx[`contact.${name}`];
}

/**
 * Campos de formulário acessíveis: rótulo associado, dica e mensagem de erro
 * ligadas por aria-describedby, e aria-invalid quando há erro.
 */

const control =
  "w-full rounded-sm border border-ink-600 bg-ink-900 px-3.5 py-3 text-base text-bone placeholder:text-faint transition-colors focus:border-bone/70 focus:outline-none aria-invalid:border-danger sm:text-sm";

type FieldProps = { label: ReactNode; hint?: ReactNode; error?: string; required?: boolean; className?: string };

function Wrapper({
  id,
  label,
  hint,
  error,
  required,
  className = "",
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-bone-dim">
        {label}
        {required ? <span aria-hidden="true" className="text-accent"> *</span> : null}
        {required ? <span className="sr-only"> (obrigatório)</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: string) {
  return [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

export function TextField({ label, hint, error: explicitError, required, className, ...props }: FieldProps & ComponentProps<"input">) {
  const error = useFieldError(props.name, explicitError);
  const auto = useId();
  const id = props.id ?? auto;
  return (
    <Wrapper id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={control}
        {...props}
      />
    </Wrapper>
  );
}

export function TextArea({ label, hint, error: explicitError, required, className, ...props }: FieldProps & ComponentProps<"textarea">) {
  const error = useFieldError(props.name, explicitError);
  const auto = useId();
  const id = props.id ?? auto;
  return (
    <Wrapper id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea
        id={id}
        required={required}
        rows={props.rows ?? 4}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${control} resize-y leading-relaxed`}
        {...props}
      />
    </Wrapper>
  );
}

export function SelectField({
  label,
  hint,
  error: explicitError,
  required,
  className,
  children,
  ...props
}: FieldProps & ComponentProps<"select">) {
  const error = useFieldError(props.name, explicitError);
  const auto = useId();
  const id = props.id ?? auto;
  return (
    <Wrapper id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${control} appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none' stroke='%23a29d95' stroke-width='1.5'><path d='M1 1l5 5 5-5'/></svg>")] bg-[length:12px_8px] bg-[right_14px_center] bg-no-repeat pr-10`}
        {...props}
      >
        {children}
      </select>
    </Wrapper>
  );
}

export function CheckboxField({
  label,
  error: explicitError,
  hint,
  className = "",
  ...props
}: { label: ReactNode; error?: string; hint?: ReactNode; className?: string } & ComponentProps<"input">) {
  const error = useFieldError(props.name, explicitError);
  const auto = useId();
  const id = props.id ?? auto;
  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className="mt-0.5 size-5 shrink-0 accent-(--accent)"
          {...props}
        />
        <label htmlFor={id} className="text-sm leading-relaxed text-bone-dim">
          {label}
        </label>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 pl-8 text-xs text-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 pl-8 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
