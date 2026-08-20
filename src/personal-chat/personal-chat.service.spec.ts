import { Test, TestingModule } from '@nestjs/testing';
import { PersonalChatService } from './personal-chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { GroqService } from '../ai/groq.service';

describe('PersonalChatService', () => {
  let service: PersonalChatService;
  let prisma: PrismaService;
  let groqService: GroqService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    personalChat: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    personalChatMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockGroqService = {
    generateResponse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalChatService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: GroqService, useValue: mockGroqService },
      ],
    }).compile();

    service = module.get<PersonalChatService>(PersonalChatService);
    prisma = module.get<PrismaService>(PrismaService);
    groqService = module.get<GroqService>(GroqService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreatePersonalChat', () => {
    it('should return existing personal chat if it exists', async () => {
      const existingChat = {
        id: 'pchat-1',
        userId: 'user-1',
        messages: [],
      };
      mockPrismaService.personalChat.findUnique.mockResolvedValue(existingChat);

      const result = await service.getOrCreatePersonalChat('user-1');
      expect(result).toEqual(existingChat);
      expect(mockPrismaService.personalChat.create).not.toHaveBeenCalled();
    });

    it('should create new personal chat if it does not exist', async () => {
      const newChat = {
        id: 'pchat-1',
        userId: 'user-1',
        messages: [],
      };
      mockPrismaService.personalChat.findUnique.mockResolvedValue(null);
      mockPrismaService.personalChat.create.mockResolvedValue(newChat);

      const result = await service.getOrCreatePersonalChat('user-1');
      expect(result).toEqual(newChat);
      expect(mockPrismaService.personalChat.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    });
  });

  describe('sendMessage', () => {
    it('should save user message, query Groq AI, save assistant message and return it', async () => {
      const user = { id: 'user-1', name: 'Ayush' };
      const personalChat = { id: 'pchat-1', userId: 'user-1' };
      const assistantMsg = {
        id: 'msg-2',
        personalChatId: 'pchat-1',
        role: 'ASSISTANT',
        content: 'Hello Ayush!',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.personalChat.findUnique.mockResolvedValue(personalChat);
      mockPrismaService.personalChatMessage.create
        .mockResolvedValueOnce({ id: 'msg-1', role: 'USER', content: 'Hi' })
        .mockResolvedValueOnce(assistantMsg);
      mockPrismaService.personalChatMessage.findMany.mockResolvedValue([
        { role: 'USER', content: 'Hi' },
      ]);
      mockGroqService.generateResponse.mockResolvedValue('Hello Ayush!');

      const result = await service.sendMessage('user-1', { content: 'Hi' });
      expect(result).toEqual(assistantMsg);
      expect(mockGroqService.generateResponse).toHaveBeenCalled();
    });
  });
});
