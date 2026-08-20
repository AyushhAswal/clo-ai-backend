import { Module } from '@nestjs/common';
import { PersonalChatService } from './personal-chat.service';
import { PersonalChatController } from './personal-chat.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [PersonalChatController],
  providers: [PersonalChatService],
  exports: [PersonalChatService],
})
export class PersonalChatModule {}
