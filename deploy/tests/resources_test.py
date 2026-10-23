"""Contrôle des ressources Linux sur fixtures, sans service ni appel réseau."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[2]
NODE = shutil.which("node")


def executable(path, contenu):
    path.write_text("#!/usr/bin/env bash\nset -eu\n" + contenu)
    path.chmod(0o755)


with tempfile.TemporaryDirectory(prefix="scout-resources-") as temporaire:
    racine = Path(temporaire)
    proc = racine / "proc"
    binaires = racine / "bin"
    proc.mkdir()
    binaires.mkdir()
    executable(binaires / "getconf", 'test "$1" = _NPROCESSORS_ONLN\necho "${TEST_CPUS:-2}"\n')
    environnement = {
        cle: valeur for cle, valeur in os.environ.items()
        if not cle.startswith("SCOUT_RESOURCE_") and cle not in ("SCOUT_MEMORY_MAX_PERCENT", "SCOUT_LOAD5_MAX_PER_CPU")
    }
    environnement.update({"PATH": str(binaires) + os.pathsep + os.environ["PATH"], "SCOUT_RESOURCE_PROC_DIR": str(proc)})

    def verifier(memoire="MemTotal: 1000 kB\nMemAvailable: 200 kB\n", charge="0.50 1.00 1.50 1/20 123\n", supplement=None):
        (proc / "meminfo").write_text(memoire)
        (proc / "loadavg").write_text(charge)
        resultat = subprocess.run([NODE, str(REPO / "deploy/check-resources.cjs")], env={**environnement, **(supplement or {})}, capture_output=True, text=True)
        assert not resultat.stderr, resultat.stderr
        return resultat.returncode, json.loads(resultat.stdout)

    code, mesures = verifier()
    assert code == 0 and mesures["memoire"]["utilisationPourcent"] == 80
    assert mesures["charge"]["chargeParCpu5Minutes"] == 0.5
    assert str(proc) not in json.dumps(mesures)

    code, mesures = verifier(memoire="MemTotal: 1000 kB\nMemAvailable: 50 kB\n")
    assert code == 1 and mesures["memoire"]["statut"] == "alerte"
    code, mesures = verifier(charge="0.00 5.00 0.00 1/20 123\n")
    assert code == 1 and mesures["charge"]["statut"] == "alerte"

    code, mesures = verifier(memoire="MemTotal: 1000 kB\nMemAvailable: invalide\n")
    assert code == 1 and mesures["memoire"]["statut"] == "indisponible" and mesures["memoire"]["utilisationPourcent"] is None
    code, mesures = verifier(charge="0.00 invalide 0.00\n")
    assert code == 1 and mesures["charge"]["statut"] == "indisponible"
    code, mesures = verifier(supplement={"TEST_CPUS": "0"})
    assert code == 1 and mesures["charge"]["statut"] == "indisponible"

    for invalide in ("", "NaN", "Infinity", "0", "-1", " 90", "2e0", "0x10", "2; secret"):
        code, mesures = verifier(supplement={"SCOUT_MEMORY_MAX_PERCENT": invalide, "SCOUT_LOAD5_MAX_PER_CPU": invalide})
        assert code == 1
        assert mesures["memoire"]["statut"] == mesures["charge"]["statut"] == "configuration-invalide"
        assert "secret" not in json.dumps(mesures)
    code, mesures = verifier(supplement={"SCOUT_MEMORY_MAX_PERCENT": "101"})
    assert code == 1 and mesures["memoire"]["statut"] == "configuration-invalide"
    code, mesures = verifier(supplement={"SCOUT_MEMORY_MAX_PERCENT": "85.5", "SCOUT_LOAD5_MAX_PER_CPU": "0.25"})
    assert code == 1 and mesures["memoire"]["statut"] == "ok" and mesures["charge"]["statut"] == "alerte"

    # Intégration de monitor.sh : santé/sauvegarde/disque simulés, sonde
    # ressources réelle et fichiers /proc synthétiques.
    installation = racine / "installation"
    (installation / "deploy").mkdir(parents=True)
    (installation / "apps/api").mkdir(parents=True)
    shutil.copy(REPO / "deploy/monitor.sh", installation / "deploy/monitor.sh")
    shutil.copy(REPO / "deploy/check-resources.cjs", installation / "deploy/check-resources.cjs")
    executable(installation / "deploy/check-health.sh", "exit 0\n")
    executable(binaires / "node", f'case "$1" in\n  *check-backup.cjs) exit 0;;\n  *) exec "{NODE}" "$@";;\nesac\n')
    executable(binaires / "df", 'printf "Filesystem blocks used available capacity mounted\\ntest 100 10 90 10%% /test\\n"\n')
    for disponible, attendu in ((200, 0), (50, 1)):
        (proc / "meminfo").write_text(f"MemTotal: 1000 kB\nMemAvailable: {disponible} kB\n")
        (proc / "loadavg").write_text("0.00 1.00 0.00 1/20 123\n")
        resultat = subprocess.run(["bash", str(installation / "deploy/monitor.sh"), "paroisse"], env=environnement, capture_output=True, text=True)
        assert resultat.returncode == attendu, resultat.stderr
        sorties = [json.loads(ligne) for ligne in resultat.stdout.splitlines()]
        assert sorties[0]["evenement"] == "ressources.controle"
        assert any(ligne["evenement"] == "supervision.ok" for ligne in sorties) == (attendu == 0)

print("OK ressources : mesures, seuils, indisponibilités et intégration monitor")
