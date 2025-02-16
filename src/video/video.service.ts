import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as ffmpeg from 'fluent-ffmpeg';
import { OpenAI } from 'openai';
import * as path from 'path';
import * as dotenv from 'dotenv';
import {
  TranscriptionVerbose,
  TranscriptionWord,
} from 'openai/resources/audio/transcriptions';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

@Injectable()
export class VideoService {
  private async extractAudio(
    videoPath: string,
    audioPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      ffmpeg(videoPath)
        .output(audioPath)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  private async transcribeAudio(
    audioPath: string,
  ): Promise<TranscriptionWord[]> {
    const file = fs.createReadStream(audioPath);
    const response = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });
    return response.words || [];
  }

  private findTriggerWords(
    subtitles: TranscriptionWord[],
    triggerWords: string[],
  ): number[] {
    return subtitles
      .filter((word) => triggerWords.includes(word.word))
      .map((word) => word.start);
  }

  private async captureFrames(
    videoPath: string,
    timestamps: number[],
    outputDir: string,
  ): Promise<string[]> {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const images: string[] = [];
    for (const [index, time] of timestamps.entries()) {
      const outputImage = path.join(outputDir, `snapshot_${index}.jpg`);
      images.push(outputImage);

      await new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        ffmpeg(videoPath)
          .seekInput(time)
          .frames(1)
          .output(outputImage)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
    }

    return images;
  }

  async processVideo(
    videoPath: string,
    triggerWords: string[],
  ): Promise<{ snapshots: { time: number; image: string }[] }> {
    if (!fs.existsSync(`./${process.env.AUDIO_TEMP_DIR}`)) {
      fs.mkdirSync(`./${process.env.AUDIO_TEMP_DIR}`);
    }

    if (!fs.existsSync(`./${process.env.UPLOAD_DIR}`)) {
      fs.mkdirSync(`./${process.env.UPLOAD_DIR}`);
    }

    const fullVideoPath = `./${process.env.UPLOAD_DIR}/${videoPath}`;
    const fullAudioPath = `./${process.env.AUDIO_TEMP_DIR}/${videoPath}.wav`;

    console.log('🎬 Get audio...');
    await this.extractAudio(fullVideoPath, fullAudioPath);

    console.log('🗣️ Voice recognition...');
    const transcription = await this.transcribeAudio(fullAudioPath);
    console.log('📜 Recognized text:', transcription);

    console.log('🔍 Looking for trigger words...');
    const timestamps = this.findTriggerWords(transcription, triggerWords);
    console.log('⏱️ Timestamps:', timestamps);

    console.log('📸 Taking snapshots...');
    const outputFolder = process.env.SNAPSHOT_DIR || 'snapshots';
    const images = await this.captureFrames(
      fullVideoPath,
      timestamps,
      outputFolder,
    );

    const result = {
      snapshots: timestamps.map((time, index) => ({
        time,
        image: images[index],
      })),
    };

    console.log('🎉 Done!', result);

    return result;
  }
}
