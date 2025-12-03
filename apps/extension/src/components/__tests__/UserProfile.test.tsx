import type { User } from "@supabase/supabase-js";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserProfile } from "../UserProfile";

describe("UserProfile", () => {
  const mockUser: User = {
    id: "test-id",
    email: "test@example.com",
    user_metadata: {
      full_name: "Test User",
      avatar_url: "https://example.com/avatar.jpg",
    },
    app_metadata: {},
    aud: "authenticated",
    created_at: "2024-01-01T00:00:00Z",
  } as User;

  const defaultProps = {
    user: mockUser,
    onSignOut: vi.fn(),
    isLoading: false,
  };

  it("should display user email", () => {
    render(<UserProfile {...defaultProps} />);

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("should display user name", () => {
    render(<UserProfile {...defaultProps} />);

    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("should display avatar image when avatar_url is provided", () => {
    render(<UserProfile {...defaultProps} />);

    const avatar = screen.getByAltText("Profile");
    expect(avatar).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("should display initial when no avatar_url", () => {
    const userWithoutAvatar = {
      ...mockUser,
      user_metadata: { full_name: "Test User" },
    } as User;
    render(<UserProfile {...defaultProps} user={userWithoutAvatar} />);

    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("should call onSignOut when sign out button is clicked", () => {
    const onSignOut = vi.fn();
    render(<UserProfile {...defaultProps} onSignOut={onSignOut} />);

    fireEvent.click(screen.getByText("Sign out"));

    expect(onSignOut).toHaveBeenCalled();
  });

  it("should show loading indicator during sign out", () => {
    render(<UserProfile {...defaultProps} isLoading={true} />);

    expect(screen.getByText("...")).toBeInTheDocument();
  });
});
