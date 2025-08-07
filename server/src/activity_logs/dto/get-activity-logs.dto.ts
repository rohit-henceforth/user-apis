import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class GetActivityLogDto {
  
    @ApiProperty({example : 10})
    @IsString()
    limit ?: string ;

    @ApiProperty({example : 1})
    @IsString()
    page ?: string ;

    @ApiProperty({example : "PROFILE_UPDATED", required : false})
    action ?: string ;

    @ApiProperty({example : "userId", required : false})
    user ?: string ;
    
}