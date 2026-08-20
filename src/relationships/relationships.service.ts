import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { UpdateRelationshipDto } from './dto/update-relationship.dto';

@Injectable()
export class RelationshipsService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuestions(relationshipType?: string) {
    return this.prisma.relationshipQuestion.findMany({
      where: relationshipType
        ? {
            relationshipType: {
              contains: relationshipType,
              mode: 'insensitive',
            },
          }
        : undefined,
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async create(userId: string, dto: CreateRelationshipDto) {
    return this.prisma.$transaction(async (tx) => {
      const relationship = await tx.relationship.create({
        data: {
          userId,
          name: dto.name,
          relationshipType: dto.relationshipType,
          category: dto.category,
          photoUrl: dto.photoUrl,
          answers: {
            create: dto.answers.map((answer) => ({
              questionId: answer.questionId,
              questionText: answer.questionText,
              answer: answer.answer,
            })),
          },
        },
        include: {
          answers: true,
        },
      });

      return relationship;
    });
  }

  async findAll(userId: string, category?: string) {
    return this.prisma.relationship.findMany({
      where: {
        userId,
        ...(category
          ? {
              category: {
                equals: category,
                mode: 'insensitive',
              },
            }
          : {}),
      },
      include: {
        answers: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(userId: string, id: string) {
    const relationship = await this.prisma.relationship.findUnique({
      where: { id },
      include: {
        answers: true,
      },
    });

    if (!relationship) {
      throw new NotFoundException(`Relationship with ID ${id} not found`);
    }

    if (relationship.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this relationship',
      );
    }

    return relationship;
  }

  async update(userId: string, id: string, dto: UpdateRelationshipDto) {
    // Ownership check
    await this.findOne(userId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.relationship.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.relationshipType
            ? { relationshipType: dto.relationshipType }
            : {}),
          ...(dto.category ? { category: dto.category } : {}),
          ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
        },
      });

      if (dto.answers && dto.answers.length > 0) {
        for (const answerDto of dto.answers) {
          await tx.relationshipAnswer.upsert({
            where: {
              relationshipId_questionId: {
                relationshipId: id,
                questionId: answerDto.questionId,
              },
            },
            update: {
              questionText: answerDto.questionText,
              answer: answerDto.answer,
            },
            create: {
              relationshipId: id,
              questionId: answerDto.questionId,
              questionText: answerDto.questionText,
              answer: answerDto.answer,
            },
          });
        }
      }

      return tx.relationship.findUnique({
        where: { id },
        include: {
          answers: true,
        },
      });
    });
  }

  async remove(userId: string, id: string) {
    // Ownership check
    await this.findOne(userId, id);

    await this.prisma.relationship.delete({
      where: { id },
    });

    return { message: 'Relationship deleted successfully' };
  }
}
