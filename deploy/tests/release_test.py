"""Exercise release links and recovery without real Git, PM2 or databases."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[2]


def executable(path, body):
    path.write_text("#!/usr/bin/env bash\nset -eu\n" + body)
    path.chmod(0o755)


with tempfile.TemporaryDirectory(prefix="scout-release-") as temporary:
    root = Path(temporary)
    source = root / "source"
    fixtures = root / "fixture"
    runtime = root / "runtime"
    binaries = root / "bin"
    for directory in (
        source / "deploy",
        fixtures / "deploy",
        fixtures / "apps/api",
        fixtures / "apps/web-paroisse",
        runtime / "shared",
        binaries,
    ):
        directory.mkdir(parents=True, exist_ok=True)
    shutil.copy(REPO / "deploy/release.sh", source / "deploy/release.sh")
    (runtime / "shared/.env.prod").write_text("INSTALLATION=paroisse\n")
    for name in ("api.env", "web-paroisse.env"):
        (runtime / "shared" / name).write_text("")

    executable(
        fixtures / "deploy/deploy-installation.sh",
        'test "$SCOUT_PREPARED_RELEASE" = yes\ntest "${MOCK_DEPLOY:-ok}" = ok\n',
    )
    executable(
        fixtures / "deploy/check-health.sh", 'test "${MOCK_HEALTH:-ok}" = ok\n'
    )
    (fixtures / "deploy/ecosystem.config.cjs").write_text("module.exports = {}\n")
    executable(
        binaries / "git",
        'case "$3" in\n'
        '  status) exit 0;;\n'
        '  rev-parse) echo "${MOCK_SHA:-abcdef123456}";;\n'
        '  archive) exec tar -C "$MOCK_FIXTURE" -cf - .;;\n'
        '  *) exit 1;;\n'
        'esac\n',
    )
    executable(binaries / "pm2", 'echo "$*" >> "$MOCK_PM2_LOG"\n')
    environment = {
        **os.environ,
        "PATH": str(binaries) + ":" + os.environ["PATH"],
        "SCOUT_RELEASE_ROOT": str(runtime),
        "SCOUT_FIRST_RELEASE": "yes",
        "MOCK_FIXTURE": str(fixtures),
        "MOCK_PM2_LOG": str(root / "pm2.log"),
    }

    def run(*arguments, success=True, extra=None):
        result = subprocess.run(
            [str(source / "deploy/release.sh"), *arguments],
            env={**environment, **(extra or {})},
            capture_output=True,
            text=True,
        )
        assert (result.returncode == 0) == success, (
            result.returncode, result.stdout, result.stderr
        )

    # L’attestation de compatibilité SQL est obligatoire.
    run("deploy", success=False)
    run("deploy", "--schema-compatible")
    current = (runtime / "current").resolve()
    assert (current / ".release-ready").exists()
    assert (current / "apps/api/.env").resolve() == runtime / "shared/api.env"

    previous = runtime / "releases/reference"
    shutil.copytree(current, previous, symlinks=True)
    (runtime / "previous").symlink_to(previous)
    run("rollback", "--schema-compatible", success=False, extra={"MOCK_HEALTH": "fail"})
    assert (runtime / "current").resolve() == current
    run("rollback", "--schema-compatible")
    assert (runtime / "current").resolve() == previous
    assert (runtime / "previous").resolve() == current

    # Après un échec de déploiement, restaurer la dernière version validée.
    run(
        "deploy", "--schema-compatible", success=False,
        extra={"MOCK_SHA": "failedrelease", "MOCK_DEPLOY": "fail"},
    )
    assert (runtime / "pending").is_symlink()
    assert (runtime / "current").resolve() == previous
    run("rollback", "--schema-compatible")
    assert (runtime / "current").resolve() == previous
    assert (runtime / "previous").resolve() == current
    assert not (runtime / "pending").is_symlink()
    print("5 scénarios release simulés validés; aucun PM2 ou PostgreSQL réel.")
