import React from "react";
import { buildQrDataUrl } from "../../core/qr/qrUtils";

export function RoomQrCode({ value, code }: { value: string; code: string }) {
  const [src, setSrc] = React.useState("");
  React.useEffect(() => {
    let active = true;
    void buildQrDataUrl(value).then((url) => { if (active) setSrc(url); });
    return () => { active = false; };
  }, [value]);
  return (
    <div className="mafia-qr-card">
      <span className="mafia-eyebrow">QR-код комнаты</span>
      {src ? <img src={src} alt={`QR-код комнаты ${code}`} /> : <div className="mafia-qr-skeleton" />}
      <strong>{code}</strong>
      <p>Отсканируйте код, чтобы сразу присоединиться к комнате.</p>
    </div>
  );
}
