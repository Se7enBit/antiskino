/**
 * Web: a page's title and description, also in the static HTML (React hoists
 * them into <head>). Camping pages have their own (CampingHead).
 */
export function PageHead({ title, description }: { title: string; description?: string }) {
  return (
    <>
      <title>{title}</title>
      <meta property="og:title" content={title} />
      {description ? <meta name="description" content={description} /> : null}
      {description ? <meta property="og:description" content={description} /> : null}
    </>
  );
}
