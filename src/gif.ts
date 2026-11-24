// A SMALL GIF WRITER, for saving a goal's replay (App.tsx meClipGif). No dependency: an animated GIF is a header, one
// palette, and each frame's pixels as palette indices packed with LZW. The pictures it is given are flat colour (a
// pitch, dots, lines, a caption), so one fixed palette built from the colours actually drawn, with a coarse cube under
// it for the blends at their edges, is all the quantising it needs.

/** A palette of at most 256 colours: `named` first (the exact colours drawn), then a cube of `cube` steps a channel. `index(r, g, b)`
 *  gives the nearest entry, remembered per 15-bit colour so a frame costs one lookup a pixel. */
export function gifPalette(named: number[][], cube = 6) {
  const cols: number[][] = [];
  const room = 256 - cube * cube * cube, lv = (i: number) => Math.round(i * 255 / (cube - 1));
  for (const c of named) if (cols.length < room && !cols.some(d => d[0] === c[0] && d[1] === c[1] && d[2] === c[2])) cols.push(c);
  for (let r = 0; r < cube; r++) for (let g = 0; g < cube; g++) for (let b = 0; b < cube; b++) cols.push([lv(r), lv(g), lv(b)]);
  cols.length = Math.min(cols.length, 256);
  const table = new Uint8Array(768);
  cols.forEach((c, i) => { table[i * 3] = c[0]; table[i * 3 + 1] = c[1]; table[i * 3 + 2] = c[2]; });
  const cache = new Int16Array(32768).fill(-1);
  const index = (r: number, g: number, b: number) => {
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let v = cache[k];
    if (v >= 0) return v;
    let bd = Infinity; v = 0;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i], d = (c[0] - r) * (c[0] - r) + (c[1] - g) * (c[1] - g) + (c[2] - b) * (c[2] - b);
      if (d < bd) { bd = d; v = i; }
    }
    cache[k] = v;
    return v;
  };
  return { table, index };
}

// LZW, as the format wants it: codes that grow from nine bits to twelve, packed low bit first, in blocks of 255 bytes.
function lzw(px: Uint8Array, out: number[]) {
  const MIN = 8, CLEAR = 1 << MIN, EOI = CLEAR + 1;
  out.push(MIN);
  let buf: number[] = [], acc = 0, bits = 0, size = MIN + 1, next = EOI + 1;
  const flush = () => { if (buf.length) { out.push(buf.length); for (const b of buf) out.push(b); buf = []; } };
  const emit = (code: number) => {
    acc |= code << bits; bits += size;
    while (bits >= 8) { buf.push(acc & 255); acc >>>= 8; bits -= 8; if (buf.length === 255) flush(); }
  };
  let dict = new Map<number, number>();
  emit(CLEAR);
  let cur = px[0];
  for (let i = 1; i < px.length; i++) {
    const k = px[i], key = (cur << 8) | k, hit = dict.get(key);
    if (hit !== undefined) { cur = hit; continue; }
    emit(cur);
    if (next === 4096) { emit(CLEAR); next = EOI + 1; size = MIN + 1; dict = new Map(); }
    else { if (next >= (1 << size)) size++; dict.set(key, next++); }
    cur = k;
  }
  emit(cur); emit(EOI);
  if (bits > 0) { buf.push(acc & 255); }
  flush();
  out.push(0);
}

/** An animated GIF of w x h in one palette, looping. frame(pixels as palette indices, delay in hundredths of a second). */
export function gifWriter(w: number, h: number, table: Uint8Array) {
  const out: number[] = [];
  const u16 = (v: number) => { out.push(v & 255, (v >> 8) & 255); };
  for (const ch of "GIF89a") out.push(ch.charCodeAt(0));
  u16(w); u16(h); out.push(0xf7, 0, 0);                         // a global table of 256
  for (let i = 0; i < 768; i++) out.push(table[i]);
  out.push(0x21, 0xff, 11); for (const ch of "NETSCAPE2.0") out.push(ch.charCodeAt(0)); out.push(3, 1, 0, 0, 0);   // loop for ever
  return {
    frame(px: Uint8Array, delay: number) {
      out.push(0x21, 0xf9, 4, 0); u16(Math.max(2, Math.round(delay))); out.push(0, 0);
      out.push(0x2c); u16(0); u16(0); u16(w); u16(h); out.push(0);
      lzw(px, out);
    },
    finish() { out.push(0x3b); return new Uint8Array(out); },
  };
}
