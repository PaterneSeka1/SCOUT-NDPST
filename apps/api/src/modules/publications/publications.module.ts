import { Module } from '@nestjs/common'
import {
  AdminCategoriesController,
  AdminPublicationsController,
  PublicPublicationsController,
} from './publications.controller'
import { PublicationsService } from './publications.service'

@Module({
  controllers: [AdminPublicationsController, AdminCategoriesController, PublicPublicationsController],
  providers: [PublicationsService],
  exports: [PublicationsService],
})
export class PublicationsModule {}
