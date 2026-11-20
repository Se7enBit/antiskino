type Props = { html: string; text: string; title: string };

/**
 * Web: the email as it renders, in a sandboxed frame (no scripts, no access to
 * the page). Height fits typical emails; longer ones scroll inside.
 */
export function EmailFrame({ html, title }: Props) {
  return (
    <iframe
      title={title}
      srcDoc={html}
      sandbox=""
      style={{ width: '100%', height: 520, border: '1px solid #D6DED9', borderRadius: 8 }}
    />
  );
}
