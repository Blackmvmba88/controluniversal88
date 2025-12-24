#!/usr/bin/env python3
# Auto-mapper for DS4 (Python)
import os, time, json
try:
    import hid
except Exception:
    hid = None

BUTTONS = ['square','cross','circle','triangle','l1','r1','l2_btn','r2_btn','share','options','lstick','rstick','ps','dpad_up','dpad_right','dpad_down','dpad_left']
AXES = ['lstick_x','lstick_y','rstick_x','rstick_y','l2','r2']

print('Starting Python auto-mapper')
if hid is None:
    print('hid library not available — ensure hidapi is installed and run on a system with device')

devices = hid.enumerate() if hid else []
print('HID devices:', len(devices))

target = None
for d in devices:
    if 'Sony' in (d.get('manufacturer') or '') or 'Wireless Controller' in (d.get('product') or ''):
        target = d
        break

if not target:
    print('No DualShock-like device found; exiting.')
    raise SystemExit(1)

h = hid.device(); h.open_path(target['path']); h.set_nonblocking(True)

state = {'raw': None}

def print_diff(prev, cur):
    diffs = []
    for i in range(max(len(prev), len(cur))):
        a = prev[i] if i < len(prev) else 0
        b = cur[i] if i < len(cur) else 0
        if a != b:
            diffs.append({'idx':i, 'before':a, 'after':b, 'xor': a ^ b})
    return diffs

def wait_diff(timeout=8.0):
    st = state['raw'][:] if state['raw'] else None
    start = time.time()
    while time.time() - start < timeout:
        r = h.read(64)
        if r:
            cur = list(r)
            if st:
                diffs = print_diff(st, cur)
                if diffs:
                    return diffs
            st = cur
        time.sleep(0.01)
    raise TimeoutError()

mapping = {'axes': {}, 'buttons': {}, 'dpad': {'byte': None, 'mask': None}}

# Add a helper to infer mappings from labeled before/after report pairs
def infer_mappings_from_labeled_reports(labeled_pairs):
    # labeled_pairs: list of tuples (label, before, after)
    per_label = {}
    def print_diff(prev, cur):
        diffs = []
        for i in range(max(len(prev), len(cur))):
            a = prev[i] if i < len(prev) else 0
            b = cur[i] if i < len(cur) else 0
            if a != b:
                diffs.append({'idx':i,'before':a,'after':b,'xor':a^b})
        return diffs

    for label, before, after in labeled_pairs:
        diffs = print_diff(before, after)
        per_label.setdefault(label, []).append(diffs)

    # pick best candidate per label (prefer single bit xor)
    mapping = {}
    for label, attempts in per_label.items():
        candidates = []
        for diffs in attempts:
            for d in diffs: candidates.append(d)
        # prefer single-bit xor
        single = next((d for d in candidates if (d['xor'] & (d['xor'] - 1)) == 0), None)
        if single:
            mapping[label] = [single['idx'], single['xor']]
        else:
            # pick smallest popcount
            candidates.sort(key=lambda x: bin(x['xor']).count('1'))
            if candidates:
                mapping[label] = [candidates[0]['idx'], candidates[0]['xor']]
    return mapping

# expose
infer_mappings_from_labeled_reports = infer_mappings_from_labeled_reports

def detect_sensor_candidates(reports):
    if not reports:
        return {'batteryCandidates': [], 'motionCandidates': []}
    length = max(len(r) for r in reports)
    means = []
    variances = []
    for i in range(length):
        vals = [(r[i] if i < len(r) else 0) for r in reports]
        mean = sum(vals)/len(vals)
        var = sum((v-mean)**2 for v in vals)/len(vals)
        means.append(mean)
        variances.append(var)
    batteryCandidates = [i for i,v in enumerate(variances) if v < 4 and means[i] > 0]
    motionCandidates = [i for i,v in enumerate(variances) if v > 20]
    return {'batteryCandidates': batteryCandidates, 'motionCandidates': motionCandidates}

detect_sensor_candidates = detect_sensor_candidates

for btn in BUTTONS:
    input(f'Ready for button {btn} — press it now and then ENTER')
    try:
        diffs = wait_diff(8.0)
        cand = diffs[0]
        mapping['buttons'][btn] = [cand['idx'], cand['xor']]
        print('Mapped', btn, '->', mapping['buttons'][btn])
    except TimeoutError:
        print('Timeout mapping', btn)

print('Mapping dpad directions')
for d in ['dpad_up','dpad_right','dpad_down','dpad_left']:
    input(f'Ready for {d} — press and ENTER')
    try:
        diffs = wait_diff(8.0)
        cand = diffs[0]
        mapping['dpad']['byte'] = cand['idx']
        mapping['dpad']['mask'] = 0x0f
        print('Dpad byte likely', cand['idx'])
    except TimeoutError:
        print('Timeout mapping', d)

print('Mapping axes — move stick/trigger when prompted')
for ax in AXES:
    input(f'Ready for axis {ax} — move and press ENTER')
    try:
        diffs = wait_diff(8.0)
        cand = diffs[0]
        mapping['axes'][ax] = cand['idx']
        print('Mapped axis', ax, '-> byte', cand['idx'])
    except TimeoutError:
        print('Timeout mapping axis', ax)

# backup previous mapping
    try:
        if os.path.exists('.ds4map.json'):
            os.rename('.ds4map.json', '.ds4map.json.bak.' + str(int(time.time())))
    except Exception:
        pass
    with open('.ds4map.json','w') as f:
        json.dump(mapping, f, indent=2)
print('Wrote .ds4map.json — please review masks and bytes')
