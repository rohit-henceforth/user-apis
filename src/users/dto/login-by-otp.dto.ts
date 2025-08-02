import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

export class LoginByOtpDto {

    @ApiProperty({example:""})
    @IsNotEmpty()
    @IsString()
    @Matches(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$|^\+?[1-9]\d{1,14}$/, {
        message: 'Must be a valid email or phone number',
    })
    contact : string ;

    @ApiProperty({example:""})
    @IsNotEmpty()
    @IsString()
    @MinLength(4)
    otp: string;

}