import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const CONFIG_PATH = path.join(process.cwd(), 'config', 'site.json')

const ROLES_AUTORISES = ['ADMIN_PAROISSE', 'CHEF_GROUPE']

export async function GET() {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8')
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json({ erreur: 'Configuration introuvable' }, { status: 404 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !ROLES_AUTORISES.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erreur: 'Corps JSON invalide' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ erreur: 'Données invalides' }, { status: 400 })
  }

  const data = body as Record<string, unknown>

  // Lecture config existante pour ne modifier que ce qui est transmis
  let existing: Record<string, unknown> = {}
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8')
    existing = JSON.parse(raw)
  } catch {
    // Si absent, on repart de zéro
  }

  const updated = { ...existing, ...data }

  await writeFile(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8')
  return NextResponse.json(updated)
}
