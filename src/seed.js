const db = require('./db');
const { idFor, isoNow } = require('./utils');

function seedKnownCurrentSessionRecord() {
  const title = 'Aliko Dangote Foundation Scholarship for Nigerian Public Universities';
  const provider = 'Aliko Dangote Foundation';
  const session = '2026/2027';
  const id = idFor(title, provider, session);
  const now = isoNow();
  db.prepare(`INSERT INTO scholarships
    (id,title,provider,university_name,description,academic_session,study_levels,
     eligible_nationalities,eligible_locations,fields_of_study,benefits,eligibility,
     application_url,deadline,status,source_url,source_name,source_type,last_checked_at,
     verification_notes,discovered_at,updated_at,raw_excerpt)
    VALUES (@id,@title,@provider,@university_name,@description,@academic_session,@study_levels,
     @eligible_nationalities,@eligible_locations,@fields_of_study,@benefits,@eligibility,
     @application_url,@deadline,@status,@source_url,@source_name,@source_type,@last_checked_at,
     @verification_notes,@discovered_at,@updated_at,@raw_excerpt)
    ON CONFLICT(id) DO UPDATE SET last_checked_at=excluded.last_checked_at, updated_at=excluded.updated_at`)
    .run({
      id, title, provider, university_name: null,
      description: 'The National Universities Commission reported an announced initiative targeting undergraduate students in Nigerian federal and state universities, planned to commence alongside the 2026/2027 academic session. The official application process and deadline must be confirmed before applying.',
      academic_session: session,
      study_levels: JSON.stringify(['undergraduate']),
      eligible_nationalities: JSON.stringify(['Nigerian']),
      eligible_locations: JSON.stringify(['Nigeria']),
      fields_of_study: JSON.stringify(['STEM and related disciplines']),
      benefits: 'Award value and final benefit details not confirmed in the cited announcement.',
      eligibility: 'The NUC announcement reported a minimum CGPA of 2.5 and an initial focus on STEM and related disciplines. Confirm final eligibility with the official programme before applying.',
      application_url: null, deadline: null, status: 'unconfirmed',
      source_url: 'https://www.nuc.edu.ng/aliko-dangote-foundation-initiates-scholarship-for-nigerian-public-varsities/',
      source_name: 'National Universities Commission (NUC)', source_type: 'official',
      last_checked_at: now,
      verification_notes: 'Announcement found on the official NUC website. Do not treat as open: the announcement does not establish a confirmed application portal or deadline. Re-verify with the Foundation or participating universities.',
      discovered_at: now, updated_at: now,
      raw_excerpt: 'NUC announcement dated 4 September 2026; initiative scheduled to commence with the 2026/2027 session in October 2026.'
    });
}

module.exports = { seedKnownCurrentSessionRecord };
