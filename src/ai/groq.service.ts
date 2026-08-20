import {
  Injectable,
  InternalServerErrorException,
  BadGatewayException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

export interface ChatMessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private groqClient: Groq | null = null;
  private readonly modelName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    this.modelName =
      this.configService.get<string>('GROQ_MODEL') || 'groq/compound-mini';

    if (apiKey) {
      this.groqClient = new Groq({ apiKey });
    }
  }

  async generateResponse(params: {
    systemPrompt: string;
    history: ChatMessageInput[];
  }): Promise<string> {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');

    if (!apiKey) {
      this.logger.error('GROQ_API_KEY environment variable is not configured');
      throw new InternalServerErrorException(
        'GROQ_API_KEY is not configured on the backend server.',
      );
    }

    if (!this.groqClient) {
      this.groqClient = new Groq({ apiKey });
    }

    const messages: ChatMessageInput[] = [
      { role: 'system', content: params.systemPrompt },
      ...params.history,
    ];

    try {
      const completion = await this.groqClient.chat.completions.create({
        messages,
        model: this.modelName,
        temperature: 0.7,
        max_tokens: 1024,
      });

      const choice = completion.choices[0];
      const reply = choice?.message?.content?.trim();

      if (!reply) {
        throw new BadGatewayException('Groq LLM returned an empty response');
      }

      return reply;
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Groq API call failed: ${errMessage}`);
      throw new BadGatewayException(`AI Service Error: ${errMessage}`);
    }
  }
}
