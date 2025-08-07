import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { TokenModule } from 'src/token/token.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, messageSchema } from './entities/message.schema';
import { Chat, chatSchema } from './entities/chat.schema';
import { User, UserSchema } from 'src/users/entities/user.schema';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [
        TokenModule,
        JwtModule,
        MongooseModule.forFeature([
            {
                name : Message.name,
                schema : messageSchema
            },
            {
                name : Chat.name,
                schema : chatSchema
            },
            {
                name : User.name,
                schema : UserSchema
            }
        ])
    ],
    controllers : [ChatController],
    providers: [ChatGateway,ChatService],
})
export class ChatModule { }
