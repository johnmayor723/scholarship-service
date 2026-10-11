// Keep this registry focused on primary/official sources. Add institution scholarship
// pages here after confirming they are genuine and permitted to crawl.
//
// University entries use each institution's own on-site search for "scholarship"
// rather than a homepage or a guessed static page. Verified individually before
// adding: robots.txt allows generic crawlers on these paths, the request returns
// HTTP 200, and extractCandidates() actually yields current-looking links (not just
// nav/menu noise). Homepages were tried first and discarded — none of these
// universities put scholarship-post titles in homepage anchor text, so a homepage
// source silently finds nothing. Sites that returned HTTP 403 to this bot (likely a
// WAF/anti-bot rule) were left out rather than worked around, per this project's own
// "do not bypass anti-bot controls" rule: University of Benin, FUTA. Sites that
// resolved but yielded no useful scholarship links were also left out: FUTO, LASU.
module.exports = [
  {
    name: "National Universities Commission (NUC)",
    url: "https://www.nuc.edu.ng/",
    type: "official",
    trustLevel: "primary",
    notes: "Official regulator news and announcements about Nigerian universities."
  },
  {
    name: "Federal Ministry of Education",
    url: "https://education.gov.ng/",
    type: "official",
    trustLevel: "primary",
    notes: "Federal scholarship notices and official education announcements."
  },
  {
    name: "Federal Scholarships Board",
    url: "https://education.gov.ng/federal-scholarships-board/",
    type: "official",
    trustLevel: "primary",
    notes: "Official board page; distinguish domestic Nigerian awards from overseas awards."
  },
  {
    name: "University of Lagos (UNILAG)",
    url: "https://unilag.edu.ng/?s=scholarship",
    type: "official",
    trustLevel: "primary",
    notes: "University financial-aid signal via on-site search, not homepage (homepage anchor text has no scholarship titles). Includes alumni/foundation/third-party awards specific to UNILAG students."
  },
  {
    name: "Obafemi Awolowo University (OAU)",
    url: "https://oauife.edu.ng/?s=scholarship",
    type: "official",
    trustLevel: "primary",
    notes: "University financial-aid signal via on-site search. Mix of current calls and historic/alumni award writeups; session filter in crawler.js handles staleness."
  },
  {
    name: "University of Nigeria, Nsukka (UNN)",
    url: "https://www.unn.edu.ng/?s=scholarship",
    type: "official",
    trustLevel: "primary",
    notes: "On-site search, not the university's own /jobsscholarships/ hub page: that hub is a stale 2017/2018 list that also links out to a non-official aggregator (worldscholarshipforum.com), which is the wrong kind of noise for this registry."
  },
  {
    name: "Ahmadu Bello University (ABU)",
    url: "https://abu.edu.ng/?s=scholarship",
    type: "official",
    trustLevel: "primary",
    notes: "University financial-aid signal via on-site search; highest yield of the universities checked (10 candidates on verification pass)."
  },
  {
    name: "University of Port Harcourt (UNIPORT)",
    url: "https://uniport.edu.ng/?s=scholarship",
    type: "official",
    trustLevel: "primary",
    notes: "University financial-aid signal via on-site search; verification pass surfaced a live 2026/2027-session call (TAGDev 2.0), i.e. exactly the kind of record this registry exists to find."
  }
];