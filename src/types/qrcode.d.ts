declare module 'qrcode' {
  type QRCodeToDataURLOptions = {
    margin?: number
    width?: number
  }

  export function toDataURL(data: string, options?: QRCodeToDataURLOptions): Promise<string>
}
