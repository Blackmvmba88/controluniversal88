Python backend notes:

- Run in simulation: `SIMULATE=1 python3 python/server.py`
- If using real device, install system hidapi libraries (macOS: `brew install hidapi`) and `pip install hidapi`.
- The current implementation is a simple prototype — extend `python/daemon.py` to parse DS4 reports into normalized events.
