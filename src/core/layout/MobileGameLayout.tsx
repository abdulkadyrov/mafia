export function MobileGameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="game-screen h-[100dvh] overflow-hidden">{children}</div>;
}

