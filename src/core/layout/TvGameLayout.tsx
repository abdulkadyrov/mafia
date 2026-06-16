export function TvGameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="game-screen h-[100dvh] overflow-hidden px-4 py-3 xl:px-6">
      {children}
    </div>
  );
}

