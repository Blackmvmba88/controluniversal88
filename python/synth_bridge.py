import asyncio
import json
import websockets
import sys
import os

# Añadir el motor de audio al path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'audio_engine'))
from audio_lab import AudioLab

class SynthBridge:
    def __init__(self):
        self.audio = AudioLab()
        self.freq = 440.0
        self.waveform = "Seno"
        self.waveforms = ["Seno", "Cuadrada", "Triangular", "Sierra"]
        self.wave_idx = 0
        self.mod_rate = 4.0
        self.mod_depth = 0.0
        self.mod_mode = "Ninguna"
        print(f"🎹 Synth Bridge Initialized using ookokok logic")

    def handle_event(self, event):
        etype = event.get('type')
        eid = event.get('id')
        val = event.get('value')

        if etype == 'axis':
            # Mapear joysticks a parámetros de audio
            if eid == 'lstick_y':
                # Joystick arriba -> Más frecuencia (200Hz a 2000Hz)
                self.freq = 200 + ((-val + 1) / 2) * 1800
            elif eid == 'rstick_y':
                # Modulación
                self.mod_depth = ((-val + 1) / 2)
                self.mod_mode = "FM" if self.mod_depth > 0.1 else "Ninguna"

        elif etype == 'button' and val == 1:
            if eid == 'cross':
                print(f"🎵 Playing: {self.waveform} @ {self.freq:.2f}Hz (Mod: {self.mod_mode})")
                path = self.audio.render_tone(
                    frequency=self.freq,
                    duration_seconds=0.5,
                    waveform=self.waveform,
                    modulation_mode=self.mod_mode,
                    modulation_rate=self.mod_rate,
                    modulation_depth=self.mod_depth
                )
                self.audio.play_file(path)
            
            elif eid == 'circle':
                self.wave_idx = (self.wave_idx + 1) % len(self.waveforms)
                self.waveform = self.waveforms[self.wave_idx]
                print(f"🌊 Waveform changed to: {self.waveform}")

    async def listen(self):
        uri = "ws://localhost:8080"
        print(f"🔗 Connecting to ControlUniversal server at {uri}...")
        try:
            async with websockets.connect(uri) as websocket:
                while True:
                    msg = await websocket.recv()
                    data = json.loads(msg)
                    self.handle_event(data)
        except Exception as e:
            print(f"❌ Connection error: {e}")

if __name__ == "__main__":
    bridge = SynthBridge()
    asyncio.run(bridge.listen())
