import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { UpdateRelationshipDto } from './dto/update-relationship.dto';
import { RelationshipsService } from './relationships.service';

@Controller('relationships')
@UseGuards(JwtAuthGuard)
export class RelationshipsController {
  constructor(private readonly relationshipsService: RelationshipsService) {}

  @Get('questions')
  getQuestions(@Query('relationshipType') relationshipType?: string) {
    return this.relationshipsService.getQuestions(relationshipType);
  }

  @Post()
  create(
    @GetUser('id') userId: string,
    @Body() createRelationshipDto: CreateRelationshipDto,
  ) {
    return this.relationshipsService.create(userId, createRelationshipDto);
  }

  @Get()
  findAll(@GetUser('id') userId: string, @Query('category') category?: string) {
    return this.relationshipsService.findAll(userId, category);
  }

  @Get(':id')
  findOne(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.relationshipsService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Body() updateRelationshipDto: UpdateRelationshipDto,
  ) {
    return this.relationshipsService.update(userId, id, updateRelationshipDto);
  }

  @Delete(':id')
  remove(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.relationshipsService.remove(userId, id);
  }
}
