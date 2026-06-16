import React from "react";
import { Card } from "../ui/Card";
import { buildQrDataUrl } from "./qrUtils";

export function QrCodeCard({ value, title }: { value: string; title: string }) {
  const [src, setSrc] = React.useState("");

  React.useEffect(() => {
    void buildQrDataUrl(value).then(setSrc);
  }, [value]);

  return (
    <Card>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
        QR
      </p>
      <h3 className="mt-2 text-xl font-black text-white">{title}</h3>
      {src ? (
        <img
          src={src}
          alt={title}
          className="mt-4 h-52 w-52 rounded-2xl border border-white/10 bg-[#04101d] p-3"
        />
      ) : (
        <div className="mt-4 h-52 w-52 rounded-2xl border border-white/10 bg-white/5" />
      )}
    </Card>
  );
}
