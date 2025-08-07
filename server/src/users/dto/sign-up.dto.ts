import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsNotEmpty, IsNumber, IsString, Min, MinLength } from "class-validator";

export class SignUpDto {

  @ApiProperty({example:""})
  @IsNotEmpty()
  @IsString()
  readonly name: string;

  @ApiProperty({example:""})
  @IsNotEmpty()
  @IsEmail()
  readonly email: string;

  @ApiProperty({example:""})
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  readonly password: string;

  @ApiProperty({example:""})
  @IsNotEmpty()
  @IsNumber()
  readonly contactNumber: number;

}