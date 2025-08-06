import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { CreateGroupDto } from "./dto/create-group.dto";
import { Roles } from "src/common/decorators/role.decorator";
import { AuthGuard } from "src/common/guards/auth.guard";
import { ChatService } from "./chat.service";
import { ApiBearerAuth } from "@nestjs/swagger";
import { RolesGuard } from "src/common/guards/role.guard";
import { addParticipantsDto } from "./dto/add-participants.dto";
import { MakeAdminDto } from "./dto/make-admin.dto";
import { RemoveParticipantDto } from "./dto/remove-participants.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";

@Controller("chat")
export class ChatController{

    constructor (
        private chatService : ChatService
    ) {}

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Post("create-group")
    createGroup(@Body() createGroupDto : CreateGroupDto,@Req() request) {
        return this.chatService.createGroup(createGroupDto,request);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Post("add-participants")
    addNewParticipants(@Body() addParticipantsDto : addParticipantsDto,@Req() request) {
        return this.chatService.addParticipantsToGroup(addParticipantsDto,request);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Get("group-details/:groupId")
    getGroupDetails(@Param('groupId') groupId : string,@Req() request) {
        return this.chatService.getGroupDetails(groupId,request);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Patch("make-admin")
    makeAnAdmin(@Body() makeAdminDto : MakeAdminDto,@Req() request) {
        return this.chatService.makeAnAdmin(makeAdminDto,request);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Delete("remove-admin")
    removeAdmin(@Body() removeAdminDto : MakeAdminDto,@Req() request) {
        return this.chatService.removeAnAdmin(removeAdminDto,request);
    }


    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Delete("remove-participant")
    removeParticipant(@Body() removeParticipantDto : RemoveParticipantDto,@Req() request) {
        return this.chatService.removeAParticipant(removeParticipantDto,request);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Delete("delete-group/:groupId")
    deleteGroup(@Param('groupId') groupId : string,@Req() request) {
        return this.chatService.deleteGroup(groupId,request);
    }

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Put("update-group-name")
    updateGroupName(@Body() updateGroupDto : UpdateGroupDto,@Req() request) {
        return this.chatService.changeGroupName(updateGroupDto,request);
    }

}