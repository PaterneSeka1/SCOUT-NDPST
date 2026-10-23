import 'reflect-metadata'
import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { chargerClesAdmin } from './auth/cles-admin'
import { chargerEnv } from './config/env'
import { logger } from './common/lib/logger'

async function demarrer() {
  // Échoue immédiatement si la configuration est incomplète.
  const config = chargerEnv()
  // Clés de l'administrateur plateforme partagé (voir auth/cles-admin.ts) :
  // une clé absente ou invalide doit empêcher le démarrage.
  chargerClesAdmin()

  // Analyse des corps gérée ici plutôt que par Nest, pour répondre au format
  // de l'API ({ erreur }) sans exposer le message technique du parseur.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false })
  // Corps JSON limité : les fichiers passent par les routes multipart dédiées.
  app.use(json({ limit: '1mb' }))
  app.use(urlencoded({ extended: false, limit: '1mb' }))
  app.use((erreur: { type?: string }, _requete: Request, reponse: Response, suivant: NextFunction) => {
    if (erreur?.type === 'entity.parse.failed') {
      reponse.status(400).json({ erreur: 'Corps JSON invalide' })
      return
    }
    if (erreur?.type === 'entity.too.large') {
      reponse.status(413).json({ erreur: 'Requête trop volumineuse' })
      return
    }
    suivant(erreur)
  })

  // IP réelle derrière Nginx (et le proxy du frontend) pour la limitation de débit.
  app.set('trust proxy', config.TRUST_PROXY)
  app.setGlobalPrefix('api')
  app.use(helmet())
  app.use(cookieParser())
  // Les réponses peuvent contenir des données privées ou un secret d'activation
  // remis une seule fois. Aucun intermédiaire ne doit les conserver.
  app.use((_requete: Request, reponse: Response, suivant: NextFunction) => {
    reponse.setHeader('Cache-Control', 'no-store')
    suivant()
  })

  const origines = config.CORS_ORIGINES.split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  app.enableCors({
    // Liste explicite uniquement : jamais d'écho de l'en-tête Origin.
    origin: origines.length > 0 ? origines : false,
    credentials: true,
  })

  if (config.SWAGGER_ACTIF) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('API SCOUT ASCCI')
        .setDescription('API commune aux plateformes paroisse, district, région et nation.')
        .setVersion('1.0')
        .addCookieAuth('scout_acces')
        .addBearerAuth()
        .build(),
    )
    SwaggerModule.setup('api/docs', app, document)
  }

  app.enableShutdownHooks()
  await app.listen(config.PORT, config.HOST)
  logger.info('api.demarree', { port: config.PORT, host: config.HOST })
}

demarrer().catch((erreur) => {
  logger.error('api.demarrage_echoue', erreur)
  process.exit(1)
})
