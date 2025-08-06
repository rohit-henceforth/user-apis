import { IsNotEmpty, IsString } from "class-validator";

export class addParticipantsDto {

    @IsNotEmpty()
    @IsString()
    groupId : string ;

    @IsNotEmpty()
    participants : string[] ;

}