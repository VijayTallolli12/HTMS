import { Module } from '@nestjs/common';
import { ChannelManagerService } from './services/channel-manager.service';
import { ChannelManagerController } from './controllers/channel-manager.controller';

@Module({
  controllers: [ChannelManagerController],
  providers: [ChannelManagerService],
  exports: [ChannelManagerService],
})
export class ChannelManagerModule {}