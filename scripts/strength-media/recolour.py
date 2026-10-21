import sys, os, time, colorsys
from PIL import Image
D, slug = sys.argv[1], sys.argv[2]
TARGET = (0x5A, 0x65, 0x78)          # --s-strength
th, tl, ts = colorsys.rgb_to_hls(*[c / 255 for c in TARGET])
def is_orange(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return s > 0.28 and (h < 0.12 or h > 0.96) and r > 100 and r - b > 40
def recolour(im):
    px = im.load(); w, h = im.size; n = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and is_orange(r, g, b):
                _, l, _ = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
                # keep the shading (lightness) relative to the orange's, take the token's hue and saturation
                nr, ng, nb = colorsys.hls_to_rgb(th, max(0, min(1, tl * l / 0.5)), ts)
                px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a); n += 1
    return n
src = Image.open(f'{D}/files/images/animations/{slug}.webp')
frames, durs = [], []
t0 = time.time()
for i in range(src.n_frames):
    src.seek(i); f = src.convert('RGBA').resize((512, 512), Image.LANCZOS); recolour(f); frames.append(f); durs.append(src.info.get('duration', 50))
t1 = time.time()
out = f'{D}/recolour/{slug}-512.webp'
frames[0].save(out, save_all=True, append_images=frames[1:], duration=durs, loop=0, quality=70, method=4)
still = Image.open(f'{D}/files/images/classic/{slug}-start.webp').convert('RGBA'); recolour(still)
still.resize((512, 512), Image.LANCZOS).save(f'{D}/recolour/{slug}-start-512.webp', quality=80)
sheet = Image.new('RGBA', (1024, 512), (237, 233, 225, 255))
src.seek(0); sheet.alpha_composite(src.convert('RGBA').resize((512, 512)), (0, 0)); sheet.alpha_composite(frames[0], (512, 0))
sheet.convert('RGB').save(f'{D}/recolour/{slug}-before-after.jpg', quality=85)
print(slug, f'{src.n_frames} frames, recolour+resize {t1-t0:.1f}s', 'animated 512 webp', round(os.path.getsize(out)/1024), 'KB', 'still 512', round(os.path.getsize(f"{D}/recolour/{slug}-start-512.webp")/1024), 'KB')
