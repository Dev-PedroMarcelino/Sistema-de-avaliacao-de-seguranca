#!/usr/bin/env node
// Converte o vídeo da integração para HLS adaptativo (720p + 360p), que carrega bem no 4G fraco da mina.
//
// Uso:  npm run video:preparar -- caminho/do/video.mp4 [pasta-de-saida]
// Saída: <pasta>/master.m3u8 (suba a pasta inteira para o Storage e use a URL do master.m3u8 no painel)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function ffmpegPath() {
  try {
    return require("ffmpeg-static");
  } catch {
    return "ffmpeg";
  }
}

const [entrada, saidaArg] = process.argv.slice(2);
if (!entrada || !fs.existsSync(entrada)) {
  console.error("Uso: npm run video:preparar -- caminho/do/video.mp4 [pasta-de-saida]");
  process.exit(1);
}
const saida = path.resolve(saidaArg ?? path.join(path.dirname(entrada), path.parse(entrada).name + "-hls"));
fs.mkdirSync(path.join(saida, "720p"), { recursive: true });
fs.mkdirSync(path.join(saida, "360p"), { recursive: true });

const args = [
  "-y",
  "-i", entrada,
  "-filter_complex", "[0:v]split=2[a][b];[a]scale=-2:720[v720];[b]scale=-2:360[v360]",
  "-map", "[v720]", "-map", "0:a?",
  "-map", "[v360]", "-map", "0:a?",
  "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main", "-pix_fmt", "yuv420p",
  "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
  "-b:v:0", "1800k", "-maxrate:v:0", "2000k", "-bufsize:v:0", "3000k",
  "-b:v:1", "450k", "-maxrate:v:1", "550k", "-bufsize:v:1", "800k",
  "-c:a", "aac", "-b:a", "96k", "-ac", "2",
  "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod",
  "-hls_segment_filename", path.join(saida, "%v", "seg_%03d.ts"),
  "-master_pl_name", "master.m3u8",
  "-var_stream_map", "v:0,a:0,name:720p v:1,a:1,name:360p",
  path.join(saida, "%v", "index.m3u8"),
];

console.log(`Convertendo ${entrada} -> ${saida}`);
const r = spawnSync(ffmpegPath(), args, { stdio: "inherit" });
if (r.status !== 0) process.exit(r.status ?? 1);

const sonda = spawnSync(ffmpegPath(), ["-i", entrada], { encoding: "utf8" });
const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(sonda.stderr ?? "");
if (m) {
  const seg = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  console.log(`\nPronto. Duração do vídeo: ${seg.toFixed(1)} s (o painel também detecta sozinho).`);
}
console.log(`Suba a pasta ${saida} para o Storage e cole a URL do master.m3u8 no painel (Conteúdo).`);
