import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { CreateGroupDto } from "./dto/create-group.dto";
import { Roles } from "src/common/decorators/role.decorator";
import { AuthGuard } from "src/common/guards/auth.guard";
import { ChatService } from "./chat.service";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from "@nestjs/swagger";
import { RolesGuard } from "src/common/guards/role.guard";
import { addParticipantsDto } from "./dto/add-participants.dto";
import { MakeAdminDto } from "./dto/make-admin.dto";
import { RemoveParticipantDto } from "./dto/remove-participants.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";
import { extname } from "path";
import { diskStorage } from "multer";
import { FileInterceptor } from "@nestjs/platform-express";

@Controller("chat")
export class ChatController {

    constructor(
        private chatService: ChatService
    ) { }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Post("create-group")
    createGroup(@Body() createGroupDto: CreateGroupDto, @Req() request) {
        return this.chatService.createGroup(createGroupDto, request);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Get("group-details/:groupId")
    getGroupDetails(@Param('groupId') groupId: string, @Req() request) {
        return this.chatService.getGroupDetails(groupId, request);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Delete("delete-group/:groupId")
    deleteGroup(@Param('groupId') groupId: string, @Req() request) {
        return this.chatService.deleteGroup(groupId, request);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Put("update-group-name")
    updateGroupName(@Body() updateGroupDto: UpdateGroupDto, @Req() request) {
        return this.chatService.changeGroupName(updateGroupDto, request);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Get("get-chats")
    getUserChats(@Req() request) {
        return this.chatService.getUserChats(request);
    }


    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Get("get-messages/:chatId")
    getMessages(@Param('chatId') chatId: string, @Req() request) {
        return this.chatService.getMessages(chatId, request);
    }

    @Post('upload')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: './uploads',
                filename: (_, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    const ext = extname(file.originalname);
                    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
                },
            }),
        }),
    )
    @ApiOperation({ summary: 'Upload a file' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    uploadFile(@UploadedFile() file: Express.Multer.File) {
        return {
            url: `http://localhost:3000/uploads/${file.filename}`,
            type: file.mimetype,
            filename: file.originalname,
        };
    }

}