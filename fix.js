const fs = require('fs');
let content = fs.readFileSync('src/app/register/[...slug]/page.tsx', 'utf8');

// specifically inputs
content = content.replace(/const inputCls = [^;]+;/, "const inputCls = 'w-full px-4 py-3 min-h-[44px] rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50/40 focus:border-primary/50 text-base transition-colors';");
content = content.replace(/const inputErrCls = [^;]+;/, "const inputErrCls = 'w-full px-4 py-3 min-h-[44px] rounded-xl bg-card border border-destructive ring-2 ring-destructive/20 text-foreground placeholder:text-muted-foreground focus:outline-none text-base';");
content = content.replace(/const labelCls = [^;]+;/, "const labelCls = 'block text-sm font-medium text-muted-foreground mb-1';");
content = content.replace(/const sectionTitle = [^;]+;/, "const sectionTitle = 'text-foreground font-bold text-xl mb-5';");

content = content.replace(/bg-white/g, 'bg-card');
content = content.replace(/text-white/g, 'text-foreground');
content = content.replace(/border-gray-200/g, 'border-border');
content = content.replace(/border-gray-300/g, 'border-border');
content = content.replace(/text-gray-900/g, 'text-foreground');
content = content.replace(/text-gray-800/g, 'text-foreground');
content = content.replace(/text-gray-700/g, 'text-muted-foreground');
content = content.replace(/text-gray-600/g, 'text-muted-foreground');
content = content.replace(/text-gray-500/g, 'text-muted-foreground');
content = content.replace(/text-gray-400/g, 'text-muted-foreground');
content = content.replace(/bg-gray-50/g, 'bg-secondary');
content = content.replace(/bg-gray-100/g, 'bg-secondary');
content = content.replace(/bg-gray-200/g, 'bg-secondary');

content = content.replace(/border-red-400/g, 'border-destructive/20');
content = content.replace(/border-red-200/g, 'border-destructive/20');
content = content.replace(/bg-red-50/g, 'bg-destructive/10');
content = content.replace(/text-red-500/g, 'text-destructive');
content = content.replace(/text-red-400/g, 'text-destructive');
content = content.replace(/text-red-700/g, 'text-destructive');
content = content.replace(/ring-red-400\/20/g, 'ring-destructive/20');

content = content.replace(/bg-blue-600/g, 'bg-primary text-primary-foreground');
content = content.replace(/bg-blue-700/g, 'bg-primary/90 text-primary-foreground');
content = content.replace(/bg-blue-800/g, 'bg-primary/80 text-primary-foreground');
content = content.replace(/bg-blue-50/g, 'bg-primary/10');
content = content.replace(/border-blue-500/g, 'border-primary/20');
content = content.replace(/border-blue-400/g, 'border-primary/20');
content = content.replace(/border-blue-200/g, 'border-primary/20');
content = content.replace(/text-blue-600/g, 'text-primary');
content = content.replace(/text-blue-800/g, 'text-primary');

content = content.replace(/text-indigo-600/g, 'text-primary');
content = content.replace(/bg-indigo-50/g, 'bg-primary/10');

content = content.replace(/bg-emerald-50/g, 'bg-success/10');
content = content.replace(/border-emerald-200/g, 'border-success/20');
content = content.replace(/text-emerald-600/g, 'text-success');
content = content.replace(/bg-green-50/g, 'bg-success/10');
content = content.replace(/text-green-500/g, 'text-success');

content = content.replace(/bg-amber-50/g, 'bg-warning/10');
content = content.replace(/text-amber-600/g, 'text-warning');

// Fix 4
content = content.replace(/grid grid-cols-2/g, 'grid grid-cols-1 sm:grid-cols-2');

// Fix 5 (We'll do this one manually or via script)
content = content.replace(/if \(\!c.schoolYear\) invalid\.add\(\`child-yr-\$\{i\}\`\);/, "if (!c.schoolYear) invalid.add(`child-yr-${i}`);\n                if (c.sessions.length === 0) invalid.add(`child-sessions-${i}`);");

// Fix 11 - Field component
content = content.replace(/function Field\(\{ label, children \}: \{ label: string; children: React\.ReactNode \}\) \{\n    return <div><label className=\{labelCls\}>\{label\}<\/label>\{children\}<\/div>;\n\}/, "function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode, htmlFor?: string }) {\n    return <div><label htmlFor={htmlFor} className={labelCls}>{label}</label>{children}</div>;\n}");

fs.writeFileSync('src/app/register/[...slug]/page.tsx', content);

let padContent = fs.readFileSync('src/features/registration/components/SignaturePadWidget.tsx', 'utf8');
padContent = padContent.replace(/text-white\/40/g, 'text-muted-foreground');
padContent = padContent.replace(/height: 120/g, 'height: 200');
padContent = padContent.replace(/height: 140/g, 'height: 200');
padContent = padContent.replace(/height: 130/g, 'height: 200');
padContent = padContent.replace(/className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"/g, 'className="text-xs text-destructive hover:text-destructive/80 transition-colors font-medium min-h-[44px] px-3 py-2"');
fs.writeFileSync('src/features/registration/components/SignaturePadWidget.tsx', padContent);
