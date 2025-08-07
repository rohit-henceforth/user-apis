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
import { WsException } from "@nestjs/websockets";

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

    async createGroup(createGroupData: CreateGroupDto, @Req() request: any) : Promise<ApiResponse<any>>{

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

    async addParticipantsToGroup(userId,groupId,participants) {

        if (!groupId) {
            throw new BadRequestException('Group id is required!');
        }

        const isUserAdmin = await this.isGroupAdmin(groupId, userId);

        if (!isUserAdmin) {
            throw new WsException("You are not an admin!");
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

        if (newParticipants.length > 0) {
            await group.save();
        }

        const admin = await this.userModel.findById(new Types.ObjectId(userId));

        return {
            group : group.name ,
            admin : admin?.name
        }

    }

    async makeAnAdmin(userId, groupId, adminId) {

        const isRequestingUserAdmin = await this.isGroupAdmin(groupId, userId);

        if (!isRequestingUserAdmin) {
            throw new WsException("You are not an admin of group.")
        }

        const group: any = await this.chatModel.findById(groupId);

        const isUserAParticipant = await this.isGroupParticipant(groupId,adminId);

        if (!isUserAParticipant) {
            throw new WsException("User is not a participant of group.");
        }

        group.admins = [...group.admins,new Types.ObjectId(adminId)];

        group.save();

        return group?.name ;

    }

    async removeAnAdmin(userId, groupId, adminId){

        const isRequestingUserAdmin = await this.isGroupAdmin(groupId, userId);

        if (!isRequestingUserAdmin) {
            throw new UnauthorizedException("You are not an admin of group.");
        }

        const isUserAnAdmin = await this.isGroupParticipant(groupId, adminId);

        if (!isUserAnAdmin) {
            throw new BadRequestException("User is not an admin of group.");
        }

        const group: any = await this.chatModel.findById(groupId);

        group.admins = group.admins.filter(admin => admin.toString() !== adminId.toString());

        group.save();

        return group?.name ;

    }

    async removeAParticipant(userId,groupId,participantId){

        const isRequestingUserAdmin = await this.isGroupAdmin(groupId, userId);

        if (!isRequestingUserAdmin) {
            throw new WsException("You are not an admin of group.");
        }

        const isUserAParticipant = await this.isGroupParticipant(groupId, participantId);

        if (!isUserAParticipant) {
            throw new WsException("User is not a participant of group.");
        }

        const group: any = await this.chatModel.findById(groupId);

        group.participants = group.participants.filter(admin => admin.toString() !== participantId.toString());

        group.save();

        const admin = await this.userModel.findById(new Types.ObjectId(userId)).select("name");

        return {
            admin : admin?.name,
            group : group?.name
        };

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

    async createNewDirectMessage(senderId: string, recieverId: string, content: string, contentType: string, onlineUser: any) {

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
            content,
            contentType
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
                $unwind: "$sender"
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
                                isGroup: 1
                            }
                        }
                    ]
                }
            },
            {
                $unwind: "$chat"
            },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    contentType: 1,
                    chat: 1,
                    sender: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    chatId: 1,
                    senderId: 1,
                    deliveredTo: 1
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
                                isGroup: 1
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
                $unwind: "$sender"
            },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    contentType: 1,
                    chat: {
                        name: 1,
                        _id: 1,
                        isGroup: 1
                    },
                    createdAt: 1,
                    updatedAt: 1,
                    sender: 1,
                    deliveredTo: 1
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

    async createGroupMessage(sender: string, group: string, content: string, contentType: string, onlineUser: any) {

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
            content,
            contentType
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
                $unwind: "$sender"
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
                $unwind: "$chat"
            },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    contentType: 1,
                    chat: 1,
                    sender: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    chatId: 1,
                    senderId: 1
                }
            }
        ])

        chat.lastMessage = newMessage?._id;

        await chat.save();

        return newMessageDetails[0];

    }

    async getUserChats(@Req() request): Promise<ApiResponse<any>> {

        const userChats = await this.chatModel.aggregate([
            {
                $match: {
                    participants: request.user._id
                }
            },
            {
                $lookup: {
                    from: "messages",
                    localField: "lastMessage",
                    foreignField: "_id",
                    as: "lastMessage",
                    pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "senderId",
                                foreignField: "_id",
                                as: "sender"
                            }
                        },
                        {
                            $unwind: "$sender"
                        },
                        {
                            $project: {
                                _id: 1,
                                content: 1,
                                contentType: 1,
                                sender: "$sender.name",
                                createdAt: 1,
                                updatedAt: 1
                            }
                        }
                    ]
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
                                name: 1,
                                _id: 1,
                                email: 1,
                                contactNumber: 1
                            }
                        }
                    ]
                }
            },
            {
                $unwind: "$lastMessage"
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    isGroup: 1,
                    lastMessage: 1,
                    participants: 1
                }
            }
        ])

        return new ApiResponse(
            true,
            "User's chats fetched successfully",
            HttpStatus.OK,
            userChats
        )

    }

    async getMessages(chatId: string, @Req() request) {

        const requestingUserId = request.user._id;

        const messages = await this.messageModel.aggregate([
            {
                $match: {
                    chatId: new Types.ObjectId(chatId)
                }
            },
            {
                $sort: {
                    createdAt: 1
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
                                _id: 1,
                                email: 1,
                                contactNumber: 1
                            }
                        }
                    ]
                }
            },
            {
                $unwind: "$sender"
            },
            {
                $lookup: {
                    from: "users",
                    localField: "seenBy",
                    foreignField: "_id",
                    as: "seenBy",
                    pipeline: [
                        {
                            $project: {
                                name: 1,
                                _id: 1,
                                email: 1,
                                contactNumber: 1
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "deliveredTo",
                    foreignField: "_id",
                    as: "deliveredTo",
                    pipeline: [
                        {
                            $project: {
                                name: 1,
                                _id: 1,
                                email: 1,
                                contactNumber: 1
                            }
                        }
                    ]
                }
            },
            {
                $project: {
                    chatId: 1,
                    senderId: 1,
                    content: 1,
                    contentType: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    sender: 1,
                    seenBy: {
                        $cond: {
                            if: { $eq: ['$senderId', requestingUserId] },
                            then: '$seenBy',
                            else: [],
                        },
                    },
                    deliveredTo: {
                        $cond: {
                            if: { $eq: ['$senderId', requestingUserId] },
                            then: '$deliveredTo',
                            else: [],
                        },
                    },
                }
            }
        ])

        return new ApiResponse(
            true,
            "Chat messages fetched successfully!",
            HttpStatus.OK,
            messages
        );

    }

}