from python import auto_map

def test_infer_mappings_from_labeled_reports():
    labeled = [
        ('cross', [0,0,0,0,0,0,0], [0,0,0,0,0,32,0]),
        ('cross', [0,0,0,0,0,0,0], [0,0,0,0,0,32,0]),
        ('circle', [0,0,0,0,0,0,0], [0,0,0,0,0,64,0]),
        ('square', [0,0,0,0,0,0,0], [0,0,0,0,0,16,0])
    ]
    mapping = auto_map.infer_mappings_from_labeled_reports(labeled)
    assert 'cross' in mapping and mapping['cross'][0] == 5 and mapping['cross'][1] == 32
    assert mapping['circle'][1] == 64
    assert mapping['square'][1] == 16
