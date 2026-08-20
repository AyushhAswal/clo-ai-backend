import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { UpdateRelationshipDto } from './dto/update-relationship.dto';
import { RelationshipsService } from './relationships.service';

describe('RelationshipsService', () => {
  let service: RelationshipsService;

  const mockUserId = 'user-111';
  const otherUserId = 'user-222';
  const mockRelationshipId = 'rel-123';

  const mockRelationship = {
    id: mockRelationshipId,
    userId: mockUserId,
    name: 'Rahul',
    relationshipType: 'Friendship',
    category: 'Friends',
    photoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    answers: [
      {
        id: 'ans-1',
        relationshipId: mockRelationshipId,
        questionId: 'q-1',
        questionText: "Where's your friendship at?",
        answer: 'Close and solid',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const mockQuestions = [
    {
      id: 'q-1',
      questionText: "Where's your friendship at?",
      relationshipType: 'Friendship',
    },
  ];

  const mockQuestionsFindMany = jest.fn().mockResolvedValue(mockQuestions);
  const mockRelationshipCreate = jest.fn().mockResolvedValue(mockRelationship);
  const mockRelationshipFindMany = jest
    .fn()
    .mockResolvedValue([mockRelationship]);
  const mockRelationshipFindUnique = jest
    .fn()
    .mockResolvedValue(mockRelationship);
  const mockRelationshipUpdate = jest.fn().mockResolvedValue(mockRelationship);
  const mockRelationshipDelete = jest.fn().mockResolvedValue(mockRelationship);
  const mockAnswerUpsert = jest.fn().mockResolvedValue({
    id: 'ans-1',
    relationshipId: mockRelationshipId,
    questionId: 'q-1',
    questionText: "Where's your friendship at?",
    answer: 'Even closer',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockPrismaClient = {
    relationshipQuestion: {
      findMany: mockQuestionsFindMany,
    },
    relationship: {
      create: mockRelationshipCreate,
      findMany: mockRelationshipFindMany,
      findUnique: mockRelationshipFindUnique,
      update: mockRelationshipUpdate,
      delete: mockRelationshipDelete,
    },
    relationshipAnswer: {
      upsert: mockAnswerUpsert,
    },
    $transaction: jest
      .fn()
      .mockImplementation((cb: (tx: unknown) => unknown) =>
        cb(mockPrismaClient),
      ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationshipsService,
        {
          provide: PrismaService,
          useValue: mockPrismaClient,
        },
      ],
    }).compile();

    service = module.get<RelationshipsService>(RelationshipsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getQuestions', () => {
    it('should return question templates', async () => {
      const result = await service.getQuestions('Friendship');
      expect(mockQuestionsFindMany).toHaveBeenCalled();
      expect(result).toEqual(mockQuestions);
    });
  });

  describe('create', () => {
    it('should create relationship and answers inside a transaction', async () => {
      const createDto: CreateRelationshipDto = {
        name: 'Rahul',
        relationshipType: 'Friendship',
        category: 'Friends',
        photoUrl: undefined,
        answers: [
          {
            questionId: 'q-1',
            questionText: "Where's your friendship at?",
            answer: 'Close and solid',
          },
        ],
      };

      mockRelationshipCreate.mockResolvedValue(mockRelationship);

      const result = await service.create(mockUserId, createDto);

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      expect(mockRelationshipCreate).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          name: createDto.name,
          relationshipType: createDto.relationshipType,
          category: createDto.category,
          photoUrl: undefined,
          answers: {
            create: [
              {
                questionId: 'q-1',
                questionText: "Where's your friendship at?",
                answer: 'Close and solid',
              },
            ],
          },
        },
        include: {
          answers: true,
        },
      });
      expect(result).toEqual(mockRelationship);
    });
  });

  describe('findAll', () => {
    it('should return relationships for the authenticated user', async () => {
      const result = await service.findAll(mockUserId, 'Friends');
      expect(mockRelationshipFindMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          category: {
            equals: 'Friends',
            mode: 'insensitive',
          },
        },
        include: {
          answers: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toEqual([mockRelationship]);
    });
  });

  describe('findOne', () => {
    it('should return relationship if owned by authenticated user', async () => {
      mockRelationshipFindUnique.mockResolvedValue(mockRelationship);

      const result = await service.findOne(mockUserId, mockRelationshipId);
      expect(result).toEqual(mockRelationship);
    });

    it('should throw NotFoundException if relationship does not exist', async () => {
      mockRelationshipFindUnique.mockResolvedValue(null);

      await expect(
        service.findOne(mockUserId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if relationship belongs to another user', async () => {
      mockRelationshipFindUnique.mockResolvedValue(mockRelationship);

      await expect(
        service.findOne(otherUserId, mockRelationshipId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update relationship and upsert answers inside a transaction if authorized', async () => {
      mockRelationshipFindUnique.mockResolvedValue(mockRelationship);
      mockRelationshipUpdate.mockResolvedValue(mockRelationship);

      const updateDto: UpdateRelationshipDto = {
        name: 'Rahul Updated',
        answers: [
          {
            questionId: 'q-1',
            questionText: "Where's your friendship at?",
            answer: 'Even closer',
          },
        ],
      };

      const result = await service.update(
        mockUserId,
        mockRelationshipId,
        updateDto,
      );

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      expect(mockAnswerUpsert).toHaveBeenCalledWith({
        where: {
          relationshipId_questionId: {
            relationshipId: mockRelationshipId,
            questionId: 'q-1',
          },
        },
        update: {
          questionText: "Where's your friendship at?",
          answer: 'Even closer',
        },
        create: {
          relationshipId: mockRelationshipId,
          questionId: 'q-1',
          questionText: "Where's your friendship at?",
          answer: 'Even closer',
        },
      });
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException if updating another user relationship', async () => {
      mockRelationshipFindUnique.mockResolvedValue(mockRelationship);

      await expect(
        service.update(otherUserId, mockRelationshipId, { name: 'Hack' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete relationship if owned by authenticated user', async () => {
      mockRelationshipFindUnique.mockResolvedValue(mockRelationship);
      mockRelationshipDelete.mockResolvedValue(mockRelationship);

      const result = await service.remove(mockUserId, mockRelationshipId);
      expect(mockRelationshipDelete).toHaveBeenCalledWith({
        where: { id: mockRelationshipId },
      });
      expect(result).toEqual({ message: 'Relationship deleted successfully' });
    });

    it('should throw ForbiddenException if deleting another user relationship', async () => {
      mockRelationshipFindUnique.mockResolvedValue(mockRelationship);

      await expect(
        service.remove(otherUserId, mockRelationshipId),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
