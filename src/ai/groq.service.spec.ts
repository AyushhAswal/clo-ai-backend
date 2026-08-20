import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  InternalServerErrorException,
  BadGatewayException,
} from '@nestjs/common';
import { GroqService } from './groq.service';

describe('GroqService', () => {
  let service: GroqService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'GROQ_API_KEY') return 'gsk_fake_key_for_testing';
      if (key === 'GROQ_MODEL') return 'groq/compound-mini';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroqService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<GroqService>(GroqService);
    jest.clearAllMocks();
  });

  it('throws InternalServerErrorException if GROQ_API_KEY is missing', async () => {
    mockConfigService.get.mockReturnValue(null);

    await expect(
      service.generateResponse({
        systemPrompt: 'System',
        history: [{ role: 'user', content: 'Hi' }],
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('generates LLM response successfully when Groq client returns valid completion', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'GROQ_API_KEY') return 'gsk_valid';
      if (key === 'GROQ_MODEL') return 'groq/compound-mini';
      return null;
    });

    const mockCompletionsCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Hello! How can I help you with Rahul today?',
          },
        },
      ],
    });

    // Mock internal groqClient
    (service as unknown as { groqClient: unknown }).groqClient = {
      chat: {
        completions: {
          create: mockCompletionsCreate,
        },
      },
    };

    const reply = await service.generateResponse({
      systemPrompt: 'You are CLO AI',
      history: [{ role: 'user', content: 'Hello' }],
    });

    expect(reply).toBe('Hello! How can I help you with Rahul today?');
    expect(mockCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'groq/compound-mini',
        messages: [
          { role: 'system', content: 'You are CLO AI' },
          { role: 'user', content: 'Hello' },
        ],
      }),
    );
  });

  it('throws BadGatewayException if Groq SDK throws an error', async () => {
    mockConfigService.get.mockReturnValue('gsk_valid');

    (service as unknown as { groqClient: unknown }).groqClient = {
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('Rate limit exceeded')),
        },
      },
    };

    await expect(
      service.generateResponse({
        systemPrompt: 'System',
        history: [{ role: 'user', content: 'Hi' }],
      }),
    ).rejects.toThrow(BadGatewayException);
  });
});
