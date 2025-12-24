import os
import asyncio
import json
import random
from typing import Callable

SIMULATE = os.getenv('SIMULATE', '1') in ('1', 'true', 'True')
MAP_MODE = os.getenv('MAP', '0') in ('1', 'true', 'True')

DEFAULT_MAP = {
    'axes': { 'lstick_x': 1, 'lstick_y': 2, 'rstick_x': 3, 'rstick_y': 4, 'l2':8, 'r2':9 },
    'buttons': {
        'square': [5, 0x10], 'cross': [5, 0x20], 'circle': [5, 0x40], 'triangle':[5,0x80],
        'l1':[6,0x01], 'r1':[6,0x02], 'l2_btn':[6,0x04], 'r2_btn':[6,0x08],
        'share':[6,0x10], 'options':[6,0x20], 'lstick':[6,0x40], 'rstick':[6,0x80], 'ps':[7,0x01]
    },
    'dpad': {'byte':5,'mask':0x0f}
}

class Daemon:
    def __init__(self):
        self.mapping = self._load_map()
        self.prev_state = None

    def _load_map(self):
        try:
            with open('.ds4map.json','r') as f:
                print('Loaded .ds4map.json mapping')
                return json.load(f)
        except Exception:
            return DEFAULT_MAP

    async def start(self, emit: Callable[[dict], None]):
        if not SIMULATE:
            try:
                import hid
                # Open the first Sony device if present
                devices = hid.enumerate()
                ds = None
                for d in devices:
                    if 'Sony' in (d.get('manufacturer') or '') or 'Wireless Controller' in (d.get('product') or ''):
                        ds = d
                        break
                if not ds:
                    print('No DualShock-like HID device found; running simulation')
                    await self._simulate(emit)
                    return
                print('Opening HID:', ds)
                h = hid.device()
                h.open_path(ds['path'])
                h.set_nonblocking(True)
                self._device = h

                while True:
                    report = h.read(64)
                    if report:
                        # validate and handle report robustly
                        try:
                            self._handle_report(report, emit)
                        except Exception as e:
                            print('Error handling report:', e)
                    await asyncio.sleep(0.001)
            except Exception as e:
                print('HID error or not available:', e)
                await self._simulate(emit)
        else:
            await self._simulate(emit)

    def get_status(self):
        from python import auto_map
        return {'mapping': self.mapping, 'recentReports': getattr(self, '_recent', []), 'sensors': auto_map.detect_sensor_candidates(getattr(self, '_recent', []))}

    def save_mapping(self, mapping_obj):
        try:
            if os.path.exists('.ds4map.json'):
                os.rename('.ds4map.json', f'.ds4map.json.bak.{int(time.time())}')
        except Exception:
            pass
        with open('.ds4map.json', 'w') as f:
            json.dump(mapping_obj, f, indent=2)
        self.mapping = mapping_obj
    def handle_report(self, report, emit: Callable[[dict], None]):
        """Public wrapper that validates the incoming report and forwards to internal handler.
        Accepts bytes, bytearray or sequence of ints."""
        try:
            if report is None:
                return False
            if isinstance(report, (bytes, bytearray)):
                data = list(report)
            elif isinstance(report, list) or isinstance(report, tuple):
                data = list(report)
            else:
                # try to coerce
                data = list(report)
        except Exception:
            return False
        try:
            self._handle_report(data, emit)
            return True
        except Exception:
            return False

    def _handle_report(self, report, emit):
        b = list(report)
        state = {'raw': b, 'axes':{}, 'buttons':{}, 'dpad': None}
        for name, idx in (self.mapping.get('axes') or {}).items():
            try:
                v = b[idx]
                if 'stick' in name:
                    state['axes'][name] = round((v - 128) / 127, 2)
                else:
                    state['axes'][name] = round(v / 255, 2)
            except Exception:
                pass

        # dpad
        try:
            nib = b[self.mapping['dpad']['byte']] & self.mapping['dpad']['mask']
            dirMap = {0:'dpad_up',1:'dpad_up|dpad_right',2:'dpad_right',3:'dpad_down|dpad_right',4:'dpad_down',5:'dpad_down|dpad_left',6:'dpad_left',7:'dpad_left|dpad_up'}
            state['dpad'] = dirMap.get(nib)
        except Exception:
            pass

        for name, (byteIdx, mask) in (self.mapping.get('buttons') or {}).items():
            try:
                v = b[byteIdx]
                state['buttons'][name] = bool(v & mask)
            except Exception:
                state['buttons'][name] = False

        if self.prev_state is None:
            # initial state
            self.prev_state = state
            for k, v in state['buttons'].items():
                if v: emit({'type':'button','id':k,'value':1})
            for k, v in state['axes'].items():
                emit({'type':'axis','id':k,'value':v})
            return

        # maintain recent raw reports for heuristics
        self._recent = getattr(self, '_recent', [])
        self._recent.append(state['raw'])
        if len(self._recent) > 8: self._recent.pop(0)

        if MAP_MODE:
            diffs = [(i, self.prev_state['raw'][i], b[i]) for i in range(min(len(b), len(self.prev_state['raw']))) if b[i] != self.prev_state['raw'][i]]
            if diffs:
                print('Report diffs:', diffs)

        # buttons
        for k, v in state['buttons'].items():
            prev = self.prev_state['buttons'].get(k, False)
            if v != prev:
                emit({'type':'button','id':k,'value':1 if v else 0})

        # Heuristic for buttons when mapping indices are out of range: try to find single-bit changes across previous and current raw
        try:
            import statistics
            if self._recent and len(self._recent) >= 2:
                prev_raw = self._recent[-2]
                cur_raw = self._recent[-1]
                # search for single-bit xor
                for i in range(max(len(prev_raw), len(cur_raw))):
                    a = prev_raw[i] if i < len(prev_raw) else 0
                    b = cur_raw[i] if i < len(cur_raw) else 0
                    xor = a ^ b
                    if xor and (xor & (xor - 1)) == 0:
                        # find which button mapping referenced missing byte and emit a guessed press for it
                        for name, pair in (self.mapping.get('buttons') or {}).items():
                            if not pair or pair[0] >= len(cur_raw):
                                # emit guessed event
                                emit({'type':'button','id':name,'value':1 if b & xor else 0})
        except Exception:
            pass

        if state['dpad'] != self.prev_state.get('dpad'):
            for idc in ['dpad_up','dpad_down','dpad_left','dpad_right']:
                emit({'type':'button','id':idc,'value':0})
            if state['dpad']:
                for idc in state['dpad'].split('|'):
                    emit({'type':'button','id':idc,'value':1})

        for k, v in state['axes'].items():
            prev = self.prev_state['axes'].get(k, 0)
            if abs(v - prev) > 0.05:
                emit({'type':'axis','id':k,'value':v})

        self.prev_state = state

    async def _simulate(self, emit):
        buttons = list((self.mapping.get('buttons') or {}).keys())
        async def loop_buttons():
            while True:
                btn = random.choice(buttons)
                emit({'type':'button','id':btn,'value':1})
                await asyncio.sleep(0.1 + random.random() * 0.3)
                emit({'type':'button','id':btn,'value':0})
                await asyncio.sleep(0.2)
        async def loop_axes():
            while True:
                emit({'type':'axis','id':'lstick_x','value':round(random.uniform(-1,1),2)})
                emit({'type':'axis','id':'lstick_y','value':round(random.uniform(-1,1),2)})
                await asyncio.sleep(0.6)
        await asyncio.gather(loop_buttons(), loop_axes())

if __name__ == '__main__':
    import asyncio
    d = Daemon()
    async def emit(m): print('emit:', m)
    asyncio.run(d.start(emit))
