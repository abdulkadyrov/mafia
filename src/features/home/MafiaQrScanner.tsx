import React from "react";
import QrScanner from "qr-scanner";
import { extractMafiaRoomCode } from "../../core/qr/mafiaInvite";

export function MafiaQrScanner({ open, onClose, onRoomCode }: {
  open: boolean;
  onClose: () => void;
  onRoomCode: (code: string) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open || !videoRef.current) return undefined;
    setError("");
    const scanner = new QrScanner(videoRef.current, (result) => {
      const code = extractMafiaRoomCode(result.data);
      if (!code) {
        setError("Это не QR-код комнаты Mafia");
        return;
      }
      scanner.stop();
      onRoomCode(code);
    }, {
      preferredCamera: "environment",
      maxScansPerSecond: 10,
      highlightScanRegion: true,
      highlightCodeOutline: true,
      returnDetailedScanResult: true,
    });
    void QrScanner.hasCamera()
      .then((available) => available ? scanner.start() : Promise.reject(new Error("Камера не найдена")))
      .catch(() => setError("Не удалось открыть камеру. Разрешите доступ или выберите QR из галереи."));
    return () => scanner.destroy();
  }, [onRoomCode, open]);

  async function scanFile(file?: File) {
    if (!file) return;
    setError("");
    try {
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true, alsoTryWithoutScanRegion: true });
      const code = extractMafiaRoomCode(result.data);
      if (!code) throw new Error("invalid-room-code");
      onRoomCode(code);
    } catch {
      setError("QR-код комнаты не найден на изображении");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (!open) return null;
  return (
    <div className="mafia-modal-backdrop" onMouseDown={onClose}>
      <section className="mafia-modal mafia-scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="mafia-modal-close" onClick={onClose} aria-label="Закрыть сканер">×</button>
        <span className="mafia-eyebrow">Быстрый вход</span>
        <h2 id="scanner-title">Сканировать QR комнаты</h2>
        <p>Наведите камеру на приглашение — код комнаты определится автоматически.</p>
        <div className="mafia-scanner-viewport"><video ref={videoRef} playsInline muted /></div>
        {error ? <div className="mafia-form-error" role="alert">{error}</div> : null}
        <input ref={inputRef} className="mafia-visually-hidden" type="file" accept="image/*" onChange={(event) => void scanFile(event.target.files?.[0])} />
        <button className="mafia-secondary-button" onClick={() => inputRef.current?.click()}>Выбрать QR из галереи</button>
      </section>
    </div>
  );
}
