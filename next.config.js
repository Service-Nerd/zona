/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // GTM-SITE-01 — the comparison hub moved /compare -> /comparisons.
      // "compare" is a verb and reads badly as a section root that will gain
      // children; "comparisons" is a noun, scales, and matches the label that
      // was already in every footer.
      //
      // Permanent (301) rather than temporary because the move is final and we
      // want the link equity to transfer. /compare was live for hours and sat in
      // sitemap.xml, so it may have been crawled and it was linked from four
      // footers — a 404 there would waste whatever equity it had accrued.
      { source: '/compare', destination: '/comparisons', permanent: true },
    ]
  },
}
module.exports = nextConfig
