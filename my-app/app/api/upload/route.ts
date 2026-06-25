import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const TAILLE_MAX = 5 * 1024 * 1024 // 5 Mo
const TYPES_AUTORISES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const formData = await req.formData()
  const fichier = formData.get('fichier') as File | null
  if (!fichier) return NextResponse.json({ erreur: 'Aucun fichier reçu' }, { status: 400 })

  if (!TYPES_AUTORISES.includes(fichier.type))
    return NextResponse.json({ erreur: 'Type de fichier non autorisé (JPEG, PNG, WebP, GIF)' }, { status: 400 })

  if (fichier.size > TAILLE_MAX)
    return NextResponse.json({ erreur: 'Fichier trop volumineux (max 5 Mo)' }, { status: 400 })

  const ext = fichier.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const nomFichier = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const dossier = path.join(process.cwd(), 'public', 'uploads')

  await mkdir(dossier, { recursive: true })
  const buffer = Buffer.from(await fichier.arrayBuffer())
  await writeFile(path.join(dossier, nomFichier), buffer)

  return NextResponse.json({ url: `/uploads/${nomFichier}` })
}
