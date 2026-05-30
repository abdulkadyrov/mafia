import React from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-black bg-black text-white shadow-[0_14px_40px_rgba(0,0,0,0.18)] hover:bg-zinc-800",
  secondary:
    "border-zinc-200 bg-white text-zinc-950 shadow-[0_12px_30px_rgba(15,23,42,0.08)] hover:bg-zinc-50",
  danger:
    "border-red-500 bg-white text-red-600 shadow-[0_12px_30px_rgba(239,68,68,0.12)] hover:bg-red-50",
  ghost:
    "border-transparent bg-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "secondary", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={[
          "min-h-12 rounded-lg border px-5 py-3 text-sm font-bold transition duration-200 ease-out",
          "focus:outline-none focus:ring-2 focus:ring-zinc-400/70 focus:ring-offset-2 focus:ring-offset-white",
          "disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          className,
        ].join(" ")}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
