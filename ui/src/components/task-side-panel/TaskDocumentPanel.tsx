import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { IssueDocument } from "@paperclipai/shared";
import { Check, Copy, Download, FileQuestion, Loader2 } from "lucide-react";
import { ApiError } from "@/api/client";
import { issuesApi } from "@/api/issues";
import { DocumentAnnotationsCountChip, IssueDocumentAnnotations } from "@/components/IssueDocumentAnnotations";
import { MarkdownBody } from "@/components/MarkdownBody";
import { queryKeys } from "@/lib/queryKeys";
import { documentDisplayTitle } from "@/lib/issue-artifacts";
import { useLocation } from "@/lib/router";
import { copyTextToClipboard } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";

export function TaskDocumentPanel({
  issueId,
  documentKey,
  initialDocument,
}: {
  issueId: string;
  documentKey: string;
  initialDocument?: IssueDocument;
}) {
  const location = useLocation();
  const [annotationPanelOpen, setAnnotationPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const query = useQuery<IssueDocument | null>({
    queryKey: [...queryKeys.issues.documents(issueId), documentKey],
    queryFn: async () => {
      try {
        return await issuesApi.getDocument(issueId, documentKey);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    initialData: initialDocument,
  });

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading document…
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="py-8 text-sm text-muted-foreground" role="alert">
        The document could not be loaded. Retry from the tab launcher or refresh the task.
      </div>
    );
  }
  const document = query.data;
  if (!document) {
    return (
      <div className="flex items-start gap-3 py-8 text-sm" role="status">
        <FileQuestion className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">Document no longer available</p>
          <p className="text-muted-foreground">
            This tab is preserved so the missing resource is explicit. Close it or choose another document.
          </p>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    if (!document.body) return;
    try {
      await copyTextToClipboard(document.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const handleDownload = () => {
    if (!document.body) return;
    const blob = new Blob([document.body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    const safeTitle = (document.title || document.key || "document")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    link.download = `${safeTitle || "document"}.md`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <article className="space-y-4">
      <header className="space-y-2 border-b pb-3">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs font-normal flex items-center gap-1.5 cursor-pointer"
            onClick={handleCopy}
            title="Copy Markdown"
            aria-label="Copy Markdown"
          >
            {copied ? <Check className="size-3.5 text-emerald-600" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs font-normal flex items-center gap-1.5 cursor-pointer"
            onClick={handleDownload}
            title="Download Markdown"
            aria-label="Download Markdown"
          >
            <Download className="size-3.5" aria-hidden />
            <span>Download</span>
          </Button>
        </div>
        <h2 className="text-lg font-semibold leading-tight">{documentDisplayTitle(document)}</h2>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span>{`Revision ${document.latestRevisionNumber ?? 1}`}</span>
          <span aria-hidden>·</span>
          <span>{`Updated ${new Date(document.updatedAt).toLocaleString()}`}</span>
          <DocumentAnnotationsCountChip
            issueId={issueId}
            docKey={document.key}
            panelOpen={annotationPanelOpen}
            onToggle={() => setAnnotationPanelOpen((open) => !open)}
          />
        </div>
      </header>
      {document.body.trim() ? (
        <IssueDocumentAnnotations
          issueId={issueId}
          doc={document}
          bodyMarkdown={document.body}
          draftDirty={false}
          draftConflicted={false}
          historicalPreview={false}
          locationHash={location.hash}
          panelOpen={annotationPanelOpen}
          onPanelOpenChange={setAnnotationPanelOpen}
          panelPlacement="popover"
        >
          <MarkdownBody>{document.body}</MarkdownBody>
        </IssueDocumentAnnotations>
      ) : (
        <p className="text-sm text-muted-foreground">Document is empty.</p>
      )}
    </article>
  );
}
