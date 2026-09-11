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

      // GTM-CHARITY-01 — /charity-marathon-training-plan -> /charity-runners.
      // The first version of that page was marathon-only, which was wrong about
      // the audience: charity places are most often 10K and half marathon, with
      // marathons and the odd ultra on top. The page now covers every distance,
      // so a marathon-shaped slug would misdescribe it and turn most of the
      // people it is for away at the URL.
      //
      // Permanent, same reasoning as /compare above: it was live and sat in
      // sitemap.xml, so it may have been crawled, and it is the URL a partner
      // may already have been given. /charity-runners is also simply better to
      // put in an email or say out loud. (`permanent: true` emits a 308, not a
      // 301 — verified, not assumed. Both transfer link equity; 308 also
      // preserves the request method.)
      { source: '/charity-marathon-training-plan', destination: '/charity-runners', permanent: true },
    ]
  },
}
module.exports = nextConfig
