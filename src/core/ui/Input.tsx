import React from "react";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={[
        "h-12 w-full rounded-xl border border-white/12 bg-white/6 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-emerald-300/70 focus:bg-white/10",
        className,
      ].join(" ")}
      {...props}
    />
  );
});

Input.displayName = "Input";

