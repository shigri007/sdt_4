"""Create a portable source-and-build submission without local data or dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

project = Path(__file__).resolve().parents[1]
output = project.parent / "SteriTrack_Submission.zip"
excluded = {"node_modules", ".data", ".npm-cache", ".git", "coverage", "__pycache__"}

with ZipFile(output, "w", ZIP_DEFLATED, compresslevel=9) as archive:
    for file in sorted(project.rglob("*")):
        if not file.is_file() or any(part in excluded for part in file.relative_to(project).parts):
            continue
        archive.write(file, Path(project.name) / file.relative_to(project))

with ZipFile(output) as archive:
    bad = archive.testzip()
    if bad:
        raise RuntimeError(f"Archive integrity check failed: {bad}")
    print(f"Created {output} ({len(archive.namelist())} files)")
