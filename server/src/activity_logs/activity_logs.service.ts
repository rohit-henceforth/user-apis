import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ActivityLog, ActivityPaginateModel } from './entities/activity_log.schema';
import ApiResponse from 'src/common/helpers/api-response';
import { GetActivityLogDto } from './dto/get-activity-logs.dto';
import mongoose from 'mongoose';

@Injectable()
export class ActivityLogsService {

  constructor(
    @InjectModel(ActivityLog.name) private activityModel: ActivityPaginateModel
  ) { }

  async logActivity(data: Partial<ActivityLog>): Promise<void> {

    try {

      await this.activityModel.create(data);

    } catch (error) {

      console.log(`[ActivityLogModule] : Error in logging the error to DB : ${error}`)

    }

  }

  async getAllLogs(getActivityLogDto: GetActivityLogDto): Promise<ApiResponse<any>> {

    const { limit = 10, page = 1, action, user } = getActivityLogDto;

    const filters: any = {};

    if (action) {
      filters.action = action;
    }

    if (user) {
      filters.userId = new mongoose.Types.ObjectId(user);
    }

    const allLogs = await this.activityModel.paginate(
      filters,
      {
        limit: Number(limit),
        page: Number(page),
        sort: {
          createdAt: -1
        }
      }
    );

    return new ApiResponse(
      true,
      "Activity logs fetched successfully!",
      HttpStatus.OK,
      allLogs
    )

  }

}
