import { Module } from '@nestjs/common';
import { ActivityLogsService } from './activity_logs.service';
import { ActivityLogsController } from './activity_logs.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityLogSchema } from './entities/activity_log.schema';
import { ActivityLog } from './entities/activity_log.entity';
import { JwtModule } from '@nestjs/jwt';
import { User } from 'src/users/entities/user.entity';
import { UserSchema } from 'src/users/entities/user.schema';

@Module({
  imports: [
    JwtModule,
    MongooseModule.forFeature([{ name: ActivityLog.name, schema: ActivityLogSchema }]),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])
  ],
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService],
  exports: [ActivityLogsService]
})
export class ActivityLogsModule { }
