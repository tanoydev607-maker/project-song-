import React, { useState } from "react";
import { X, FileText, Code, FileSpreadsheet, Image as ImageIcon, File, Eye, Download, Maximize2 } from "lucide-react";
import { type AttachedFile } from "@orca/memory-engine";

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getFileIcon = (fileName: string, type: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
    return <ImageIcon size={15} className="text-zinc-400" />;
  }
  if (["js", "ts", "tsx", "jsx", "py", "rs", "cpp", "c", "html", "css", "json", "yaml", "yml", "sql"].includes(ext)) {
    return <Code size={15} className="text-emerald-500" />;
  }
  if (["csv", "xlsx", "xls"].includes(ext)) {
    return <FileSpreadsheet size={15} className="text-emerald-600" />;
  }
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) {
    return <FileText size={15} className="text-blue-500" />;
  }
  return <File size={15} className="text-amber-500" />;
};

interface AttachmentListProps {
  files: AttachedFile[];
  onRemove?: (id: string) => void;
  isDraft?: boolean;
}

export const AttachmentList: React.FC<AttachmentListProps> = ({ files, onRemove, isDraft = false }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!files || files.length === 0) return null;

  return (
    <>
      {/* Lightbox Modal for Full Image Zoom Preview */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl border border-white/20">
            <img src={selectedImage} alt="Attachment Zoom" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/70 hover:bg-black text-white transition shadow"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Grid List of Attachments */}
      <div className={`flex flex-wrap gap-2 ${isDraft ? "mb-2.5 px-1" : "my-2.5"}`}>
        {files.map((file) => {
          const isImg = file.type.startsWith("image/") && file.dataUrl;

          if (isImg) {
            return (
              <div
                key={file.id}
                className="group relative rounded-xl overflow-hidden border border-[var(--sb-border)] bg-[var(--sb-code-bg)] shadow-sm transition hover:shadow-md max-w-[140px]"
              >
                {/* Image Thumbnail */}
                <div
                  onClick={() => setSelectedImage(file.dataUrl!)}
                  className="w-24 h-20 bg-black/20 overflow-hidden cursor-zoom-in relative flex items-center justify-center"
                >
                  <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <Maximize2 size={16} className="text-white drop-shadow" />
                  </div>
                </div>

                {/* Info & Remove Button */}
                <div className="p-1.5 flex items-center justify-between text-[10px] text-[var(--sb-text-secondary)]">
                  <span className="truncate max-w-[70px] font-medium" title={file.name}>
                    {file.name}
                  </span>
                  {onRemove && isDraft && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(file.id);
                      }}
                      className="p-0.5 rounded-md hover:bg-zinc-700 hover:text-white transition text-[var(--sb-text-muted)]"
                      title="Remove attachment"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          }

          // Document / Code / File Card
          return (
            <div
              key={file.id}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--sb-border)] bg-[var(--sb-code-bg)] text-xs shadow-sm max-w-xs group transition hover:border-white/30"
            >
              <div className="p-1.5 rounded-lg bg-[var(--sb-code-header)] flex items-center justify-center shrink-0">
                {getFileIcon(file.name, file.type)}
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-semibold text-[11px] text-[var(--sb-text-primary)] truncate" title={file.name}>
                  {file.name}
                </span>
                <span className="text-[10px] text-[var(--sb-text-muted)] font-mono">{formatFileSize(file.size)}</span>
              </div>

              {onRemove && isDraft ? (
                <button
                  onClick={() => onRemove(file.id)}
                  className="p-1 rounded-md text-[var(--sb-text-muted)] hover:text-[var(--sb-text-primary)] hover:bg-[var(--sb-hover-bg)] transition"
                  title="Remove file"
                >
                  <X size={13} />
                </button>
              ) : file.dataUrl ? (
                <a
                  href={file.dataUrl}
                  download={file.name}
                  className="p-1 rounded-md text-[var(--sb-text-muted)] hover:text-[var(--sb-text-primary)] hover:bg-[var(--sb-hover-bg)] transition"
                  title="Download file"
                >
                  <Download size={13} />
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
};
