import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { GroqService } from '../ai/groq.service';
import { RelationshipContextService } from '../ai/relationship-context.service';

describe('ChatService', () => {
  let service: ChatService;

  const mockRelationship = {
    id: 'rel-1',
    userId: 'user-1',
    name: 'Rahul',
    relationshipType: 'Friend',
    category: 'Friends',
    answers: [
      {
        id: 'ans-1',
        questionText: "Where's your friendship at?",
        answer: 'Close and solid',
      },
    ],
  };

  const mockChat = {
    id: 'chat-1',
    relationshipId: 'rel-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [
      {
        id: 'msg-1',
        chatId: 'chat-1',
        role: 'USER',
        content: 'Hello Rahul',
        createdAt: new Date(),
      },
    ],
  };

  const mockPrismaService = {
    relationship: {
      findUnique: jest.fn(),
    },
    chat: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockGroqService = {
    generateResponse: jest.fn(),
  };

  const mockRelationshipContextService = {
    buildSystemPrompt: jest.fn().mockReturnValue('System prompt text'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: GroqService, useValue: mockGroqService },
        {
          provide: RelationshipContextService,
          useValue: mockRelationshipContextService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    jest.clearAllMocks();
  });

  describe('getOrCreateChat', () => {
    it('returns existing chat with context if user owns relationship', async () => {
      mockPrismaService.relationship.findUnique.mockResolvedValue(
        mockRelationship,
      );
      mockPrismaService.chat.findUnique.mockResolvedValue(mockChat);

      const result = await service.getOrCreateChat('user-1', 'rel-1');
      expect(result.id).toBe('chat-1');
      expect(result.context.relationship.name).toBe('Rahul');
      expect(result.context.questionnaire).toHaveLength(1);
    });

    it('creates chat if it does not exist yet', async () => {
      mockPrismaService.relationship.findUnique.mockResolvedValue(
        mockRelationship,
      );
      mockPrismaService.chat.findUnique.mockResolvedValue(null);
      mockPrismaService.chat.create.mockResolvedValue(mockChat);

      const result = await service.getOrCreateChat('user-1', 'rel-1');
      expect(mockPrismaService.chat.create).toHaveBeenCalled();
      expect(result.id).toBe('chat-1');
    });

    it('throws NotFoundException if relationship does not exist', async () => {
      mockPrismaService.relationship.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrCreateChat('user-1', 'rel-invalid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if relationship belongs to another user', async () => {
      mockPrismaService.relationship.findUnique.mockResolvedValue(
        mockRelationship,
      );

      await expect(
        service.getOrCreateChat('user-other', 'rel-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('sendMessage with Groq AI integration', () => {
    it('saves user message, calls GroqService with context, saves and returns assistant message', async () => {
      mockPrismaService.relationship.findUnique.mockResolvedValue(
        mockRelationship,
      );
      mockPrismaService.chat.findUnique.mockResolvedValue(mockChat);
      mockPrismaService.message.create
        .mockResolvedValueOnce({
          id: 'user-msg-1',
          chatId: 'chat-1',
          role: 'USER',
          content: 'Rahul se baat karni hai',
          createdAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'assistant-msg-1',
          chatId: 'chat-1',
          role: 'ASSISTANT',
          content: 'Samajh raha hoon. Kya baat karni hai?',
          createdAt: new Date(),
        });

      mockPrismaService.message.findMany.mockResolvedValue([
        {
          id: 'user-msg-1',
          chatId: 'chat-1',
          role: 'USER',
          content: 'Rahul se baat karni hai',
          createdAt: new Date(),
        },
      ]);

      mockGroqService.generateResponse.mockResolvedValue(
        'Samajh raha hoon. Kya baat karni hai?',
      );

      const response = await service.sendMessage('user-1', 'rel-1', {
        content: 'Rahul se baat karni hai',
      });

      expect(response.role).toBe('ASSISTANT');
      expect(response.content).toBe('Samajh raha hoon. Kya baat karni hai?');
      expect(mockGroqService.generateResponse).toHaveBeenCalledWith({
        systemPrompt: 'System prompt text',
        history: [{ role: 'user', content: 'Rahul se baat karni hai' }],
      });
      expect(mockPrismaService.message.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteChat', () => {
    it('deletes chat if exists', async () => {
      mockPrismaService.relationship.findUnique.mockResolvedValue(
        mockRelationship,
      );
      mockPrismaService.chat.findUnique.mockResolvedValue(mockChat);

      await service.deleteChat('user-1', 'rel-1');
      expect(mockPrismaService.chat.delete).toHaveBeenCalledWith({
        where: { id: 'chat-1' },
      });
    });
  });
});
