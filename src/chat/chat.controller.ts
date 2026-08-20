import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':relationshipId')
  getOrCreateChat(
    @GetUser('id') userId: string,
    @Param('relationshipId') relationshipId: string,
  ) {
    return this.chatService.getOrCreateChat(userId, relationshipId);
  }

  @Get(':relationshipId/messages')
  getMessages(
    @GetUser('id') userId: string,
    @Param('relationshipId') relationshipId: string,
  ) {
    return this.chatService.getMessages(userId, relationshipId);
  }

  @Post(':relationshipId/messages')
  sendMessage(
    @GetUser('id') userId: string,
    @Param('relationshipId') relationshipId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.chatService.sendMessage(userId, relationshipId, dto);
  }

  @Delete(':relationshipId')
  deleteChat(
    @GetUser('id') userId: string,
    @Param('relationshipId') relationshipId: string,
  ) {
    return this.chatService.deleteChat(userId, relationshipId);
  }
}
