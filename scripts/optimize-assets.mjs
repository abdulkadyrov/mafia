import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const workspace = process.cwd();
const sourceRoot = path.join(workspace, "assets-source", "mafia");
const publicRoot = path.join(workspace, "public", "assets", "mafia");
const iconRoot = path.join(workspace, "public", "icons");

const backgroundSizes = [
  { suffix: "phone", width: 1080, height: 1920 },
  { suffix: "tablet", width: 1536, height: 2048 },
  { suffix: "desktop", width: 1920, height: 1080 },
];

await Promise.all([
  mkdir(path.join(publicRoot, "backgrounds"), { recursive: true }),
  mkdir(path.join(publicRoot, "roles"), { recursive: true }),
  mkdir(path.join(publicRoot, "avatars"), { recursive: true }),
  mkdir(iconRoot, { recursive: true }),
]);

const outputs = [];

for (const file of await pngFiles(path.join(sourceRoot, "backgrounds"))) {
  const name = path.basename(file, ".png");
  for (const size of backgroundSizes) {
    const pipeline = sharp(file)
      .resize(size.width, size.height, {
        fit: "cover",
        position: "centre",
        kernel: sharp.kernel.lanczos3,
      })
      .modulate({ saturation: 0.93 })
      .sharpen({ sigma: 0.45 });
    await writePair(pipeline, path.join(publicRoot, "backgrounds", `${name}-${size.suffix}`), {
      webp: 72,
      avif: 47,
    });
  }
}

for (const file of await pngFiles(path.join(sourceRoot, "roles"))) {
  const name = path.basename(file, ".png");
  const pipeline = sharp(file).resize(768, 1152, {
    fit: "cover",
    position: "centre",
    kernel: sharp.kernel.lanczos3,
  }).sharpen({ sigma: 0.35 });
  await writePair(pipeline, path.join(publicRoot, "roles", name), { webp: 76, avif: 51 });
}

const avatarSource = path.join(sourceRoot, "avatars", "default.png");
await writePair(
  sharp(avatarSource).resize(512, 512, { fit: "cover", position: "centre" }),
  path.join(publicRoot, "avatars", "default"),
  { webp: 78, avif: 54 }
);

for (const size of [180, 192, 512]) {
  const iconPath = path.join(iconRoot, `mafia-${size}.png`);
  await sharp(Buffer.from(iconArtwork(size, false)))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(iconPath);
  outputs.push(await describe(iconPath));
}

const maskablePath = path.join(iconRoot, "mafia-maskable-512.png");
await sharp(Buffer.from(iconArtwork(512, true)))
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(maskablePath);
outputs.push(await describe(maskablePath));

const splashIcon = await sharp(Buffer.from(iconArtwork(512, false))).png().toBuffer();
for (const { width, height } of [{ width: 1170, height: 2532 }, { width: 2048, height: 2732 }]) {
  const splashPath = path.join(iconRoot, `mafia-splash-${width}x${height}.png`);
  const iconSize = Math.round(Math.min(width, height) * 0.34);
  await sharp({ create: { width, height, channels: 4, background: "#070a0c" } })
    .composite([{
      input: await sharp(splashIcon).resize(iconSize, iconSize).png().toBuffer(),
      left: Math.round((width - iconSize) / 2),
      top: Math.round((height - iconSize) / 2 - height * 0.035),
    }])
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(splashPath);
  outputs.push(await describe(splashPath));
}

outputs.sort((left, right) => left.path.localeCompare(right.path));
await writeFile(
  path.join(publicRoot, "asset-report.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), files: outputs }, null, 2)}\n`
);

const oversized = outputs.filter((file) => {
  if (file.path.includes("/backgrounds/")) return file.bytes > 500_000;
  if (file.path.includes("/roles/")) return file.bytes > 250_000;
  return file.bytes > 100_000;
});
if (oversized.length > 0) {
  throw new Error(`Ассеты превышают допустимый размер:\n${oversized.map((file) => `${file.path}: ${file.bytes}`).join("\n")}`);
}

console.log(`Optimized ${outputs.length} Mafia assets (${formatBytes(outputs.reduce((sum, file) => sum + file.bytes, 0))}).`);

async function pngFiles(directory) {
  return (await readdir(directory))
    .filter((file) => file.endsWith(".png"))
    .sort()
    .map((file) => path.join(directory, file));
}

async function writePair(pipeline, destination, quality) {
  const webpPath = `${destination}.webp`;
  const avifPath = `${destination}.avif`;
  await Promise.all([
    pipeline.clone().webp({ quality: quality.webp, smartSubsample: true, effort: 6 }).toFile(webpPath),
    pipeline.clone().avif({ quality: quality.avif, effort: 6, chromaSubsampling: "4:2:0" }).toFile(avifPath),
  ]);
  outputs.push(await describe(webpPath), await describe(avifPath));
}

async function describe(file) {
  const metadata = await sharp(file).metadata();
  const details = await stat(file);
  return {
    path: `/${path.relative(path.join(workspace, "public"), file).split(path.sep).join("/")}`,
    bytes: details.size,
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
  };
}

function iconArtwork(size, maskable) {
  const inset = maskable ? 82 : 18;
  return `<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#161a1c"/><stop offset="1" stop-color="#050606"/></linearGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e2d3af"/><stop offset="1" stop-color="#8d7140"/></linearGradient>
    </defs>
    <rect width="512" height="512" rx="${maskable ? 0 : 112}" fill="url(#bg)"/>
    <rect x="${inset}" y="${inset}" width="${512 - inset * 2}" height="${512 - inset * 2}" rx="${maskable ? 68 : 92}" fill="none" stroke="#b89a62" stroke-width="10"/>
    <path d="M151 179c32-24 62-36 105-36s73 12 105 36l-24 17H175l-24-17Z" fill="#b42318"/>
    <path d="M183 192c11-65 30-91 73-91s62 26 73 91H183Z" fill="#050606" stroke="url(#gold)" stroke-width="7"/>
    <path d="M121 205c53-14 217-14 270 0-19 22-77 31-135 31s-116-9-135-31Z" fill="#050606" stroke="url(#gold)" stroke-width="7"/>
    <path d="M139 382V260h37l80 75 80-75h37v122h-42v-67l-75 69-75-69v67h-42Z" fill="url(#gold)"/>
    <path d="M154 410h204" stroke="#b42318" stroke-width="11" stroke-linecap="round"/>
  </svg>`;
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
