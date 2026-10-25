// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { IssueDocument } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskDocumentPanel } from "./TaskDocumentPanel";
import { queryKeys } from "@/lib/queryKeys";

vi.mock("@/lib/router", () => ({
  useLocation: () => ({ pathname: "/", search: "", hash: "" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/MarkdownBody", () => ({
  MarkdownBody: ({ children }: { children: string }) => <article data-rendered>{children}</article>,
}));

vi.mock("@/components/IssueDocumentAnnotations", () => ({
  IssueDocumentAnnotations: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DocumentAnnotationsCountChip: () => <span data-testid="annotations-chip" />,
}));

const copyTextMock = vi.fn(async () => undefined);
vi.mock("@/lib/clipboard", () => ({
  copyTextToClipboard: (text: string) => copyTextMock(text),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sampleDoc: IssueDocument = {
  id: "doc-1",
  issueId: "issue-123",
  key: "published-post",
  title: "Why I Run Dual Caddy",
  body: "# Homelab Setup\n\nDual Caddy and Dual DNS.",
  latestRevisionNumber: 2,
  latestRevisionId: "rev-2",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("TaskDocumentPanel", () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    copyTextMock.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
    client.clear();
    vi.restoreAllMocks();
  });

  function renderPanel(doc: IssueDocument = sampleDoc) {
    client.setQueryData([...queryKeys.issues.documents(doc.issueId), doc.key], doc);
    return act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <TaskDocumentPanel issueId={doc.issueId} documentKey={doc.key} initialDocument={doc} />
        </QueryClientProvider>,
      );
    });
  }

  it("renders document title, revision number, and action buttons above the title", async () => {
    await renderPanel();

    expect(container.textContent).toContain("Why I Run Dual Caddy");
    expect(container.textContent).toContain("Revision 2");
    expect(container.querySelector("[data-rendered]")?.textContent).toContain("Dual Caddy and Dual DNS");

    const copyBtn = container.querySelector<HTMLButtonElement>('button[title="Copy Markdown"]');
    const downloadBtn = container.querySelector<HTMLButtonElement>('button[title="Download Markdown"]');
    expect(copyBtn).not.toBeNull();
    expect(downloadBtn).not.toBeNull();
    expect(copyBtn?.textContent).toContain("Copy");
    expect(downloadBtn?.textContent).toContain("Download");
  });

  it("copies markdown body and shows confirmation when copy button is clicked", async () => {
    await renderPanel();

    const copyBtn = container.querySelector<HTMLButtonElement>('button[title="Copy Markdown"]');
    expect(copyBtn).not.toBeNull();

    await act(async () => {
      copyBtn!.click();
    });

    expect(copyTextMock).toHaveBeenCalledWith(sampleDoc.body);
    expect(copyBtn?.textContent).toContain("Copied");
  });

  it("triggers download with safe slugified filename when download button is clicked", async () => {
    const createObjectURLMock = vi.fn(() => "blob:http://localhost/test-uuid");
    const revokeObjectURLMock = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });

    let clickedAnchor: HTMLAnchorElement | null = null;
    const originalAppendChild = document.body.appendChild.bind(document.body);
    const appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      if (node instanceof HTMLAnchorElement) {
        clickedAnchor = node;
      }
      return originalAppendChild(node);
    });

    await renderPanel();

    const downloadBtn = container.querySelector<HTMLButtonElement>('button[title="Download Markdown"]');
    expect(downloadBtn).not.toBeNull();

    await act(async () => {
      downloadBtn!.click();
    });

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickedAnchor).not.toBeNull();
    expect(clickedAnchor?.download).toBe("why-i-run-dual-caddy.md");
    expect(clickedAnchor?.href).toBe("blob:http://localhost/test-uuid");
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost/test-uuid");

    appendChildSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("shows fallback message when document is not found", async () => {
    client.setQueryData([...queryKeys.issues.documents("issue-1"), "missing"], null);
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <TaskDocumentPanel issueId="issue-1" documentKey="missing" />
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).toContain("Document no longer available");
  });
});
