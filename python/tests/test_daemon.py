import pytest
from python.daemon import Daemon

class Collector:
    def __init__(self):
        self.events = []
    def emit(self, m):
        self.events.append(m)

@pytest.fixture
def collector():
    return Collector()

@pytest.fixture
def daemon():
    return Daemon()

def make_report(length=12, changes=None):
    r = [0]*length
    if changes:
        for k,v in changes.items(): r[int(k)] = v
    return r

def test_button_press_release(daemon, collector):
    # initial report
    daemon.handle_report(make_report(12, {}), collector.emit)
    # press cross (byte 5 mask 0x20)
    daemon.handle_report(make_report(12, {5:0x20}), collector.emit)
    assert any(e['type']=='button' and e['id']=='cross' and e['value']==1 for e in collector.events)
    collector.events.clear()
    # release
    daemon.handle_report(make_report(12, {5:0x00}), collector.emit)
    assert any(e['type']=='button' and e['id']=='cross' and e['value']==0 for e in collector.events)

def test_axis_threshold(daemon, collector):
    # initial center
    daemon.handle_report(make_report(12, {1:128}), collector.emit)
    collector.events.clear()
    # move to right significantly
    daemon.handle_report(make_report(12, {1:200}), collector.emit)
    assert any(e['type']=='axis' and e['id']=='lstick_x' for e in collector.events)
