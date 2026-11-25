// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployeeRecords } from "../employee-records";

const actions = vi.hoisted(() => ({
  getEmployeeRecords: vi.fn(),
  saveEmployeeDetails: vi.fn(),
  startDocumentUpload: vi.fn(),
  finishDocumentUpload: vi.fn(),
  getDocumentLink: vi.fn(),
  deleteDocument: vi.fn(),
}));
vi.mock("@/lib/actions/employee-records", () => actions);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const details = {
  aadhaarNumber: "234567890124",
  panNumber: "ABCDE1234F",
  uanNumber: null,
  bankAccountHolder: "Meera Rao",
  bankName: "State Bank of India",
  bankAccountNumber: "001234567890",
  bankIfsc: "SBIN0001234",
  upiId: null,
  updatedAt: "2026-11-01T00:00:00.000Z",
};
const doc = {
  id: "doc-1",
  kind: "MARKSHEET",
  title: "Class 12",
  fileName: "marks.pdf",
  format: "pdf",
  bytes: 204800,
  uploadedByName: "Asha",
  createdAt: "2026-11-02T00:00:00.000Z",
};
const owner = { type: "teacher" as const, id: "t1" };

/** A stand-in for the browser's upload request to Cloudinary. */
class FakeXhr {
  static status = 200;
  static sent: FormData | null = null;
  upload = { onprogress: null as null | ((e: unknown) => void) };
  status = 0;
  responseText = "{}";
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  open() {}
  send(body: FormData) {
    FakeXhr.sent = body;
    this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
    this.status = FakeXhr.status;
    queueMicrotask(() => this.onload?.());
  }
}

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset();
  actions.getEmployeeRecords.mockResolvedValue({
    details,
    documents: [doc],
    uploadsReady: true,
  });
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  FakeXhr.status = 200;
  FakeXhr.sent = null;
});

const renderPanel = async () => {
  const user = userEvent.setup();
  render(<EmployeeRecords owner={owner} name="Meera Rao" />);
  await screen.findByText("ID & bank details");
  return user;
};

describe("EmployeeRecords", () => {
  it("hides Aadhaar and account numbers until asked", async () => {
    const user = await renderPanel();
    expect(screen.getByText("XXXX XXXX 0124")).toBeInTheDocument();
    expect(screen.getByText("XXXXXX7890")).toBeInTheDocument();
    expect(screen.queryByText("001234567890")).not.toBeInTheDocument();
    expect(screen.getByText("ABCDE1234F")).toBeInTheDocument();
    expect(screen.getAllByText("Not added")).toHaveLength(2);

    await user.click(
      screen.getByRole("button", { name: "Show Aadhaar Number" }),
    );
    expect(screen.getByText("2345 6789 0124")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Hide Aadhaar Number" }),
    );
    expect(screen.getByText("XXXX XXXX 0124")).toBeInTheDocument();
  });

  it("edits the details and shows the server's reason when it refuses", async () => {
    const user = await renderPanel();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const ifsc = screen.getByLabelText("IFSC Code");
    await user.clear(ifsc);
    await user.type(ifsc, "hdfc000");
    expect(ifsc).toHaveValue("HDFC000");

    actions.saveEmployeeDetails.mockResolvedValueOnce({
      error: "IFSC must look like SBIN0001234",
    });
    await user.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "IFSC must look like SBIN0001234",
    );
    expect(actions.saveEmployeeDetails).toHaveBeenCalledWith(
      owner,
      expect.objectContaining({ bankIfsc: "HDFC000" }),
    );

    actions.saveEmployeeDetails.mockResolvedValueOnce({
      success: true,
      details: { ...details, bankIfsc: "HDFC0001234" },
    });
    await user.type(ifsc, "1234");
    await user.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByText("HDFC0001234")).toBeInTheDocument();
    expect(screen.queryByLabelText("IFSC Code")).not.toBeInTheDocument();
  });

  it("refuses a file that isn't a PDF or image before uploading", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<EmployeeRecords owner={owner} name="Meera Rao" />);
    await screen.findByText("ID & bank details");
    await user.upload(
      screen.getByTestId("document-input"),
      new File(["<html>"], "page.html", { type: "text/html" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use a PDF, JPG, PNG or WebP file.",
    );
    expect(actions.startDocumentUpload).not.toHaveBeenCalled();
  });

  it("uploads straight to Cloudinary, then lists the document", async () => {
    const user = await renderPanel();
    actions.startDocumentUpload.mockResolvedValue({
      documentId: "doc-2",
      uploadUrl: "https://api.cloudinary.com/v1_1/demo/image/upload",
      fields: {
        api_key: "k",
        signature: "s",
        public_id: "kora_documents/x/y",
        timestamp: "1",
        type: "private",
      },
    });
    actions.finishDocumentUpload.mockResolvedValue({
      success: true,
      document: {
        ...doc,
        id: "doc-2",
        kind: "AADHAAR",
        title: "front",
        fileName: "aadhaar.jpg",
        format: "jpg",
      },
    });
    await user.selectOptions(
      screen.getByLabelText("Type of document"),
      "Aadhaar card",
    );
    await user.type(screen.getByLabelText("Name (optional)"), "front");
    const file = new File(["jpg"], "aadhaar.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByTestId("document-input"), file);

    expect(await screen.findByText("Aadhaar card: front")).toBeInTheDocument();
    expect(actions.startDocumentUpload).toHaveBeenCalledWith(owner, {
      kind: "AADHAAR",
      title: "front",
      fileName: "aadhaar.jpg",
      size: 3,
      type: "image/jpeg",
    });
    expect(FakeXhr.sent?.get("signature")).toBe("s");
    expect(FakeXhr.sent?.get("public_id")).toBe("kora_documents/x/y");
    expect(FakeXhr.sent?.get("file")).toBeInstanceOf(File);
    expect(actions.finishDocumentUpload).toHaveBeenCalledWith("doc-2");
  });

  it("still tidies up, and says so, when the upload fails", async () => {
    const user = await renderPanel();
    FakeXhr.status = 400;
    actions.startDocumentUpload.mockResolvedValue({
      documentId: "doc-3",
      uploadUrl: "u",
      fields: {},
    });
    actions.finishDocumentUpload.mockResolvedValue({
      error: "The file didn't reach us. Try uploading it again.",
    });
    await user.upload(
      screen.getByTestId("document-input"),
      new File(["pdf"], "a.pdf", { type: "application/pdf" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The upload didn't go through. Try again.",
    );
    expect(actions.finishDocumentUpload).toHaveBeenCalledWith("doc-3");
  });

  it("opens a document through a fresh link", async () => {
    const user = await renderPanel();
    const tab = { opener: {}, location: { href: "" }, close: vi.fn() };
    const open = vi
      .spyOn(window, "open")
      .mockReturnValue(tab as unknown as Window);
    actions.getDocumentLink.mockResolvedValue({
      url: "https://api.cloudinary.com/download?x=1",
    });
    await user.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() =>
      expect(tab.location.href).toBe("https://api.cloudinary.com/download?x=1"),
    );
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(tab.opener).toBeNull();
    open.mockRestore();
  });

  it("deletes a document after asking", async () => {
    const user = await renderPanel();
    actions.deleteDocument.mockResolvedValue({ success: true });
    await user.click(
      screen.getByRole("button", { name: "Delete Marksheet: Class 12" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.queryByText("Marksheet: Class 12")).not.toBeInTheDocument(),
    );
    expect(actions.deleteDocument).toHaveBeenCalledWith("doc-1");
  });
});
