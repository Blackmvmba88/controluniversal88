from __future__ import annotations

import json
import time
from pathlib import Path


PIECES_PATH = Path(__file__).with_name("pieces_library.json")


class PieceStore:
    def load(self) -> list[dict[str, object]]:
        if not PIECES_PATH.exists():
            return []
        data = json.loads(PIECES_PATH.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
        return []

    def save(self, pieces: list[dict[str, object]]) -> None:
        PIECES_PATH.write_text(
            json.dumps(pieces, ensure_ascii=True, indent=2),
            encoding="utf-8",
        )

    def upsert_piece(self, payload: dict[str, object]) -> list[dict[str, object]]:
        pieces = self.load()
        name = str(payload.get("name", "")).strip()
        stamped = dict(payload)
        stamped["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")

        for index, piece in enumerate(pieces):
            if str(piece.get("name", "")).strip().lower() == name.lower():
                pieces[index] = stamped
                self.save(pieces)
                return pieces

        pieces.append(stamped)
        self.save(pieces)
        return pieces
