#!/usr/bin/env python3
# Interactive mapper for DS4 (Python)
import os
import time
try:
    import hid
except Exception:
    hid = None

print('Python mapper starting')
if hid is None:
    print('hid library not available; run in simulated mode by setting SIMULATE=1')

devices = hid.enumerate() if hid else []
print('HID devices found:', len(devices))

target = None
for d in devices:
    if 'Sony' in (d.get('manufacturer') or '') or 'Wireless Controller' in (d.get('product') or ''):
        target = d
        break

if not target:
    print('No DualShock-like device found; running simulated diffs.')

STATE = {'raw': None}

def print_diff(prev, cur):
    diffs = []
    for i in range(max(len(prev), len(cur))):
        a = prev[i] if i < len(prev) else 0
        b = cur[i] if i < len(cur) else 0
        if a != b:
            diffs.append({'idx':i, 'before':a, 'after':b})
    if diffs:
        print('Report diffs:', diffs)

if target:
    d = hid.device()
    d.open_path(target['path'])
    d.set_nonblocking(True)
    try:
        while True:
            r = d.read(64)
            if r:
                cur = list(r)
                if STATE['raw']:
                    print_diff(STATE['raw'], cur)
                STATE['raw'] = cur
            time.sleep(0.01)
    except KeyboardInterrupt:
        print('\nMapper stopped')
else:
    import random
    fake = [0]*16
    try:
        while True:
            idx = random.randrange(0, 15)
            mask = 1 << random.randrange(0,7)
            fake[idx] ^= mask
            if STATE['raw']:
                print_diff(STATE['raw'], fake)
            STATE['raw'] = fake.copy()
            time.sleep(0.7)
    except KeyboardInterrupt:
        print('\nMapper stopped')
