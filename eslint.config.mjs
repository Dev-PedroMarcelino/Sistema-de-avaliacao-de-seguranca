import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", "node_modules/**", "public/**", ".data/**", "next-env.d.ts"] },
  // <Image> do react-pdf não é HTML: não tem alt.
  { files: ["src/lib/pdf/**"], rules: { "jsx-a11y/alt-text": "off" } },
];

export default config;
