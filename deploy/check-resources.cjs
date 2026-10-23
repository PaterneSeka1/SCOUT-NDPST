// Sonde locale Linux sans dépendance, service ni appel réseau.
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { execFileSync } = require('node:child_process')

const DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/
const arrondir = (nombre) => Number(nombre.toFixed(2))

function seuil(valeur, defaut, maximum = Infinity) {
  const texte = valeur === undefined ? String(defaut) : valeur
  if (!DECIMAL.test(texte)) return null
  const nombre = Number(texte)
  return Number.isFinite(nombre) && nombre > 0 && nombre <= maximum ? nombre : null
}

function memoire(procDir, limite) {
  let utilisation = null
  try {
    const contenu = readFileSync(join(procDir, 'meminfo'), 'utf8')
    const lire = (cle) => {
      const trouve = contenu.match(new RegExp(`^${cle}:\\s+([0-9]+) kB\\s*$`, 'm'))
      const nombre = trouve ? Number(trouve[1]) : NaN
      if (!Number.isSafeInteger(nombre) || nombre < 0) throw new Error('mesure invalide')
      return nombre
    }
    const total = lire('MemTotal')
    const disponible = lire('MemAvailable')
    if (total <= 0 || disponible > total) throw new Error('mesure invalide')
    utilisation = (1 - disponible / total) * 100
  } catch {
    // Ne journaliser ni chemin local ni contenu de fichier.
  }
  return {
    statut: limite === null ? 'configuration-invalide' : utilisation === null ? 'indisponible' : utilisation > limite ? 'alerte' : 'ok',
    utilisationPourcent: utilisation === null ? null : arrondir(utilisation),
    seuilPourcent: limite,
  }
}

function charge(procDir, limite) {
  let charge5Minutes = null
  let processeurs = null
  try {
    const valeurs = readFileSync(join(procDir, 'loadavg'), 'utf8').trim().split(/\s+/)
    if (valeurs.length < 3 || !valeurs.slice(0, 3).every((valeur) => DECIMAL.test(valeur))) throw new Error('mesure invalide')
    const mesure = Number(valeurs[1])
    if (!Number.isFinite(mesure)) throw new Error('mesure invalide')
    charge5Minutes = mesure
    const cpus = execFileSync('getconf', ['_NPROCESSORS_ONLN'], {
      encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    if (!/^[1-9][0-9]*$/.test(cpus) || !Number.isSafeInteger(Number(cpus))) throw new Error('mesure invalide')
    processeurs = Number(cpus)
  } catch {
    // Une CPU inconnue n'est jamais remplacée par 1.
  }
  const parCpu = charge5Minutes !== null && processeurs !== null ? charge5Minutes / processeurs : null
  return {
    statut: limite === null ? 'configuration-invalide' : parCpu === null ? 'indisponible' : parCpu > limite ? 'alerte' : 'ok',
    charge5Minutes,
    processeurs,
    chargeParCpu5Minutes: parCpu === null ? null : arrondir(parCpu),
    seuilParCpu: limite,
  }
}

const procDir = process.env.SCOUT_RESOURCE_PROC_DIR ?? '/proc'
const resultat = {
  horodatage: new Date().toISOString(),
  evenement: 'ressources.controle',
  memoire: memoire(procDir, seuil(process.env.SCOUT_MEMORY_MAX_PERCENT, 90, 100)),
  charge: charge(procDir, seuil(process.env.SCOUT_LOAD5_MAX_PER_CPU, 2)),
}
console.log(JSON.stringify(resultat))
if (resultat.memoire.statut !== 'ok' || resultat.charge.statut !== 'ok') process.exitCode = 1
