import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityLogsService } from './activity_logs.service';
import { GetActivityLogDto } from './dto/get-activity-logs.dto';
import { Roles } from 'src/common/decorators/role.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/role.guard';
import { Role } from 'src/common/enums/role.enum';

@Controller('activity-logs')
@Roles(Role.Admin, Role.SuperAdmin)
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class ActivityLogsController {
  
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  getActivityLogs(@Query() GetActivityLogDto : GetActivityLogDto){
    return this.activityLogsService.getAllLogs(GetActivityLogDto);
  }
  
}
