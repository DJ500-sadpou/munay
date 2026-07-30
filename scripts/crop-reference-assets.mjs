import sharp from "sharp"

const SRC = "/tmp/munay-ref.png"
const OUT = "/vercel/share/v0-project/public/munay"

// Regiones recortadas del mockup de referencia (1024x1024)
const crops = [
  { name: "ref-hero-models", left: 414, top: 54, width: 274, height: 290, scale: 4 },
  { name: "ref-hero-phone", left: 786, top: 58, width: 144, height: 288, scale: 4 },
  { name: "ref-flash-jacket", left: 228, top: 410, width: 160, height: 148, scale: 4 },
  { name: "ref-live-woman", left: 830, top: 408, width: 136, height: 152, scale: 4 },
  { name: "ref-app-phone", left: 60, top: 866, width: 122, height: 90, scale: 5 },
  { name: "ref-qr", left: 866, top: 880, width: 62, height: 62, scale: 6 },
]

for (const c of crops) {
  await sharp(SRC)
    .extract({ left: c.left, top: c.top, width: c.width, height: c.height })
    .resize({
      width: Math.round(c.width * c.scale),
      height: Math.round(c.height * c.scale),
      kernel: "lanczos3",
    })
    .png({ quality: 100 })
    .toFile(`${OUT}/${c.name}.png`)
  console.log("[v0] cropped", c.name)
}
