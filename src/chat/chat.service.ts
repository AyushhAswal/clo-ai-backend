import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageRole } from '@prisma/client';
import { GroqService, ChatMessageInput } from '../ai/groq.service';
import { RelationshipContextService } from '../ai/relationship-context.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groqService: GroqService,
    private readonly relationshipContextService: RelationshipContextService,
  ) {}

  private async verifyRelationshipOwnership(
    userId: string,
    relationshipId: string,
  ) {
    const relationship = await this.prisma.relationship.findUnique({
      where: { id: relationshipId },
      include: { answers: true },
    });

    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }

    if (relationship.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this relationship',
      );
    }

    return relationship;
  }

  async getOrCreateChat(userId: string, relationshipId: string) {
    const relationship = await this.verifyRelationshipOwnership(
      userId,
      relationshipId,
    );

    let chat = await this.prisma.chat.findUnique({
      where: { relationshipId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) {
      chat = await this.prisma.chat.create({
        data: { relationshipId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    const context = {
      relationship: {
        name: relationship.name,
        relationshipType: relationship.relationshipType,
        category: relationship.category,
      },
      questionnaire: relationship.answers.map((ans) => ({
        questionText: ans.questionText,
        answer: ans.answer,
      })),
    };

    return {
      ...chat,
      context,
    };
  }

  async getMessages(userId: string, relationshipId: string) {
    await this.verifyRelationshipOwnership(userId, relationshipId);

    const chat = await this.prisma.chat.findUnique({
      where: { relationshipId },
    });

    if (!chat) {
      return [];
    }

    return this.prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(
    userId: string,
    relationshipId: string,
    dto: CreateMessageDto,
  ) {
    const relationship = await this.verifyRelationshipOwnership(
      userId,
      relationshipId,
    );

    let chat = await this.prisma.chat.findUnique({
      where: { relationshipId },
    });

    if (!chat) {
      chat = await this.prisma.chat.create({
        data: { relationshipId },
      });
    }

    // 1. Save USER message to database
    await this.prisma.message.create({
      data: {
        chatId: chat.id,
        role: MessageRole.USER,
        content: dto.content,
      },
    });

    // 2. Fetch recent conversation history (latest 20 messages)
    const rawHistory = await this.prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const history: ChatMessageInput[] = rawHistory.reverse().map((m) => ({
      role: m.role === MessageRole.USER ? 'user' : 'assistant',
      content: m.content,
    }));

    // 3. Build AI system prompt
    const systemPrompt = this.relationshipContextService.buildSystemPrompt({
      name: relationship.name,
      relationshipType: relationship.relationshipType,
      category: relationship.category,
      answers: relationship.answers,
    });

    // 4. Request response from Groq LLM
    const aiResponseContent = await this.groqService.generateResponse({
      systemPrompt,
      history,
    });

    // 5. Save ASSISTANT message to database
    const assistantMessage = await this.prisma.message.create({
      data: {
        chatId: chat.id,
        role: MessageRole.ASSISTANT,
        content: aiResponseContent,
      },
    });

    // 6. Return ASSISTANT message
    return assistantMessage;
  }

  async deleteChat(userId: string, relationshipId: string) {
    await this.verifyRelationshipOwnership(userId, relationshipId);

    const chat = await this.prisma.chat.findUnique({
      where: { relationshipId },
    });

    if (!chat) {
      return { message: 'Chat already deleted or not found' };
    }

    await this.prisma.chat.delete({
      where: { id: chat.id },
    });

    return { message: 'Chat deleted successfully' };
  }
}
