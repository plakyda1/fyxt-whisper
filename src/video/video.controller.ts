import {
  Controller,
  Post,
  UploadedFile,
  Body,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VideoService } from './video.service';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post('process')
  @UseInterceptors(
    FileInterceptor('file', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      storage: diskStorage({
        destination: `./${process.env.UPLOAD_DIR}`,
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          callback(null, uniqueSuffix + extname(file?.originalname));
        },
      }),
    }),
  )
  async processVideo(
    @UploadedFile() file: any,
    @Body() body: { triggerWords: string },
  ) {
    const triggerWords = body.triggerWords
      .split(',')
      .map((word) => word.trim());
    return this.videoService.processVideo(file?.filename, triggerWords);
  }
}
