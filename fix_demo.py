#!/usr/bin/env python3
f = open(r'C:\Users\33589\Downloads\b2btrade-agent\src\index.js', 'rb')
d = f.read()
f.close()

# Find and fix lines 384-389 (0-indexed: 383-388)
lines = d.split(b'\n')
for i in range(383, 389):
    print(repr(lines[i][:100]))
