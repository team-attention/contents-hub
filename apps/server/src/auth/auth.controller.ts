import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthUser, User, UserId } from "../common/decorators/user.decorator";
import { Auth } from "./decorators/auth.decorator";
import { GetMeResponseDto, GetMyIdResponseDto } from "./dto/auth-response.dto";

@Controller("auth")
@ApiTags("auth")
export class AuthController {
  @Auth()
  @Get("me")
  @ApiOperation({ summary: "Get current user info" })
  getMe(@User() user: AuthUser): GetMeResponseDto {
    return {
      id: user.id,
      email: user.email,
    };
  }

  @Auth()
  @Get("me/id")
  @ApiOperation({ summary: "Get current user ID" })
  getMyId(@UserId() userId: string): GetMyIdResponseDto {
    return { userId };
  }
}
