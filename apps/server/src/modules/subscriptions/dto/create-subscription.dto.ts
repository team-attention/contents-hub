import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, IsUrl } from "class-validator";

export class CreateSubscriptionDto {
  @ApiProperty({ example: "https://example.com/page" })
  @IsUrl()
  url: string;

  @ApiProperty({ example: "My Subscription" })
  @IsString()
  name: string;

  @ApiProperty({ example: 3600, required: false, description: "Check interval in seconds" })
  @IsOptional()
  @IsNumber()
  checkInterval?: number;
}
