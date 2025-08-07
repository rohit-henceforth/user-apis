import { IsNotEmpty, IsString } from "class-validator";

export class UpdateGroupDto{

    @IsNotEmpty()
    @IsString()
    name : string ;

    @IsNotEmpty()
    @IsString()
    groupId : string;

}