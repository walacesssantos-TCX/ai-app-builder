from PIL import Image
import os
import struct
import io

source = r"D:\Projeto Fluxcodex\ChatGPT Image 9 de jun. de 2026, 22_48_55.png"
icons_dir = r"D:\Projeto Fluxcodex\ai-app-builder\src-tauri\icons"

img = Image.open(source).convert("RGBA")

# PNG sizes for Tauri bundle
png_sizes = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
}

for name, size in png_sizes.items():
    resized = img.resize((size, size), Image.LANCZOS)
    path = os.path.join(icons_dir, name)
    resized.save(path, "PNG")
    print(f"Saved {name} ({size}x{size})")

# ICO with multiple sizes (16, 24, 32, 48, 64, 128, 256)
ico_sizes = [16, 24, 32, 48, 64, 128, 256]
ico_path = os.path.join(icons_dir, "icon.ico")

# Convert each size to PNG bytes
png_data = {}
for s in ico_sizes:
    resized = img.resize((s, s), Image.LANCZOS)
    buf = io.BytesIO()
    resized.save(buf, format="PNG")
    png_data[s] = buf.getvalue()

# Write ICO file manually
with open(ico_path, "wb") as f:
    f.write(struct.pack("<HHH", 0, 1, len(ico_sizes)))
    offset = 6 + len(ico_sizes) * 16
    entries = []
    for s in ico_sizes:
        data = png_data[s]
        w = 0 if s >= 256 else s
        h = 0 if s >= 256 else s
        entries.append((w, h, len(data), offset))
        offset += len(data)
    for w, h, dlen, off in entries:
        f.write(struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, dlen, off))
    for s in ico_sizes:
        f.write(png_data[s])

print(f"Saved icon.ico with sizes: {ico_sizes}")
