import React from "react";

type PanelProps = React.HTMLAttributes<HTMLElement> & {
  as?: "section" | "article" | "div";
};

export function Panel({
  as = "section",
  className = "",
  children,
  ...props
}: PanelProps) {
  const Component = as;

  return (
    <Component
      className={[
        "rounded-2xl border border-zinc-200 bg-white/92 p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </Component>
  );
}
