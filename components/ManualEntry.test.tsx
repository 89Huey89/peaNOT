import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ManualEntry from "@/components/ManualEntry";

describe("ManualEntry", () => {
  it("submits the sanitized barcode", async () => {
    const onSubmit = vi.fn();
    render(<ManualEntry onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText("Barcode manuell eingeben"), "4011-200296908");
    await userEvent.click(screen.getByRole("button", { name: "Prüfen" }));

    expect(onSubmit).toHaveBeenCalledWith("4011200296908");
  });

  it("strips non-digit characters from input", async () => {
    const onSubmit = vi.fn();
    render(<ManualEntry onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText("Barcode manuell eingeben"), "abc12345678");
    await userEvent.click(screen.getByRole("button", { name: "Prüfen" }));

    expect(onSubmit).toHaveBeenCalledWith("12345678");
  });

  it("disables the button when input is empty", () => {
    render(<ManualEntry onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Prüfen" })).toBeDisabled();
  });

  it("blocks submit and hints when the length is out of range", async () => {
    const onSubmit = vi.fn();
    render(<ManualEntry onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText("Barcode manuell eingeben"), "123");

    expect(screen.getByRole("button", { name: "Prüfen" })).toBeDisabled();
    expect(screen.getByText(/8–14 Ziffern/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is disabled while a lookup is in flight", () => {
    render(<ManualEntry onSubmit={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: "Prüfen" })).toBeDisabled();
  });
});
