import { MobileGameLayout } from "./MobileGameLayout";
import { TvGameLayout } from "./TvGameLayout";

export function ResponsiveGameFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="block xl:hidden">
        <MobileGameLayout>{children}</MobileGameLayout>
      </div>
      <div className="hidden xl:block">
        <TvGameLayout>{children}</TvGameLayout>
      </div>
    </>
  );
}

