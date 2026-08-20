import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GroqService } from './groq.service';
import { RelationshipContextService } from './relationship-context.service';

@Module({
  imports: [ConfigModule],
  providers: [GroqService, RelationshipContextService],
  exports: [GroqService, RelationshipContextService],
})
export class AiModule {}
