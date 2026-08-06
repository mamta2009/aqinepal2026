/**
 * Trust boundary: `html` must come only from FastAPI's public guide endpoint.
 * That endpoint sanitizes Markdown output with a strict tag and attribute allowlist.
 * Never pass user-authored or browser-supplied HTML into this component.
 */
export function TrustedGuideHtml({ html }: { html: string }) {
  return (
    <div
      className="text-ink-soft [&_a]:font-bold [&_a]:text-link [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-sky [&_blockquote]:pl-5 [&_code]:rounded [&_code]:bg-sky-soft [&_code]:px-1.5 [&_code]:py-0.5 [&_h1]:mb-6 [&_h1]:text-4xl [&_h1]:font-extrabold [&_h1]:text-ink [&_h2]:mt-10 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-7 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-ink [&_li]:my-2 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_p]:leading-7 [&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-ink [&_pre]:p-5 [&_pre]:text-white [&_table]:my-6 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_td]:border [&_td]:border-border [&_td]:p-3 [&_th]:border [&_th]:border-border [&_th]:bg-surface-tint [&_th]:p-3 [&_th]:text-left [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
