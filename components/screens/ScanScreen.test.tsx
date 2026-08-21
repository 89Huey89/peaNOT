import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScanScreen from "@/components/screens/ScanScreen";
import { palette } from "@/lib/theme";

// BarcodeScanner owns real camera access (@zxing/browser, getUserMedia) —
// irrelevant to the bottom-sheet behavior under test here (UX8), so it's
// replaced with a lightweight stub. Real camera behavior is covered by
// BarcodeScanner.test.tsx.
vi.mock("@/components/BarcodeScanner", () => ({
  default: () => <div data-testid="barcode-scanner-stub" />,
}));

function renderScreen() {
  const onDetected = vi.fn();
  const { container } = render(
    <ScanScreen
      P={palette("mustard")}
      loading={false}
      paused={false}
      haptic={false}
      sound={false}
      history={[]}
      onDetected={onDetected}
      onOpen={vi.fn()}
      onOpenCard={vi.fn()}
      onTab={vi.fn()}
    />,
  );
  return { onDetected, container };
}

async function openManual() {
  await userEvent.click(await screen.findByRole("button", { name: /Barcode manuell eingeben/ }));
}

async function openSearch() {
  await userEvent.click(await screen.findByRole("button", { name: /Nach Name suchen/ }));
}

describe("ScanScreen entry sheet (UX8)", () => {
  it("opens the manual-entry sheet as a dialog with the field already focused", async () => {
    renderScreen();
    await openManual();

    const dialog = screen.getByRole("dialog", { name: "Barcode manuell eingeben" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Barcode manuell eingeben" })).toHaveFocus();
  });

  it("opens the search sheet with its field focused", async () => {
    renderScreen();
    await openSearch();

    expect(screen.getByRole("dialog", { name: "Nach Name suchen" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Nach Name suchen" })).toHaveFocus();
  });

  it("opening search while manual entry is open replaces it, not stacks it", async () => {
    renderScreen();
    await openManual();
    expect(screen.getByRole("textbox", { name: "Barcode manuell eingeben" })).toBeInTheDocument();

    await openSearch();

    expect(
      screen.queryByRole("textbox", { name: "Barcode manuell eingeben" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Nach Name suchen" })).toBeInTheDocument();
    // Still only one sheet dialog, never two stacked.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("tapping its own toggle button again closes the sheet", async () => {
    renderScreen();
    await openManual();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await openManual();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on a scrim tap", async () => {
    renderScreen();
    await openManual();

    await userEvent.click(screen.getAllByRole("button", { name: "Schließen" })[0]!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on the Schließen button and returns focus to the button that opened it", async () => {
    renderScreen();
    const opener = await screen.findByRole("button", { name: /Barcode manuell eingeben/ });
    await userEvent.click(opener);

    // The scrim and the header button share the "Schließen" name — the
    // header one is last in the dialog's DOM order.
    const closeButtons = screen.getAllByRole("button", { name: "Schließen" });
    await userEvent.click(closeButtons[closeButtons.length - 1]!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("closes on Escape", async () => {
    renderScreen();
    await openManual();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("still forwards a manually entered barcode via onDetected", async () => {
    const { onDetected } = renderScreen();
    await openManual();

    await userEvent.type(
      screen.getByRole("textbox", { name: "Barcode manuell eingeben" }),
      "4011200296908",
    );
    await userEvent.click(screen.getByRole("button", { name: "Prüfen" }));

    expect(onDetected).toHaveBeenCalledWith("4011200296908");
  });

  it("makes the scanner and tab bar inert while the sheet is open", async () => {
    const { container } = renderScreen();
    await openManual();

    const scannerStub = screen.getByTestId("barcode-scanner-stub");
    const inertWrapper = container.querySelector("[inert]");
    expect(inertWrapper).not.toBeNull();
    expect(inertWrapper?.contains(scannerStub)).toBe(true);
  });
});
