"""Small helpers shared by the evaluation scripts."""

import json
import platform
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict


def environment() -> Dict[str, str]:
    info = {"python": platform.python_version(), "machine": platform.machine(), "os": platform.system()}
    try:
        import torch

        info["torch"] = torch.__version__
        info["cuda_device"] = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu"
    except ImportError:
        pass
    return info


def save_json(obj: Dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(obj)
    if "generated_at" not in payload and path.parent.name == "reports":
        payload = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                   "environment": environment(), **payload}
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
