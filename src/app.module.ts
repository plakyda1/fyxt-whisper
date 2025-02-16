import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { VideoController } from './video/video.controller';
import { VideoService } from './video/video.service';

@Module({
  imports: [MulterModule.register({ dest: './uploads' })],
  controllers: [VideoController],
  providers: [VideoService],
})
export class AppModule {}
