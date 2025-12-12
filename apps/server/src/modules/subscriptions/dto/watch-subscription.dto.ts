import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, IsUrl } from "class-validator";

export class WatchSubscriptionDto {
  @ApiProperty({ example: "https://example.com/posts" })
  @IsUrl()
  url: string;

  @ApiProperty({ example: "Example Blog Posts" })
  @IsString()
  name: string;

  @ApiProperty({
    example: "article.post-list",
    description: "CSS selector for the list container (from Selector Picker)",
  })
  @IsString()
  selector: string;

  @ApiProperty({
    example: 60,
    required: false,
    description: "Check interval in minutes (default: 60)",
  })
  @IsOptional()
  @IsNumber()
  checkInterval?: number;
}

export class WatchSubscriptionResultDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000", required: false })
  subscriptionId?: string;

  @ApiProperty({ example: 15, description: "Number of URLs found in the list" })
  urlCount: number;

  @ApiProperty({ example: "No URLs found in selector", required: false })
  error?: string;
}
