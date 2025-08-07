import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, Matches } from "class-validator";

export class LoginDto {

    @ApiProperty({ example: '' })
    @IsNotEmpty()
    @IsString()
    @Matches(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$|^\+?[1-9]\d{1,14}$/, {
        message: 'Must be a valid email or phone number',
    })
    contact: string;

    @ApiProperty({ example: '' })
    @IsNotEmpty()
    password: string;

}