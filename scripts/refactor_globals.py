import re

with open('src/app/globals.css', 'r') as f:
    content = f.read()

# 1. Remove all !important from globals.css
content = content.replace(' !important', '')

# 2. Replace body:not(.landing-page-active) :is(...) constructs with cleaner rules
# Typography
content = re.sub(
    r'body:not\(\.landing-page-active\) :is\(h1, h2, h3, h4, h5, h6, \.h1, \.h2, \.h3, \.h4, \.h5, \.h6\):not\(\.keep-typography\) \{',
    r'@layer base {\n  h1, h2, h3, h4, h5, h6, .h1, .h2, .h3, .h4, .h5, .h6 {',
    content
)
# Add closing brace for @layer base
content = content.replace(
    '  line-height: 1.1;\n}',
    '  line-height: 1.1;\n}\n}'
)

content = re.sub(
    r'body:not\(\.landing-page-active\) :is\(h1, \.h1\) \{',
    r'@layer base {\n  h1, .h1 {',
    content
)
content = content.replace(
    '  letter-spacing: -0.04em;\n}',
    '  letter-spacing: -0.04em;\n}\n}'
)

content = re.sub(r'body:not\(\.landing-page-active\) :is\(h2, \.h2\) \{', r'@layer base {\n  h2, .h2 {', content)
content = content.replace('  letter-spacing: -0.03em;\n}', '  letter-spacing: -0.03em;\n}\n}')

content = re.sub(r'body:not\(\.landing-page-active\) :is\(h3, \.h3\) \{', r'@layer base {\n  h3, .h3 {', content)
content = content.replace('  letter-spacing: -0.02em;\n}', '  letter-spacing: -0.02em;\n}\n}')

content = re.sub(r'body:not\(\.landing-page-active\) :is\(h4, h5, h6, \.h4, \.h5, \.h6\) \{', r'@layer base {\n  h4, h5, h6, .h4, .h5, .h6 {', content)
content = content.replace('  letter-spacing: -0.01em;\n}', '  letter-spacing: -0.01em;\n}\n}')


# Buttons and Inputs
content = re.sub(
    r'body:not\(\.landing-page-active\) :is\(\n  button,.*?\) \{',
    r'@layer base {\n  button, .btn, [class*="btn-"], [class*="button-"], input[type="submit"] {',
    content, flags=re.DOTALL
)

content = re.sub(
    r'body:not\(\.landing-page-active\) :is\(\n  input\[type="text"\].*?\) \{',
    r'@layer base {\n  input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="tel"], input[type="search"], input[type="date"], select, textarea {',
    content, flags=re.DOTALL
)

# Text-color overrides (we can just delete these since the components will be using standard tailwind classes or we just keep them as raw classes)
content = re.sub(r'body:not\(\.landing-page-active\) :is\(\.text-white.*?\) \{.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'body:not\(\.landing-page-active\) :is\(\n  \.text-slate-400.*?\) \{.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'body:not\(\.landing-page-active\) :is\(\n  \.text-slate-300.*?\) \{.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'body:not\(\.landing-page-active\) :is\(\.border-white\\/.*?\) \{.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'body:not\(\.landing-page-active\) :is\(\.bg-white\\/.*?\) \{.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'body:not\(\.landing-page-active\) :is\(\.hover\\:bg-white\\/.*?\) \{.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'body:not\(\.landing-page-active\) \.keep-shape \{.*?\}', '', content, flags=re.DOTALL)

# Padding override
content = re.sub(r'body:not\(\.landing-page-active\) :is\(\n  \.container.*?\) \{.*?\}', '', content, flags=re.DOTALL)


# Cards
content = re.sub(
    r'body:not\(\.landing-page-active\) :is\(\n  \.card,.*?\):not\(body, html, main, aside, header, \.keep-shape\) \{',
    r'@layer components {\n  .card, .glassmorphic-card, .kpi-card, .bg-card, .bg-surface, .bg-surface-container, .bg-surface-container-high, .bg-surface-container-low, .bg-surface-container-highest, .bg-surface-container-lowest {',
    content, flags=re.DOTALL
)
content = re.sub(
    r'body:not\(\.landing-page-active\) :is\(\n  \.card,.*?\):not\(body, html, main, aside, header, \.keep-shape\):hover \{',
    r'@layer components {\n  .card:hover, .glassmorphic-card:hover, .kpi-card:hover, .bg-card:hover, .bg-surface:hover, .bg-surface-container:hover, .bg-surface-container-high:hover, .bg-surface-container-low:hover, .bg-surface-container-highest:hover, .bg-surface-container-lowest:hover {',
    content, flags=re.DOTALL
)
content = re.sub(
    r'body:not\(\.landing-page-active\) :is\(\n  \.card,.*?\):not\(body, html, main, aside, header, \.keep-shape\):active \{',
    r'@layer components {\n  .card:active, .glassmorphic-card:active, .kpi-card:active, .bg-card:active, .bg-surface:active, .bg-surface-container:active, .bg-surface-container-high:active, .bg-surface-container-low:active, .bg-surface-container-highest:active, .bg-surface-container-lowest:active {',
    content, flags=re.DOTALL
)

with open('src/app/globals.css', 'w') as f:
    f.write(content)
