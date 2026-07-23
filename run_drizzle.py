import pty
import sys

pty.spawn(["pnpm", "db:generate"])
