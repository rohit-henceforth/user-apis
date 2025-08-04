import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { TokenModule } from 'src/token/token.module';

@Module({
    imports: [
        TokenModule
    ],
    providers: [ChatGateway],
})
export class ChatModule { }
