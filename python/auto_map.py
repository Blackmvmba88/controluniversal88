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
