import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PersonalChatService } from './personal-chat.service';
import { CreateMessageDto } from '../chat/dto/create-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('personal-chats')
@UseGuards(JwtAuthGuard)
export class PersonalChatController {
  constructor(private readonly personalChatService: PersonalChatService) {}

  @Get()
  getOrCreatePersonalChat(@GetUser('id') userId: string) {
    return this.personalChatService.getOrCreatePersonalChat(userId);
  }

  @Get('messages')
  getMessages(@GetUser('id') userId: string) {
    return this.personalChatService.getMessages(userId);
  }

  @Post('messages')
  @HttpCode(HttpStatus.OK)
  sendMessage(@GetUser('id') userId: string, @Body() dto: CreateMessageDto) {
    return this.personalChatService.sendMessage(userId, dto);
  }

  @Delete()
  deletePersonalChat(@GetUser('id') userId: string) {
    return this.personalChatService.deletePersonalChat(userId);
  }
}
