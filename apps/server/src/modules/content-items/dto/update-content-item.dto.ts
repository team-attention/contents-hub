import type { ContentItemStatus } from "@contents-hub/shared";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsObject, IsOptional, IsString } from "class-validator";

export class UpdateContentItemDto {
  @ApiProperty({ example: "Updated Title", required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    enum: ["pending", "ready", "done", "archived", "error"],
    required: false,
  })
  @IsOptional()
  @IsEnum(["pending", "ready", "done", "archived", "error"])
  status?: ContentItemStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
