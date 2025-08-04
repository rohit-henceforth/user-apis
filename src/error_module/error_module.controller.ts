import { Controller, Get, Injectable, Query, UseGuards } from "@nestjs/common";
import { ErrorModuleService } from "./error_module.service";
import { AuthGuard } from "src/common/guards/auth.guard";
import { RolesGuard } from "src/common/guards/role.guard";
import { Roles } from "src/common/decorators/role.decorator";
import { Role } from "src/common/enums/role.enum";
import { ApiBearerAuth } from "@nestjs/swagger";
import { GetErrorLogDto } from "./dto/get-error-logs.dto";

@Controller("error-logs")
@Roles(Role.Admin, Role.SuperAdmin)
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class ErrorModuleController {

    constructor(
        private errorLogService: ErrorModuleService
    ) { }

    @Get()
    getAllLogs(
        @Query() GetErrorLogDto : GetErrorLogDto
    ) {
        return this.errorLogService.getAllLogs(GetErrorLogDto);
    }

}