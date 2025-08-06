import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { Chat } from "./chat.schema";
import { User } from "src/users/entities/user.schema";

@Schema({
    timestamps: true
})
export class Message {

    @Prop({
        type: Types.ObjectId,
        ref: Chat.name,
        required: true
    })
    chatId: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        ref: User.name,
        required: true
    })
    senderId: Types.ObjectId;

    @Prop({
        type: [{
            type: Types.ObjectId,
            ref: User.name
        }],
        required: true
    })
    seenBy: Types.ObjectId[];

    @Prop({
        type: [{
            type: Types.ObjectId,
            ref: User.name
        }],
        required: true
    })
    deliveredTo: Types.ObjectId[];

    @Prop({
        type : String,
        required : true
    })
    content : string ;

    @Prop({
        type : String,
        enum : ['text', 'image', 'video', 'file'],
        required : true,
        default : 'text'
    })
    contentType : 'text' | 'image' | 'video' | 'file' ;

}

export type MessageDocument = Message & Document ;
export const messageSchema = SchemaFactory.createForClass(Message);