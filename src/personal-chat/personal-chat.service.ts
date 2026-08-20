import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from '../chat/dto/create-message.dto';
import { MessageRole } from '@prisma/client';
import { GroqService, ChatMessageInput } from '../ai/groq.service';

@Injectable()
export class PersonalChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groqService: GroqService,
  ) {}

  /**
   * Retrieves or creates the single persistent PersonalChat session for the authenticated user.
   * If a PersonalChat session already exists for the user, it is reused and its history loaded.
   */
  async getOrCreatePersonalChat(userId: string) {
    let personalChat = await this.prisma.personalChat.findUnique({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!personalChat) {
      personalChat = await this.prisma.personalChat.create({
        data: { userId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    return personalChat;
  }

  /**
   * Retrieves all messages for the authenticated user's persistent PersonalChat.
   */
  async getMessages(userId: string) {
    const personalChat = await this.prisma.personalChat.findUnique({
      where: { userId },
    });

    if (!personalChat) {
      return [];
    }

    return this.prisma.personalChatMessage.findMany({
      where: { personalChatId: personalChat.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Sends a user message in the user's persistent PersonalChat, queries the Groq LLM,
   * saves the AI assistant response, and returns the assistant message.
   */
  async sendMessage(userId: string, dto: CreateMessageDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let personalChat = await this.prisma.personalChat.findUnique({
      where: { userId },
    });

    if (!personalChat) {
      personalChat = await this.prisma.personalChat.create({
        data: { userId },
      });
    }

    // 1. Save USER message to database
    await this.prisma.personalChatMessage.create({
      data: {
        personalChatId: personalChat.id,
        role: MessageRole.USER,
        content: dto.content,
      },
    });

    // 2. Fetch recent conversation history (latest 20 messages)
    const rawHistory = await this.prisma.personalChatMessage.findMany({
      where: { personalChatId: personalChat.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const history: ChatMessageInput[] = rawHistory.reverse().map((m) => ({
      role: m.role === MessageRole.USER ? 'user' : 'assistant',
      content: m.content,
    }));

    // 3. Build Personal AI Companion System Prompt
    const systemPrompt = `You are CLO AI, a warm, supportive, empathetic, and intuitive personal AI companion. The user's name is ${user.name}.
You provide a safe, judgment-free space for ${user.name} to share their thoughts, feelings, daily experiences, ideas, and reflections.
Be direct, thoughtful, comforting, and engaging. Speak naturally in English or Hinglish if the user speaks in Hinglish.
Keep responses concise, clear, and focused on being a genuine personal companion.`;

    // 4. Request response from Groq LLM
    const aiResponseContent = await this.groqService.generateResponse({
      systemPrompt,
      history,
    });

    // 5. Save ASSISTANT message to database
    const assistantMessage = await this.prisma.personalChatMessage.create({
      data: {
        personalChatId: personalChat.id,
        role: MessageRole.ASSISTANT,
        content: aiResponseContent,
      },
    });

    // 6. Return ASSISTANT message
    return assistantMessage;
  }

  /**
   * Deletes/clears the personal conversation history for the authenticated user.
   */
  async deletePersonalChat(userId: string) {
    const personalChat = await this.prisma.personalChat.findUnique({
      where: { userId },
    });

    if (!personalChat) {
      return { message: 'Personal chat already deleted or not found' };
    }

    await this.prisma.personalChat.delete({
      where: { id: personalChat.id },
    });

    return { message: 'Personal chat deleted successfully' };
  }
}
