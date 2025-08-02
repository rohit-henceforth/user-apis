import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches } from "class-validator";

export class LoginOtpDto {

    @ApiProperty({example:""})
    @IsNotEmpty()
    @IsString()
    @Matches(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$|^\+?[1-9]\d{1,14}$/, {
        message: 'Must be a valid email or phone number',
    })
    contact: string;

}