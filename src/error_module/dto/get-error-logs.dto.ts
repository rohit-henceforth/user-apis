import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString } from "class-validator";

export class GetErrorLogDto {
  
    @ApiProperty({example : 10})
    @IsString()
    limit ?: string ;

    @ApiProperty({example : 1})
    @IsString()
    page ?: string ;

    @ApiProperty({example : "/users", required : false})
    path ?: string ;

    @ApiProperty({example : "get", required : false})
    method ?: string ;

    @ApiProperty({example : "userId", required : false})
    user ?: string ;
    
}