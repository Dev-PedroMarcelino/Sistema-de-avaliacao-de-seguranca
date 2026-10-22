#!/usr/bin/env node
// Gera o vídeo fictício do modo demo (slides com regras de segurança) em public/demo.
// Só precisa rodar de novo se mudar os slides.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");

const SLIDES = [
  ["INTEGRAÇÃO DE SEGURANÇA", "Motoristas externos • Mineração Demo"],
  ["1. VELOCIDADE MÁXIMA: 30 km/h", "Em toda a área da mina, carregado ou vazio."],
  ["2. SIGA O SINALEIRO", "Nas frentes de lavra, quem orienta a manobra é o sinaleiro."],
  ["3. FIQUE NA CABINE", "Durante o carregamento, não desça do caminhão."],
  ["4. DISTÂNCIA DAS MÁQUINAS", "O operador da máquina pesada pode não enxergar você."],
  ["5. FAROL ACESO E CINTO", "Farol ligado e cinto afivelado o tempo todo."],
];
const POR_SLIDE = 8;
const DURACAO = SLIDES.length * POR_SLIDE;

const pasta = path.resolve("public", "demo");
fs.mkdirSync(pasta, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "integra-video-"));

const fonte = (nome) => `C\\:/Windows/Fonts/${nome}`;
const filtros = ["drawbox=x=0:y=0:w=iw:h=28:color=0xF59E0B:t=fill", "drawbox=x=0:y=ih-28:w=iw:h=28:color=0xF59E0B:t=fill"];
SLIDES.forEach(([titulo, texto], i) => {
  const a = path.join(tmp, `t${i}.txt`).replaceAll("\\", "/").replace(":", "\\:");
  const b = path.join(tmp, `s${i}.txt`).replaceAll("\\", "/").replace(":", "\\:");
  fs.writeFileSync(path.join(tmp, `t${i}.txt`), titulo);
  fs.writeFileSync(path.join(tmp, `s${i}.txt`), texto);
  const quando = `between(t,${i * POR_SLIDE},${(i + 1) * POR_SLIDE})`;
  filtros.push(
    `drawtext=fontfile='${fonte("arialbd.ttf")}':textfile='${a}':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=(h/2)-80:enable='${quando}'`,
    `drawtext=fontfile='${fonte("arial.ttf")}':textfile='${b}':fontsize=36:fontcolor=0xD1D5DB:x=(w-text_w)/2:y=(h/2)+20:enable='${quando}'`,
  );
});
filtros.push(
  `drawtext=fontfile='${fonte("arial.ttf")}':text='%{eif\\:t+1\\:d}s':fontsize=24:fontcolor=0x9CA3AF:x=w-text_w-40:y=h-80`,
);

const mp4 = path.join(tmp, "demo.mp4");
let r = spawnSync(
  ffmpeg,
  [
    "-y",
    "-f", "lavfi", "-i", `color=c=0x111827:s=1280x720:d=${DURACAO}:r=30`,
    "-f", "lavfi", "-i", `anullsrc=channel_layout=stereo:sample_rate=44100`,
    "-vf", filtros.join(","),
    "-t", String(DURACAO),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast",
    "-c:a", "aac", "-shortest",
    mp4,
  ],
  { stdio: "inherit" },
);
if (r.status !== 0) process.exit(r.status ?? 1);

r = spawnSync(process.execPath, [path.resolve("scripts", "preparar-video.mjs"), mp4, path.join(pasta, "video")], {
  stdio: "inherit",
});
if (r.status !== 0) process.exit(r.status ?? 1);

const vtt = ["WEBVTT", ""];
const ts = (s) => `00:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.000`;
SLIDES.forEach(([titulo, texto], i) => {
  vtt.push(`${ts(i * POR_SLIDE)} --> ${ts((i + 1) * POR_SLIDE)}`, `${titulo}`, `${texto}`, "");
});
fs.writeFileSync(path.join(pasta, "legenda.vtt"), vtt.join("\n"));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Vídeo demo pronto: ${DURACAO} s em public/demo/video/master.m3u8`);
