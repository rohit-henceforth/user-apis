import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { TokenService } from './token/token.service';
import { SmsService } from './sms/sms.service';
import ConfigureDB from './db/db';
import { JwtModule } from '@nestjs/jwt';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CloudinaryService } from './cloudinary/cloudinary.service';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { AdminModule } from './admin/admin.module';
import { ErrorModuleModule } from './error_module/error_module.module';
import { ActivityLogsModule } from './activity_logs/activity_logs.module';
import { ChatGateway } from './chat/chat.gateway';
import { ChatModule } from './chat/chat.module';
import { OtpModule } from './otp/otp.module';
@Module({
  imports: [
    UsersModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    JwtModule,
    ConfigureDB(),
    CloudinaryModule,
    AdminModule,
    ErrorModuleModule,
    ActivityLogsModule,
    ChatModule,
    OtpModule
  ],
  controllers: [],
  providers: [TokenService, SmsService, CloudinaryService]
})
export class AppModule {}