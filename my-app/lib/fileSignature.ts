// Détection du type de fichier à partir des octets réels (magic bytes),
// jamais du Content-Type déclaré par le client (falsifiable dans une requête
// multipart forgée) ni de l'extension du nom de fichier fourni par
// l'utilisateur. Utilisé par /api/upload pour dériver un type ET une
// extension de stockage fiables — empêche l'upload d'un SVG/HTML malveillant
// déguisé en ".png", qui serait ensuite servi tel quel par Next.js et
// interprété comme tel par le navigateur (XSS stocké).

interface SignatureFichier {
  mime: string
  ext: string
  correspond: (octets: Buffer) => boolean
}

const SIGNATURES: SignatureFichier[] = [
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    correspond: (o) => o.length >= 3 && o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff,
  },
  {
    mime: 'image/png',
    ext: 'png',
    correspond: (o) =>
      o.length >= 8 && o.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/gif',
    ext: 'gif',
    correspond: (o) =>
      o.length >= 6 &&
      o.subarray(0, 3).toString('latin1') === 'GIF' &&
      (o.subarray(3, 6).toString('latin1') === '87a' || o.subarray(3, 6).toString('latin1') === '89a'),
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    correspond: (o) =>
      o.length >= 12 && o.subarray(0, 4).toString('latin1') === 'RIFF' && o.subarray(8, 12).toString('latin1') === 'WEBP',
  },
  {
    mime: 'application/pdf',
    ext: 'pdf',
    correspond: (o) => o.length >= 5 && o.subarray(0, 5).toString('latin1') === '%PDF-',
  },
]

export interface TypeFichierDetecte {
  mime: string
  ext: string
}

export function detecterTypeFichier(octets: Buffer): TypeFichierDetecte | null {
  const signature = SIGNATURES.find((s) => s.correspond(octets))
  return signature ? { mime: signature.mime, ext: signature.ext } : null
}
