import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignIn } from "../SignIn";

describe("SignIn", () => {
  const defaultProps = {
    onSignIn: vi.fn(),
    isLoading: false,
    error: null,
  };

  it("should render sign in button", () => {
    render(<SignIn {...defaultProps} />);

    expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
  });

  it("should call onSignIn when button is clicked", () => {
    const onSignIn = vi.fn();
    render(<SignIn {...defaultProps} onSignIn={onSignIn} />);

    fireEvent.click(screen.getByText("Sign in with Google"));

    expect(onSignIn).toHaveBeenCalled();
  });

  it("should show loading state", () => {
    render(<SignIn {...defaultProps} isLoading={true} />);

    expect(screen.getByText("Signing in...")).toBeInTheDocument();
  });

  it("should disable button when loading", () => {
    render(<SignIn {...defaultProps} isLoading={true} />);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should display error message", () => {
    const error = new Error("Authentication failed");
    render(<SignIn {...defaultProps} error={error} />);

    expect(screen.getByText("Authentication failed")).toBeInTheDocument();
  });
});
