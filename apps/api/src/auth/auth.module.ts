import { Global, Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { MotDePasseService } from './mot-de-passe.service'

// Global : AuthService.revoquerToutes est utilisé par les modules qui changent
// un mot de passe ou désactivent un compte.
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, MotDePasseService],
  exports: [AuthService],
})
export class AuthModule {}
