import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { PendingUser, PendingUserSchema, UserSchema } from './entities/user.schema';
import { MailModule } from 'src/mail/mail.module';
import { TokenModule } from 'src/token/token.module';
import { SmsModule } from 'src/sms/sms.module';
import { JwtModule } from '@nestjs/jwt';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { ActivityLogsModule } from 'src/activity_logs/activity_logs.module';
import { OtpModule } from 'src/otp/otp.module';

@Module({
  imports : [
    MailModule,
    SmsModule,
    TokenModule,
    JwtModule,
    CloudinaryModule,
    ActivityLogsModule,
    OtpModule,
    MongooseModule.forFeature([
      {
        name : User.name,
        schema : UserSchema
      },
      {
        name : PendingUser.name,
        schema : PendingUserSchema
      }
    ])
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
