import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { User } from "src/users/entities/user.schema";

@Schema({
    timestamps: true
})
export class Chat {

    @Prop({
        isRequired: true,
        type: Boolean,
        default: false
    })
    isGroup: boolean;

    @Prop({
        type: String
    })
    name: string;

    @Prop({
        type: [{ type: Types.ObjectId, ref: User.name }],
        required: true
    })
    participants: Types.ObjectId[]

    @Prop({
        type: Types.ObjectId,
        ref: 'Message'
    })
    lastMessage: Types.ObjectId

    @Prop({
        type: [{ type: Types.ObjectId, ref: User.name }]
    })
    admins: Types.ObjectId[]

}

export type ChatDocument = Chat & Document;
export const chatSchema = SchemaFactory.createForClass(Chat);