import React from "react";

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={[
        "rounded-3xl border border-white/10 bg-white/6 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.3)] backdrop-blur",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

