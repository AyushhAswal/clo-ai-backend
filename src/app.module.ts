import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RelationshipsModule } from './relationships/relationships.module';
import { ChatModule } from './chat/chat.module';
import { PersonalChatModule } from './personal-chat/personal-chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    RelationshipsModule,
    ChatModule,
    PersonalChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
