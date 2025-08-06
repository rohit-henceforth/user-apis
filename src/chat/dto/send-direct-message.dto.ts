import { IsNotEmpty, IsString } from "class-validator";

export class SendDirectMessageDto {

    @IsNotEmpty()
    @IsString()
    receiverId : string ;

    @IsNotEmpty()
    @IsString()
    content : string ;

}