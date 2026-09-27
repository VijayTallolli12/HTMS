import { Module } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { ChannelManagerService } from './services/channel-manager.service';
import { ChannelManagerController } from './controllers/channel-manager.controller';

@Module({
  controllers: [ChannelManagerController],
  providers: [PrismaService, ChannelManagerService],
  exports: [ChannelManagerService],
})
export class ChannelManagerModule {}