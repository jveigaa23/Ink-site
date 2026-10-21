import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold tracking-wide transition-[background-color,color,border-color,transform] duration-300 ease-(--ease-ink) disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-contrast hover:brightness-110",
  secondary: "border border-bone/30 text-bone hover:border-bone hover:bg-bone hover:text-ink-950",
  ghost: "text-bone-dim hover:text-bone hover:bg-ink-800",
  danger: "border border-danger/50 text-danger hover:bg-danger hover:text-ink-950",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-xs rounded-sm",
  md: "min-h-11 px-5 text-sm rounded-sm",
  lg: "min-h-13 px-7 text-sm uppercase tracking-[0.16em] rounded-sm",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Button({
  variant,
  size,
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
