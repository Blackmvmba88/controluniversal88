#!/usr/bin/env python3
# Auto-mapper for DS4 (Python)
import os, time, json
try:
    import hid
except Exception:
    hid = None

BUTTONS = ['square','cross','circle','triangle','l1','r1','l2_btn','r2_btn','share','options','lstick','rstick','ps','dpad_up','dpad_right','dpad_down','dpad_left']
AXES = ['lstick_x','lstick_y','rstick_x','rstick_y','l2','r2']


# Interactive auto-mapping routine moved into `main()` so importing this module from
# tests does not execute interactive device code or call sys.exit on import.

mapping = {'axes': {}, 'buttons': {}, 'dpad': {'byte': None, 'mask': None}}

# Interactive helpers that rely on an open hid device

def _print_diff(prev, cur):
    diffs = []
    for i in range(max(len(prev), len(cur))):
        a = prev[i] if i < len(prev) else 0
        b = cur[i] if i < len(cur) else 0
        if a != b:
            diffs.append({'idx': i, 'before': a, 'after': b, 'xor': a ^ b})
    return diffs


def _wait_diff(h, state, timeout=8.0):
    st = state['raw'][:] if state['raw'] else None
    start = time.time()
    while time.time() - start < timeout:
        r = h.read(64)
        if r:
            cur = list(r)
            if st:
                diffs = _print_diff(st, cur)
                if diffs:
                    return diffs
            st = cur
        time.sleep(0.01)
    raise TimeoutError()


# Non-interactive helpers (ported from server/auto_map_core.js)

def _choose_candidate_from_diffs(diffs):
    if not diffs:
        return None
    # prefer diffs whose xor is a single bit
    for d in diffs:
        xor = d.get('xor', 0)
        if xor and (xor & (xor - 1)) == 0:
            return {'idx': d['idx'], 'xor': xor}
    # else return the diff with smallest number of bits set
    def popcount(x):
        return bin(x).count('1')
    best = diffs[0]
    best_count = popcount(best.get('xor', 0))
    for d in diffs[1:]:
        c = popcount(d.get('xor', 0))
        if c < best_count:
            best = d
            best_count = c
    return {'idx': best['idx'], 'xor': best['xor']}


def infer_button_mappings(observed_diffs_by_button):
    mapping = {}
    for btn, attempts in observed_diffs_by_button.items():
        candidates = []
        for diffs in attempts:
            for d in diffs:
                candidates.append(d)
        choice = _choose_candidate_from_diffs(candidates)
        if choice:
            mapping[btn] = [choice['idx'], choice['xor']]
    return mapping


def infer_dpad_byte(dpad_diffs_array):
    counts = {}
    for diffs in dpad_diffs_array:
        for d in diffs:
            counts[d['idx']] = counts.get(d['idx'], 0) + 1
    if not counts:
        return None
    best_idx = max(counts.items(), key=lambda kv: kv[1])[0]
    return {'byte': best_idx, 'mask': 0x0f}


def find_single_bit_change(prev, cur):
    diffs = _print_diff(prev, cur)
    for d in diffs:
        xor = d.get('xor', 0)
        if xor and (xor & (xor - 1)) == 0:
            return {'idx': d['idx'], 'xor': xor}
    return None


def find_most_variable_byte(reports):
    if not reports:
        return None
    length = max(len(r) for r in reports)
    variances = [0] * length
    for i in range(length):
        vals = [(r[i] if i < len(r) else 0) for r in reports]
        mean = sum(vals) / len(vals)
        varsum = sum((v - mean) ** 2 for v in vals) / len(vals)
        variances[i] = varsum
    best_idx = 0
    best_v = variances[0]
    for i in range(1, len(variances)):
        if variances[i] > best_v:
            best_v = variances[i]
            best_idx = i
    return best_idx


def detect_sensor_candidates(reports):
    if not reports:
        return {'batteryCandidates': [], 'motionCandidates': []}
    length = max(len(r) for r in reports)
    variances = [0] * length
    means = [0] * length
    for i in range(length):
        vals = [(r[i] if i < len(r) else 0) for r in reports]
        mean = sum(vals) / len(vals)
        varsum = sum((v - mean) ** 2 for v in vals) / len(vals)
        variances[i] = varsum
        means[i] = mean
    battery_candidates = [i for i in range(length) if variances[i] < 4 and means[i] > 0]
    motion_candidates = [i for i in range(length) if variances[i] > 20]
    return {'batteryCandidates': battery_candidates, 'motionCandidates': motion_candidates}


def infer_mappings_from_labeled_reports(labeled_pairs):
    # labeled_pairs: list of (label, before, after)
    per_label = {}
    for p in labeled_pairs:
        label, before, after = p
        diffs = _print_diff(before, after)
        if label not in per_label:
            per_label[label] = []
        per_label[label].append(diffs)
    return infer_button_mappings(per_label)


def main(interactive=True):
    """Run the interactive mapping flow. If no DS4 device is found, do nothing and return.
    This function is safe to call from tests or CI without causing an import-time exit.
    """
    if hid is None:
        print('hid library not available — ensure hidapi is installed and run on a system with device')
    devices = hid.enumerate() if hid else []
    print('Starting Python auto-mapper')
    print('HID devices:', len(devices))

    target = None
    for d in devices:
        if 'Sony' in (d.get('manufacturer') or '') or 'Wireless Controller' in (d.get('product') or ''):
            target = d
            break

    if not target:
        print('No DualShock-like device found; skipping interactive mapping (no device).')
        return mapping

    h = hid.device(); h.open_path(target['path']); h.set_nonblocking(True)
    state = {'raw': None}

    if not interactive:
        print('Non-interactive mode: skipping user prompts')
        return mapping

    for btn in BUTTONS:
        input(f'Ready for button {btn} — press it now and then ENTER')
        try:
            diffs = _wait_diff(h, state, 8.0)
            cand = diffs[0]
            mapping['buttons'][btn] = [cand['idx'], cand['xor']]
            print('Mapped', btn, '->', mapping['buttons'][btn])
        except TimeoutError:
            print('Timeout mapping', btn)

    print('Mapping dpad directions')
    for d in ['dpad_up', 'dpad_right', 'dpad_down', 'dpad_left']:
        input(f'Ready for {d} — press and ENTER')
        try:
            diffs = _wait_diff(h, state, 8.0)
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
            diffs = _wait_diff(h, state, 8.0)
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
    with open('.ds4map.json', 'w') as f:
        json.dump(mapping, f, indent=2)
    print('Wrote .ds4map.json — please review masks and bytes')


if __name__ == '__main__':
    main()
