import { Global, Module } from '@nestjs/common'
import { AdminConfigurationController, ConfigurationController } from './configuration.controller'
import { ConfigurationService } from './configuration.service'

@Global()
@Module({
  controllers: [AdminConfigurationController, ConfigurationController],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
