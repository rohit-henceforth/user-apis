import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsNumber, IsString, MinLength } from "class-validator";

export class CreateNewEntryDto{

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
    
      @ApiProperty({example:9999900000})
      @IsNotEmpty()
      @IsNumber()
      readonly contactNumber: number;


}