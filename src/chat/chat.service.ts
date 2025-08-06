import { BadRequestException, HttpStatus, Injectable, Req, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Chat, ChatDocument } from "./entities/chat.schema";
import mongoose, { Model, Types } from "mongoose";
import { Message, MessageDocument } from "./entities/message.schema";
import { User, UserDocument } from "src/users/entities/user.schema";
import { CreateGroupDto } from "./dto/create-group.dto";
import ApiResponse from "src/common/helpers/api-response";
import { addParticipantsDto } from "./dto/add-participants.dto";
import { MakeAdminDto } from "./dto/make-admin.dto";
import { RemoveParticipantDto } from "./dto/remove-participants.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";

@Injectable()
export class ChatService {

    constructor(
        @InjectModel(Chat.name) private readonly chatModel: Model<ChatDocument>,
        @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>
    ) { }

    private async isGroupAdmin(groupId: string, user: string) {

        const group = await this.chatModel.findById(groupId);

        return group?.admins?.includes(new Types.ObjectId(user));

    }

    private async isGroupParticipant(groupId: string, user: string) {

        const group = await this.chatModel.findById(groupId);

        return group?.participants?.includes(new Types.ObjectId(user));

    }

    async createGroup(createGroupData: CreateGroupDto, @Req() request: any): Promise<ApiResponse<any>> {

        const admin = request.user._id;

        let { name, participants = [] } = createGroupData;

        if (!admin || !name) {
            throw new BadRequestException('Admin and group name is required!');
        }

        participants = Array.isArray(participants) ? [admin, ...participants] : [admin];

        const newGroup = await this.chatModel.create({
            name,
            admins: [admin],
            participants,
            isGroup: true
        })

        return new ApiResponse(
            true,
            `${name} group has been created successfully.`,
            HttpStatus.OK,
            newGroup
        )

    }

    async addParticipantsToGroup(addParticipantsData: addParticipantsDto, @Req() request: any): Promise<ApiResponse<any>> {


        let { groupId, participants = [] } = addParticipantsData;

        if (!groupId) {
            throw new BadRequestException('Group id is required!');
        }

        const isUserAdmin = await this.isGroupAdmin(groupId, request.user._id);

        if (!isUserAdmin) {
            throw new UnauthorizedException("User is not an admin!");
        }

        const group: any = await this.chatModel.findById(groupId);

        const duplicateParticipants: Types.ObjectId[] = [], newParticipants: Types.ObjectId[] = [];

        participants = Array.isArray(participants) ? participants : [];

        for (const participant of participants) {
            let participantObjectId = new Types.ObjectId(participant);
            if (group.participants.includes(participantObjectId)) {
                duplicateParticipants.push(participantObjectId);
            } else {
                group.participants.push(participantObjectId);
                newParticipants.push(participantObjectId);
            }
        }

        const rejectedParticipantsDetails = await this.userModel.aggregate([
            {
                $match: {
                    _id: {
                        $in: duplicateParticipants
                    }
                }
            },
            {
                $project: {
                    name: 1,
                    email: 1,
                    contactNumber: 1,
                    isEmailVerified: 1,
                    isContactNumberVerified: 1,
                    _id: 1
                }
            }
        ])

        const addedParticipantsDetails = await this.userModel.aggregate([
            {
                $match: {
                    _id: {
                        $in: newParticipants
                    }
                }
            },
            {
                $project: {
                    name: 1,
                    email: 1,
                    contactNumber: 1,
                    isEmailVerified: 1,
                    isContactNumberVerified: 1,
                    _id: 1
                }
            }
        ])

        if (newParticipants.length > 0) {
            await group.save();
        }

        return new ApiResponse(
            true,
            `New participants have been added to ${group?.name || ""} group.`,
            HttpStatus.OK,
            {
                rejectedParticipantsDetails,
                addedParticipantsDetails
            }
        )

    }

    async makeAnAdmin(makeAdminDto: MakeAdminDto, @Req() request): Promise<ApiResponse<any>> {

        const userId = request.user._id;

        const isRequestingUserAdmin = await this.isGroupAdmin(makeAdminDto.groupId, userId);

        if (!isRequestingUserAdmin) {
            throw new UnauthorizedException("You are not an admin of group.")
        }

        const group: any = await this.chatModel.findById(makeAdminDto.groupId);

        const isUserAParticipant = await this.isGroupParticipant(makeAdminDto.groupId, makeAdminDto.adminId);

        if (!isUserAParticipant) {
            throw new BadRequestException("User is not a participant of group.");
        }

        group.admins.push(new Types.ObjectId(makeAdminDto.adminId));

        group.save();

        return new ApiResponse(
            true,
            "Admin created successfully.",
            HttpStatus.CREATED
        )

    }

    async removeAnAdmin(removeAdminDto: MakeAdminDto, @Req() request): Promise<ApiResponse<any>> {

        const userId = request.user._id;

        const isRequestingUserAdmin = await this.isGroupAdmin(removeAdminDto.groupId, userId);

        if (!isRequestingUserAdmin) {
            throw new UnauthorizedException("You are not an admin of group.");
        }

        const isUserAnAdmin = await this.isGroupParticipant(removeAdminDto.groupId, removeAdminDto.adminId);

        if (!isUserAnAdmin) {
            throw new BadRequestException("User is not an admin of group.");
        }

        const group: any = await this.chatModel.findById(removeAdminDto.groupId);

        group.admins = group.admins.filter(admin => admin.toString() !== removeAdminDto.adminId.toString());

        group.save();

        return new ApiResponse(
            true,
            "Admin removed successfully.",
            HttpStatus.CREATED
        )

    }

    async removeAParticipant(removeParticipantDto: RemoveParticipantDto, @Req() request): Promise<ApiResponse<any>> {

        const userId = request.user._id;

        const isRequestingUserAdmin = await this.isGroupAdmin(removeParticipantDto.groupId, userId);

        if (!isRequestingUserAdmin) {
            throw new UnauthorizedException("You are not an admin of group.");
        }

        const isUserAParticipant = await this.isGroupParticipant(removeParticipantDto.groupId, removeParticipantDto.userId);

        if (!isUserAParticipant) {
            throw new BadRequestException("User is not a participant of group.");
        }

        const group: any = await this.chatModel.findById(removeParticipantDto.groupId);

        group.participants = group.participants.filter(admin => admin.toString() !== removeParticipantDto.userId.toString());

        group.save();

        return new ApiResponse(
            true,
            "Participant removed successfully.",
            HttpStatus.CREATED
        )

    }

    async deleteGroup(groupId: string, @Req() request): Promise<ApiResponse<any>> {

        const userId = request.user._id;

        const isRequestingUserAdmin = await this.isGroupAdmin(groupId, userId);

        if (!isRequestingUserAdmin) {
            throw new UnauthorizedException("You are not an admin of group.");
        }

        const group: any = await this.chatModel.findByIdAndDelete(groupId);

        if (!group) {
            throw new BadRequestException("Group not found!");
        }

        return new ApiResponse(
            true,
            "Participant removed successfully.",
            HttpStatus.CREATED
        )

    }

    async getGroupDetails(groupId: string, @Req() request): Promise<ApiResponse<any>> {

        const userId = request.user._id;

        const isUserParticipant = await this.isGroupParticipant(groupId, userId);

        if (!isUserParticipant) {
            throw new BadRequestException("User is not a participant of group.");
        }

        const groupDetails = await this.chatModel.aggregate([
            {
                $match: {
                    _id: new Types.ObjectId(groupId)
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "participants",
                    foreignField: "_id",
                    as: "participants",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                email: 1,
                                contactNumber: 1,
                                isContactNumberVerified: 1,
                                isEmailVerified: 1
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "admins",
                    foreignField: "_id",
                    as: "admins",
                    pipeline: [
                        {
                            $project: {
                                _id: -1,
                                name: -1,
                                email: -1,
                                contactNumber: -1,
                                isContactNumberVerified: -1,
                                isEmailVerified: -1
                            }
                        }
                    ]
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    participants: 1,
                    admins: 1
                }
            }
        ]);

        return new ApiResponse(
            true,
            "Group details fetched successfully.",
            HttpStatus.OK,
            groupDetails
        )

    }

    async changeGroupName(updateGroupDto: UpdateGroupDto, @Req() request): Promise<ApiResponse<any>> {

        const admin = request.user._id;

        const isRequestingUserAdmin = await this.isGroupAdmin(updateGroupDto.groupId, admin);

        if (!isRequestingUserAdmin) {
            throw new BadRequestException('You are not an admin of group!');
        }

        await this.chatModel.findByIdAndUpdate(
            updateGroupDto.groupId,
            {
                $set: {
                    nme: updateGroupDto.name
                }
            }
        )

        return new ApiResponse(
            true,
            `${name} group's name has been updated successfully.`,
            HttpStatus.OK
        )

    }

    async createNewDirectMessage(senderId: string, recieverId: string, content: string, onlineUser: any) {

        const participants = [new Types.ObjectId(senderId), new Types.ObjectId(recieverId)];

        let chat = await this.chatModel.findOne({
            isGroup: false,
            participants: {
                $all: participants,
                $size: 2
            }
        });

        if (!chat) {
            chat = await this.chatModel.create({
                participants
            })
        }

        const messageDeliveredTo = [participants[0]];
        const isMessageDeliveredToRecepient = onlineUser.has(recieverId);

        if (isMessageDeliveredToRecepient) {
            messageDeliveredTo.push(participants[1]);
        }

        const newMessage = await this.messageModel.create({
            chatId: chat?._id,
            senderId: participants[0],
            seenBy: [participants[0]],
            deliveredTo: messageDeliveredTo,
            content
        });

        const newMessageDetails = await this.messageModel.aggregate([
            {
                $match: {
                    _id: newMessage._id
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "senderId",
                    foreignField: "_id",
                    as: "sender",
                    pipeline: [
                        {
                            $project: {
                                name: 1,
                                profilePic: 1,
                                email: 1,
                                contactNumber: 1,
                                _id: 1
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: "chats",
                    localField: "chatId",
                    foreignField: "_id",
                    as: "chat",
                    pipeline: [
                        {
                            $project: {
                                isGroup : 1
                            }
                        }
                    ]
                }
            },
            {
                $unwind : "$chat"
            },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    contentType: 1,
                    chat: 1,
                    sender: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        ])

        chat.lastMessage = newMessage?._id;

        await chat.save();

        return newMessageDetails[0];

    }

    async getUsersPendingMessages(userId: string) {

        const objectUserId = new Types.ObjectId(userId);

        const pendingMessages = await this.messageModel.aggregate([
            {
                $match: {
                    deliveredTo: { $ne: objectUserId }
                }
            },
            {
                $lookup: {
                    from: 'chats',
                    localField: 'chatId',
                    foreignField: '_id',
                    as: 'chat',
                    pipeline: [
                        {
                            $project: {
                                name: 1,
                                _id: 1,
                                participants: 1,
                                isGroup : 1
                            }
                        }
                    ]
                }
            },
            {
                $unwind: '$chat'
            },
            {
                $match: {
                    'chat.participants': objectUserId
                }
            },
            {
                $sort: { createdAt: 1 }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'senderId',
                    foreignField: '_id',
                    as: 'sender',
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                email: 1,
                                contactNumber: 1,
                                profilePic: 1
                            }
                        }
                    ]
                }
            },
            {
                $unwind : "$sender"
            },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    contentType: 1,
                    chat: {
                        name : 1,
                        _id : 1,
                        isGroup : 1
                    },
                    createdAt: 1,
                    updatedAt: 1,
                    sender: 1,
                    deliveredTo : 1
                }
            }
        ]);

        return pendingMessages;

    }

    async markMessageDelivered(messageId, userId) {

        await this.messageModel.findByIdAndUpdate(
            messageId,
            {
                $addToSet: {
                    deliveredTo: new Types.ObjectId(userId)
                }
            }
        )

    }

    async markMessageSeen(messageId, userId) {

        return await this.messageModel.findByIdAndUpdate(
            messageId,
            {
                $addToSet: {
                    seenBy: new Types.ObjectId(userId)
                }
            },
            {
                new: true
            }
        )

    }

    async getUserGroups(userId) {

        return await this.chatModel.find({
            isGroup: true,
            participants: new Types.ObjectId(userId)
        })

    }

    async createGroupMessage(sender: string, group: string, content: string, onlineUser: any) {

        const senderId = new Types.ObjectId(sender);
        const groupId = new Types.ObjectId(group);

        let chat = await this.chatModel.findOne({
            isGroup: true,
            _id: groupId,
            participants: senderId
        });

        if (!chat) {
            throw new UnauthorizedException("You are not a participant of the group.")
        }

        const messageDeliveredTo = [senderId];

        const participants = chat.participants;

        for (const participant of participants) {
            if (onlineUser.has(participant._id.toString())) {
                messageDeliveredTo.push(participant._id);
            }
        }

        const newMessage = await this.messageModel.create({
            chatId: new Types.ObjectId(group),
            senderId: senderId,
            seenBy: [senderId],
            deliveredTo: messageDeliveredTo,
            content
        });

        const newMessageDetails = await this.messageModel.aggregate([
            {
                $match: {
                    _id: newMessage._id
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "senderId",
                    foreignField: "_id",
                    as: "sender",
                    pipeline: [
                        {
                            $project: {
                                name: 1,
                                profilePic: 1,
                                email: 1,
                                contactNumber: 1,
                                _id: 1
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: "chats",
                    localField: "chatId",
                    foreignField: "_id",
                    as: "chat",
                    pipeline: [
                        {
                            $project: {
                                name: 1,
                                _id: 1
                            }
                        }
                    ]
                }
            },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    contentType: 1,
                    chat: 1,
                    sender: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        ])

        chat.lastMessage = newMessage?._id;

        await chat.save();

        return newMessageDetails;

    }

}