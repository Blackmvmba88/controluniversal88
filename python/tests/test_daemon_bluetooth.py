from python.daemon import Daemon

class Collector:
    def __init__(self): self.events = []
    def emit(self, m): self.events.append(m)

def make_report(length=12, changes=None):
    r = [0]*length
    if changes:
        for k,v in changes.items(): r[int(k)] = v
    return r

def test_bluetooth_button_heuristic():
    d = Daemon()
    c = Collector()
    d.handle_report(make_report(8, {5:0}), c.emit)
    d.handle_report(make_report(12, {10:0x20}), c.emit)
    assert any(e['type']=='button' for e in c.events)

def test_bluetooth_axis_heuristic():
    d = Daemon()
    c = Collector()
    d.handle_report(make_report(12, {7:128}), c.emit)
    d.handle_report(make_report(12, {7:200}), c.emit)
    d.handle_report(make_report(12, {7:100}), c.emit)
    assert any(e['type']=='axis' for e in c.events)
