import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorLog, ErrorLogDocument, ErrorPaginateModel } from './entities/error_module.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import ApiResponse from 'src/common/helpers/api-response';
import { GetErrorLogDto } from './dto/get-error-logs.dto';

@Injectable()
export class ErrorModuleService {

  constructor(
    @InjectModel(ErrorLog.name) private errorModel: ErrorPaginateModel
  ) { }

  async logError(data: Partial<ErrorLog>): Promise<void> {

    try {

      await this.errorModel.create(data);

    } catch (error) {

      console.log(`[ErrorLogModule] : Error in logging the error to DB : ${error}`)

    }

  }

  async getAllLogs(getErrorLogDto: GetErrorLogDto): Promise<ApiResponse<any>> {

    const { limit = 10, page = 1, path, method, user} = getErrorLogDto;

    const filters : any = {} ;

    if(method){
      filters.method = method?.toUpperCase() ;
    }

    if(user){
      filters.userId = user ;
    }

    if(path){
      filters.path = path ;
    }

    const allLogs = await this.errorModel.paginate(
      filters,
      {
        limit : Number(limit),
        page : Number(page),
        sort : {
          createdAt : -1
        }
      }
    );

    return new ApiResponse(
      true,
      "Error logs fetched successfully!",
      HttpStatus.OK,
      allLogs
    )

  }

}
