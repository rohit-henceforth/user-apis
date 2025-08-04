import { Module } from '@nestjs/common';
import { ErrorModuleService } from './error_module.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ErrorLog, ErrorLogSchema } from './entities/error_module.schema';
import { ErrorModuleController } from './error_module.controller';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { User } from 'src/users/entities/user.entity';
import { UserSchema } from 'src/users/entities/user.schema';

@Module({
  imports : [
    JwtModule,
    MongooseModule.forFeature([{ name: ErrorLog.name, schema: ErrorLogSchema }]),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])
  ],
  controllers : [ErrorModuleController],
  providers: [ErrorModuleService],
  exports : [ErrorModuleService]
})
export class ErrorModuleModule {}
