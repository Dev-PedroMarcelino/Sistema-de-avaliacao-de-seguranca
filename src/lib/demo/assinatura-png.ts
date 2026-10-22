import { deflateSync } from "node:zlib";

// Gera um PNG de "assinatura" rabiscada para os dados fictícios do modo demo.

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo: string, dados: Buffer) {
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tam, corpo, crc]);
}

export function assinaturaPng(semente: number, largura = 360, altura = 120): string {
  const px = new Uint8Array(largura * altura * 4);
  const pintar = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xi = Math.round(x + dx);
        const yi = Math.round(y + dy);
        if (xi < 0 || yi < 0 || xi >= largura || yi >= altura) continue;
        const o = (yi * largura + xi) * 4;
        px[o] = 17;
        px[o + 1] = 24;
        px[o + 2] = 39;
        px[o + 3] = 255;
      }
  };
  const a = 2 + (semente % 5);
  const b = 3 + (semente % 7);
  for (let t = 0; t <= 1; t += 0.0004) {
    const x = 20 + t * (largura - 40) + Math.sin(t * Math.PI * 2 * b) * 14;
    const y = altura / 2 + Math.sin(t * Math.PI * 2 * a) * (altura / 4) * Math.cos(t * 9 + semente);
    pintar(x, y);
  }
  for (let t = 0; t <= 1; t += 0.002) pintar(40 + t * (largura - 120), altura - 22 + Math.sin(t * 6) * 3);

  const linhas = Buffer.alloc((largura * 4 + 1) * altura);
  for (let y = 0; y < altura; y++) {
    linhas[y * (largura * 4 + 1)] = 0;
    Buffer.from(px.buffer, y * largura * 4, largura * 4).copy(linhas, y * (largura * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr),
    bloco("IDAT", deflateSync(linhas)),
    bloco("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}
