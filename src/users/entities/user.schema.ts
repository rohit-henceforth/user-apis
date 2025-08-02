import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import * as bcrypt from "bcrypt" ;
import { PaginateModel } from "mongoose";
import * as mongoosePaginate from 'mongoose-paginate-v2';

export type UserDocument = User & Document ;
export type UserModelPaginate = PaginateModel<UserDocument>;

@Schema()
export class User{

    @Prop({
        required : true,
        trim : true
    })
    name : string ;

    @Prop()
    profilePic : string ;

    @Prop()
    profilePicPublicId : string ;

    @Prop({
        required : true,
        unique : true
    })
    email : string ;

    @Prop({
        required : true
    })
    password : string ;

    @Prop()
    emailOtp : number ;

    @Prop({
        required : true,
        default : () => Date.now() + 300000
    })
    emailOtpExpiry : number ;

    @Prop()
    contactOtp : number ;

    @Prop({
        required : true,
        default : () => Date.now() + 300000
    })
    contactOtpExpiry : number ;

    @Prop()
    resetPasswordToken : string ;

    @Prop({
        required : true,
        unique : true
    })
    contactNumber : number;

    @Prop({
        unique : true
    })
    refreshToken : string;

    @Prop({
        required : true,
        default : false
    })
    isVerified : boolean ;

    @Prop({
        required : true,
        default : 'user'
    })
    role : 'admin' | 'user' ;

}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.plugin(mongoosePaginate);

UserSchema.pre<UserDocument>("save",async function(next){
    const user = this as any ;
    if(!user.isModified('password')) return next();
    const salt = await bcrypt.genSalt();
    this.password = await bcrypt.hash(this.password,salt);
    next();
})

UserSchema.methods.isPasswordCorrect = async function(newPassword : string){
    return await bcrypt.compare(
        newPassword,
        this.password
    );
}