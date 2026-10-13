import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentsController } from './documents.controller'
import { DocumentsService, secretsCorrespondent } from './documents.service'
import type { PerimetreService } from '../../common/perimetre.service'
import type { PrismaService } from '../../prisma/prisma.service'

const configuration = vi.hoisted(() => ({
  CRON_SECRET: undefined as string | undefined,
  URL_FRONTEND_PAROISSE: 'https://paroisse.exemple.ci',
}))
vi.mock('../../config/env', () => ({ env: () => configuration }))
vi.mock('../../common/lib/notifications', () => ({ envoyerEmailRappelDocuments: vi.fn(async () => undefined) }))

const SECRET = 'secret-cron-de-test-0123456789'

describe('cron/rappels-documents', () => {
  const findMany = vi.fn(async () => [])
  const prisma = { document: { findMany } } as unknown as PrismaService
  const service = new DocumentsService(prisma, {} as PerimetreService)
  const controleur = new DocumentsController(service)

  beforeEach(() => {
    findMany.mockClear()
    configuration.CRON_SECRET = SECRET
  })

  it('refuse sans secret (401) et ne lit aucun document', async () => {
    await expect(controleur.rappelsDocuments(undefined)).rejects.toBeInstanceOf(UnauthorizedException)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('refuse un secret invalide, y compris de même longueur', async () => {
    await expect(controleur.rappelsDocuments('mauvais')).rejects.toBeInstanceOf(UnauthorizedException)
    await expect(controleur.rappelsDocuments(SECRET.replace(/.$/, 'X'))).rejects.toBeInstanceOf(UnauthorizedException)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('renvoie 500 si CRON_SECRET n’est pas configuré, même avec un en-tête', async () => {
    configuration.CRON_SECRET = undefined
    await expect(controleur.rappelsDocuments(SECRET)).rejects.toBeInstanceOf(InternalServerErrorException)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('accepte le bon secret', async () => {
    await expect(controleur.rappelsDocuments(SECRET)).resolves.toEqual({ documentsConcernes: 0, parentsNotifies: 0 })
    expect(findMany).toHaveBeenCalledOnce()
  })

  it('compare les secrets sans lever sur des longueurs différentes', () => {
    expect(secretsCorrespondent('abc', 'abcd')).toBe(false)
    expect(secretsCorrespondent('abcd', 'abcd')).toBe(true)
  })
})
