import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const PIN_STROKE = "#6c9cbd";

function createPinSvg(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 40 48">
  <defs>
    <filter id="shadow" x="-30%" y="-20%" width="160%" height="150%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#0f172a" flood-opacity="0.2"/>
    </filter>
  </defs>
  <path
    filter="url(#shadow)"
    d="M20 1C10.06 1 3 8.4 3 18.2c0 11.8 14.2 26.1 16.2 28.1a1.2 1.2 0 0 0 1.6 0C22.8 44.3 37 29.9 37 18.2 37 8.4 29.94 1 20 1Z"
    fill="#ffffff"
    stroke="${PIN_STROKE}"
    stroke-width="2"
  />
</svg>`;
}

async function buildPin(outputPath, { width, height, logoSize }) {
  const pinBuffer = await sharp(Buffer.from(createPinSvg(width, height))).png().toBuffer();
  const logoBuffer = await sharp("public/icons/car-repair.png")
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const logoLeft = Math.round((width - logoSize) / 2);
  const logoTop = Math.round((17.5 / 48) * height - logoSize / 2);

  mkdirSync(resolve(outputPath, ".."), { recursive: true });

  await sharp(pinBuffer)
    .composite([{ input: logoBuffer, left: logoLeft, top: logoTop }])
    .png()
    .toFile(outputPath);
}

await buildPin("public/icons/service-map-pin.png", {
  width: 100,
  height: 120,
  logoSize: 48,
});
await buildPin("mobile-app/assets/icons/service-map-pin.png", {
  width: 132,
  height: 158,
  logoSize: 63,
});
console.log("service-map-pin.png generated");
