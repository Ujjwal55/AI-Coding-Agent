import type { FileNode } from "@/domain/types";

const EXT_LANG: Record<string, string> = {
  py: "Python",
  pyw: "Python",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  ts: "TypeScript",
  tsx: "TypeScript",
  java: "Java",
  kt: "Kotlin",
  kts: "Kotlin",
  go: "Go",
  rs: "Rust",
  c: "C",
  h: "C/C++",
  cpp: "C++",
  cc: "C++",
  cxx: "C++",
  hpp: "C++",
  cs: "C#",
  rb: "Ruby",
  php: "PHP",
  swift: "Swift",
  scala: "Scala",
  r: "R",
  sql: "SQL",
  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",
  md: "Markdown",
  json: "JSON",
  yml: "YAML",
  yaml: "YAML",
  toml: "TOML",
  xml: "XML",
  html: "HTML",
  css: "CSS",
  scss: "CSS",
  vue: "Vue",
  svelte: "Svelte",
};

const MANIFEST_HINTS: Array<{ file: string; lang: string }> = [
  { file: "go.mod", lang: "Go" },
  { file: "cargo.toml", lang: "Rust" },
  { file: "pom.xml", lang: "Java" },
  { file: "build.gradle", lang: "Java" },
  { file: "build.gradle.kts", lang: "Kotlin" },
  { file: "package.json", lang: "JavaScript" },
  { file: "tsconfig.json", lang: "TypeScript" },
  { file: "requirements.txt", lang: "Python" },
  { file: "pyproject.toml", lang: "Python" },
  { file: "cmakelists.txt", lang: "C++" },
];

export interface WorkspaceLanguageInfo {
  primary: string | null;
  label: string;
  fileCount: number;
  counts: Record<string, number>;
}

export function detectWorkspaceLanguages(
  fileTree: FileNode[],
): WorkspaceLanguageInfo {
  const files = fileTree.filter((f) => !f.is_dir);
  const fileCount = files.length;
  const counts: Record<string, number> = {};

  for (const f of files) {
    const base = f.path.split("/").pop()?.toLowerCase() ?? "";
    for (const hint of MANIFEST_HINTS) {
      if (base === hint.file) {
        counts[hint.lang] = (counts[hint.lang] ?? 0) + 3; // boost manifests
      }
    }
    const ext = base.includes(".") ? base.split(".").pop()! : "";
    const lang = EXT_LANG[ext];
    if (lang) counts[lang] = (counts[lang] ?? 0) + 1;
  }

  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const primary = ranked[0]?.[0] ?? null;
  const secondary = ranked[1]?.[0];

  let label: string;
  if (fileCount === 0) {
    label = "empty workspace";
  } else if (!primary) {
    label = `${fileCount} files`;
  } else if (secondary && (counts[secondary] ?? 0) >= Math.max(2, (counts[primary] ?? 0) * 0.4)) {
    label = `Detected: ${primary} + ${secondary} · ${fileCount} files`;
  } else {
    label = `Detected: ${primary} · ${fileCount} files`;
  }

  return { primary, label, fileCount, counts };
}
