import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString, IsUrl } from "class-validator";

export class CreateContentItemDto {
  @ApiProperty({ example: "https://example.com/article" })
  @IsUrl()
  url: string;

  @ApiProperty({ example: "Article Title", required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false, description: "Optional metadata" })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
