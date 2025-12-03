import { Controller, Get } from "@nestjs/common";
import { AuthUser, User, UserId } from "../common/decorators/user.decorator";
import { Auth } from "./decorators/auth.decorator";

@Controller("auth")
export class AuthController {
  @Auth()
  @Get("me")
  getMe(@User() user: AuthUser) {
    return {
      id: user.id,
      email: user.email,
    };
  }

  @Auth()
  @Get("me/id")
  getMyId(@UserId() userId: string) {
    return { userId };
  }
}
