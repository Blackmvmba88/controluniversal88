from __future__ import annotations

import math
import shutil
import struct
import subprocess
import tempfile
import wave
from pathlib import Path


class AudioLab:
    def __init__(self) -> None:
        self.sample_rate = 44100
        self.temp_dir = Path(tempfile.mkdtemp(prefix="music_lab_"))
        self.current_process: subprocess.Popen[bytes] | None = None
        self.last_file: Path | None = None
        self.player = shutil.which("afplay")

    def waveform_points(
        self,
        *,
        width: int,
        height: int,
        frequency: float,
        waveform: str,
        modulation_mode: str = "Ninguna",
        modulation_rate: float = 4.0,
        modulation_depth: float = 0.0,
        cycles: float = 2.5,
    ) -> list[tuple[float, float]]:
        mid_y = height / 2
        amplitude = height * 0.34
        points: list[tuple[float, float]] = []
        for index in range(width):
            time_position = (index / max(width - 1, 1)) * (cycles / max(frequency, 1.0))
            value = self._modulated_sample(
                time_position=time_position,
                frequency=frequency,
                waveform=waveform,
                modulation_mode=modulation_mode,
                modulation_rate=modulation_rate,
                modulation_depth=modulation_depth,
            )
            y = mid_y - value * amplitude
            points.append((index, y))
        return points

    def render_tone(
        self,
        *,
        frequency: float,
        duration_seconds: float,
        waveform: str,
        modulation_mode: str = "Ninguna",
        modulation_rate: float = 4.0,
        modulation_depth: float = 0.0,
        volume: float = 0.35,
    ) -> Path:
        total_frames = int(self.sample_rate * duration_seconds)
        path = self.temp_dir / f"{waveform}_{int(frequency)}_{total_frames}.wav"

        with wave.open(str(path), "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(self.sample_rate)

            frames = bytearray()
            for frame in range(total_frames):
                time_position = frame / self.sample_rate
                sample = self._modulated_sample(
                    time_position=time_position,
                    frequency=frequency,
                    waveform=waveform,
                    modulation_mode=modulation_mode,
                    modulation_rate=modulation_rate,
                    modulation_depth=modulation_depth,
                )
                envelope = min(frame / 600, 1.0) * min((total_frames - frame) / 1200, 1.0)
                amplitude = int(max(-1.0, min(1.0, sample * volume * envelope)) * 32767)
                frames.extend(struct.pack("<h", amplitude))

            wav_file.writeframes(frames)

        self.last_file = path
        return path

    def play_file(self, path: Path) -> None:
        self.stop()
        if self.player:
            self.current_process = subprocess.Popen(
                [self.player, str(path)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

    def stop(self) -> None:
        if self.current_process and self.current_process.poll() is None:
            self.current_process.terminate()
        self.current_process = None

    def cleanup(self) -> None:
        self.stop()
        for file_path in self.temp_dir.glob("*.wav"):
            try:
                file_path.unlink()
            except OSError:
                pass
        try:
            self.temp_dir.rmdir()
        except OSError:
            pass

    @staticmethod
    def _sample_waveform(phase: float, waveform: str) -> float:
        normalized = (phase / math.tau) % 1.0
        if waveform == "Cuadrada":
            return 1.0 if math.sin(phase) >= 0 else -1.0
        if waveform == "Triangular":
            return 1.0 - 4.0 * abs(normalized - 0.5)
        if waveform == "Sierra":
            return 2.0 * normalized - 1.0
        return math.sin(phase)

    def _modulated_sample(
        self,
        *,
        time_position: float,
        frequency: float,
        waveform: str,
        modulation_mode: str,
        modulation_rate: float,
        modulation_depth: float,
    ) -> float:
        modulation_phase = math.tau * modulation_rate * time_position
        carrier_phase = math.tau * frequency * time_position
        depth = max(0.0, modulation_depth)

        if modulation_mode == "AM":
            carrier = self._sample_waveform(carrier_phase, waveform)
            modulator = 1 - depth + depth * ((math.sin(modulation_phase) + 1) / 2)
            return carrier * modulator

        if modulation_mode == "FM":
            modulated_phase = carrier_phase + depth * math.sin(modulation_phase) * math.pi
            return self._sample_waveform(modulated_phase, waveform)

        if modulation_mode == "Ring":
            carrier = self._sample_waveform(carrier_phase, waveform)
            ring = math.sin(modulation_phase)
            return carrier * ((1 - depth) + depth * ring)

        return self._sample_waveform(carrier_phase, waveform)
