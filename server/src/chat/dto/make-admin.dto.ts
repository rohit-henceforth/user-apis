import { IsNotEmpty, IsString } from "class-validator";

export class MakeAdminDto {

    @IsNotEmpty()
    @IsString() 
    groupId : string ;

    @IsNotEmpty()
    @IsString()
    adminId : string ;

}