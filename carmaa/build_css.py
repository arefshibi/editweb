#!/usr/bin/env python3
"""Minify the project's CSS into dist/ (comments + whitespace only, no rewriting).
Usage:  python3 build_css.py        -> writes dist/<same paths>.css and copies everything else
Source files stay untouched; deploy the dist/ folder (and enable gzip/brotli on the server)."""
import os, re, shutil, sys
ROOT = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(ROOT, "dist")

def minify(css):
    out = []; i = 0; n = len(css)
    while i < n:
        c = css[i]
        if css.startswith("/*", i):
            j = css.find("*/", i + 2); i = n if j < 0 else j + 2
            out.append(" ")  # a comment still separates tokens
        elif c in "\"'":
            j = i + 1
            while j < n and css[j] != c:
                j += 2 if css[j] == "\\" else 1
            out.append(css[i:j + 1]); i = j + 1
        elif css.startswith("url(", i):
            j = css.find(")", i); j = n - 1 if j < 0 else j
            out.append(css[i:j + 1]); i = j + 1
        else:
            out.append(c); i += 1
    s = "".join(out)
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r" ?([{};,]) ?", r"\1", s)          # spaces around { } ; ,
    s = re.sub(r"(?<=[a-z-]): ", ":", s)             # "prop: value" -> "prop:value"
    s = s.replace(";}", "}")
    return s.strip()

if os.path.isdir(OUT): shutil.rmtree(OUT)
before = after = 0
for d, dirs, files in os.walk(ROOT):
    dirs[:] = [x for x in dirs if x not in ("dist", "__pycache__")]
    for f in files:
        src = os.path.join(d, f); dst = os.path.join(OUT, os.path.relpath(src, ROOT))
        if f in ("build_css.py",) or f.endswith((".txt", ".md")): continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if f.endswith(".css"):
            t = open(src, encoding="utf-8").read(); m = minify(t)
            open(dst, "w", encoding="utf-8").write(m); before += len(t.encode()); after += len(m.encode())
        else:
            shutil.copy2(src, dst)
print(f"CSS {before/1024:.0f} KB -> {after/1024:.0f} KB  (dist/)")
