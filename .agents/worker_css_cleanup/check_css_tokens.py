import os
import re

# Read variables from globals.css
globals_css_path = "/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/src/app/globals.css"
with open(globals_css_path, "r") as f:
    lines = f.readlines()

# Extract variables from lines 28 to 78 (0-indexed: 27 to 77)
# But let's check what is defined in lines 28 to 78 exactly
variables = []
for i in range(27, 78):
    line = lines[i].strip()
    match = re.match(r"--color-([\w-]+):", line)
    if match:
        variables.append(match.group(1))

print(f"Total variables found in lines 28-78: {len(variables)}")
print(variables)

# Now search codebase for these variables
src_dir = "/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/src"
exclude_file = "globals.css"

usage_count = {v: 0 for v in variables}

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file == exclude_file:
            # Skip globals.css itself, or rather we'll search globals.css but ignore the definition block
            filepath = os.path.join(root, file)
            with open(filepath, "r") as f:
                content = f.read()
            # Remove the definition block (lines 28-78)
            # 27 is 0-indexed line 28, 78 is 0-indexed line 79.
            content_lines = content.splitlines()
            cleaned_content = "\n".join(content_lines[:27] + content_lines[78:])
            for v in variables:
                if v in cleaned_content:
                    usage_count[v] += 1
            continue

        if file.endswith((".ts", ".tsx", ".js", ".jsx", ".css", ".json")):
            filepath = os.path.join(root, file)
            with open(filepath, "r") as f:
                content = f.read()
            for v in variables:
                if v in content:
                    usage_count[v] += 1

print("\nUsage Count results:")
for v, count in usage_count.items():
    print(f"{v}: {count}")

print("\nUnused variables:")
unused = [v for v, count in usage_count.items() if count == 0]
print(unused)
print(f"Total unused: {len(unused)}")
