"""Package the exported story collection without modifying its artwork."""
from pathlib import Path
import json
import sys
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
collection = sys.argv[1] if len(sys.argv) > 1 else 'stories'
if collection not in ('stories', 'chaos'):
    raise ValueError('Choose stories or chaos.')
folder = root / 'public' / 'spot-studio' / collection
bundle = folder / ('spot-chaos-pack.zip' if collection == 'chaos' else 'spot-story-pack.zip')
items = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
with ZipFile(bundle, 'w', ZIP_DEFLATED) as archive:
    for item in items:
        for key in ('asset', 'card'):
            archive.write(folder / item[key], item[key])
    for name in ('CAPTIONS.md', 'PROMPTS.md', 'manifest.json', 'dimensions.json'):
        archive.write(folder / name, name)
with ZipFile(bundle) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(items) * 2 + 4
print('Verified pack:', bundle.stat().st_size, 'bytes')
