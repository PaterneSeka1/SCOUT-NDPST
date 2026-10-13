import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

// Global : infrastructure transverse utilisée par tous les modules métier.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
