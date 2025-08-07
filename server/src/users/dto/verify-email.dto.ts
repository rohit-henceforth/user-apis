import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsNumber, IsString, Length } from "class-validator";

export class VerifyEmailDto{

    @ApiProperty({example:""})
    @IsNotEmpty()
    @IsEmail()
    email : string ;

    @ApiProperty({example:""})
    @IsNotEmpty()
    @IsNumber()
    contactNumber : number ;

    @ApiProperty({example:""})
    @IsNotEmpty()
    @IsString()
    @Length(4)
    emailOtp : string ;

    @ApiProperty({example:""})
    @IsNotEmpty()
    @IsString()
    @Length(4)
    contactOtp : string ;

} 