"""Ponte entre a interface do iPad e o mesmo núcleo Python do Windows (executado via Pyodide/WebAssembly)."""
import json
import sys
from urllib.parse import parse_qs

sys.path.insert(0, "/app")

from server import App, VERSION, make_dispatch  # noqa: E402

app = App("/data", log=print, mobile=True)
_dispatch = make_dispatch(app)
app.auto_backup_once(startup=True)


def call(method, path, query, body_json, session=None):
    qs = parse_qs(query or "", keep_blank_values=True)
    body = json.loads(body_json) if body_json else {}
    code, ctype, data, fname = _dispatch(method, path, qs, body, session or None)
    return [code, ctype, data, fname or ""]


def version():
    return VERSION
