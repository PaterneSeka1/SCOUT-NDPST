"""Check restoration isolation with fake Docker and npm; no real dump or DB."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[2]


def executable(path, body):
    path.write_text("#!/usr/bin/env bash\nset -eu\n" + body)
    path.chmod(0o755)


with tempfile.TemporaryDirectory(prefix="scout-restore-") as temporary:
    root = Path(temporary)
    source = root / "source"
    binaries = root / "bin"
    for directory in (source / "deploy", source / "apps/api", binaries):
        directory.mkdir(parents=True, exist_ok=True)
    shutil.copy(REPO / "deploy/test-restore.sh", source / "deploy/test-restore.sh")
    (source / "deploy/check-backup.cjs").write_text("process.exit(0)\n")
    executable(
        binaries / "npm",
        'while [[ "$1" != --sortie ]]; do shift; done\n'
        'printf PGDMP > "$2"\n',
    )
    executable(
        binaries / "docker",
        'echo "$*" >> "$MOCK_LOG"\n'
        'case "$1" in\n'
        '  run) [[ "${MOCK_CREATE_FAIL:-no}" = no ]] || exit 1; '
        'printf "%064d\\n" 1;;\n'
        '  inspect) cat "$MOCK_INSPECT";;\n'
        '  exec) case "$*" in *pg_restore*) cat >/dev/null;; *psql*) echo 1;; esac;;\n'
        '  rm) exit 0;;\n'
        '  *) exit 1;;\n'
        'esac\n',
    )
    inspection = root / "inspect.json"
    log = root / "docker.log"
    environment = {
        **os.environ,
        "PATH": str(binaries) + ":" + os.environ["PATH"],
        "MOCK_LOG": str(log),
        "MOCK_INSPECT": str(inspection),
    }

    def run(mounts, success, extra=None):
        inspection.write_text(json.dumps({
            "Config": {"Labels": {"scout.restore-test": "true"}},
            "HostConfig": {
                "NetworkMode": "none", "PortBindings": {},
                "Tmpfs": {"/var/lib/postgresql/data": "rw,size=768m"},
            },
            "Mounts": mounts,
        }))
        log.write_text("")
        result = subprocess.run(
            [str(source / "deploy/test-restore.sh")],
            env={**environment, **(extra or {})}, capture_output=True, text=True,
        )
        assert (result.returncode == 0) == success, result.stderr
        return log.read_text()

    calls = run([{"Type": "tmpfs"}], success=True)
    assert "--network none" in calls and "--tmpfs /var/lib/postgresql/data" in calls
    assert "pg_restore -U postgres -d scout_restore" in calls
    assert "rm -f -v " in calls

    calls = run([{"Type": "bind", "Source": "/production"}], success=False)
    assert "pg_restore" not in calls and "createdb" not in calls
    assert "rm -f -v " in calls

    calls = run([], success=False, extra={"MOCK_CREATE_FAIL": "yes"})
    assert "rm -f" not in calls, "Ne jamais supprimer un conteneur non créé ici"
    assert "pg_restore" not in calls
    print("3 scénarios restauration isolés validés; aucun Docker ou dump réel.")
