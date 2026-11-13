#!/usr/bin/env python3
# ساخت ios-cq-fallback.css: معادل vw برای واحدهای cqw تا کارت آگهی‌ها روی آیفون‌های قدیمی (iOS 15 و پایین‌تر) درست دیده شود.
import re, glob, os, sys
os.chdir(sys.argv[1] if len(sys.argv) > 1 else '.')
CQ = re.compile(r'(-?\d*\.?\d+)\s*cq(?:w|i)\b')
def conv(s): return CQ.sub(lambda m: f'calc({m.group(1)} * var(--cqw))', s)

def rules(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out, stack, i, start = [], [], 0, 0
    while i < len(css):
        c = css[i]
        if c == '{':
            head = css[start:i].strip()
            if head.startswith('@') and not head.startswith(('@font-face', '@keyframes', '@-webkit-keyframes', '@property')):
                stack.append(head); start = i + 1
            else:
                depth, j = 1, i + 1
                while j < len(css) and depth:
                    depth += (css[j] == '{') - (css[j] == '}'); j += 1
                body = css[i + 1:j - 1]
                if head.startswith('@'): pass
                elif re.search(r'cq[wi]\b', body): out.append((tuple(stack), head, body.strip()))
                i, start = j - 1, j
        elif c == '}':
            if stack: stack.pop()
            start = i + 1
        i += 1
    return out

parts = []
for f in sorted(glob.glob('*.css')):
    if f == 'ios-cq-fallback.css' or f.endswith('.bak'): continue
    for at, sel, body in rules(open(f, encoding='utf-8', errors='ignore').read()):
        decls = [d.strip() for d in re.split(r';(?![^(]*\))', body) if re.search(r'cq[wi]\b', d)]
        if not decls: continue
        rule = f'{sel}{{' + ';'.join(conv(d).rstrip(';') for d in decls) + '}'
        for a in reversed(at): rule = f'{a}{{{rule}}}'
        parts.append(rule)

css = ('/* auto-generated: fallback for browsers without container-query units (iOS <= 15, e.g. iPhone 7) */\n'
       '@supports not (width:1cqw){\n:root{--cqw:calc((100vw - 32px) / 100)}\n' + '\n'.join(parts) + '\n}\n')
open('ios-cq-fallback.css', 'w', encoding='utf-8').write(css)
print(f'{len(parts)} rules -> ios-cq-fallback.css')
idx = open('index.html', encoding='utf-8').read()
if 'ios-cq-fallback.css' not in idx:
    idx = idx.replace('</head>', '    <link rel="stylesheet" href="ios-cq-fallback.css?v=1" />\n  </head>', 1)
    open('index.html', 'w', encoding='utf-8').write(idx); print('linked in index.html')
