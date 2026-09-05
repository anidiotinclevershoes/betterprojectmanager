# Part 2 — Primary Evidence: How Professional Wedding Planners Actually Work

Research date: 27 August 2026. All claims carry a source URL. Where no evidence was found, this
document says so explicitly rather than inferring.

## How to read this report

Every item in the evidence log is graded:

| Grade | Meaning |
| --- | --- |
| **Strong** | First-person practitioner speech, unprompted, specific, with a verifiable URL. Multiple independent instances, or one highly specific instance. |
| **Moderate** | First-person practitioner speech but single instance, or from an adjacent role (venue manager, event producer, DJ) rather than a wedding planner, or from a source with a commercial interest in the pain existing. |
| **Weak** | Second-hand, prescriptive ("you should document decisions" implies but does not evidence the problem), client-side rather than planner-side, or from a low-sample source. |
| **None** | Searched, found nothing. Stated as such. |

**A word on source quality.** A large share of what surfaces for these queries is AI-generated SEO
content published by vendors selling wedding-planner software (`wedypro.ai`, `osforyour.business`,
`bodabliss.com`, `gitnux.org`, `eventplanning.com`, `llcforge.com`, `pulserevops.com`,
`aiproductivity.ai`, and the marketing sites of InvitiApp, Mitra Planner, WeddingFlow, Nuptial and
Paige). These pages assert the exact pains this brief asks about — spreadsheet sprawl, WhatsApp
fragmentation, paying for five tools — in confident, quantified language with no methodology. **None
of it is used as evidence in this report.** It is catalogued in §D.4 as a market-signal artefact
only: the fact that a dozen products describe the same pain tells you what founders believe, not
what planners experience.

## Method and access limitations

Read this before trusting any absence of evidence below.

- **Reddit blocks this network directly** (403 on `reddit.com`, `old.reddit.com`, and the JSON API,
  including through a real browser). Evidence was gathered through the open-source Redlib mirror
  `safereddit.com`, which proxies live Reddit. Canonical `reddit.com` URLs are cited throughout;
  they are correct but may not be fetchable from a datacentre IP.
- **Capterra, G2, GetApp and Software Advice are all behind Cloudflare bot protection** and returned
  403 to every method attempted (direct fetch, headless browser, reader proxy). **The brief
  specifically asked for 2–3 star reviews of HoneyBook, Aisle Planner, Dubsado and Planning Pod from
  these sites, and I could not obtain them.** Trustpilot was reachable and is used instead, but its
  sample for three of the four products is tiny (see §A.6).
- **Facebook group discussions were not obtained.** The relevant groups are closed, and nothing
  usable surfaced in public indexes. One Trustpilot reviewer points at them as the venue where this
  conversation actually happens (§A.6), which is a finding in itself.
- **YouTube "day in the life" / "wedding planner workflow" videos were not mined.** Transcripts were
  not retrieved within this pass. This is an open gap, not a negative finding.
- **BLS OES data was not retrievable** (bls.gov actively blocks automated access).
- Two of the strongest practitioner sources in §A are **podcast transcripts published as blog
  posts** by planner educators. They are first-person and specific, but both authors sell training
  to planners and one uses an affiliate link for the tool she recommends. Graded accordingly.

## Structural finding, stated up front

**There is no large, active, public professional wedding-planner community on the open internet.**
This shaped everything below and is itself the most reliable finding in the report.

| Subreddit | State as of 27 Aug 2026 |
| --- | --- |
| `r/weddingindustry` | Effectively dead. One post, from June 2013. |
| `r/weddingplanners` | Empty. No posts returned. |
| `r/eventplanning` | Dead. Top all-time posts are cakeday bots and spam listings. |
| `r/WeddingProfessionals` | Brand new (welcome post 10 days old). Active but tiny — top posts score 2–4. |
| `r/EventPlanners` | Modestly active. Top post all-time: 313. Most planner threads: 10–25. |
| `r/EventProduction` | The most active adjacent pro community. Top posts 60–130. Corporate/live events, not weddings. |
| `r/BigBudgetBrides` | Client-side, but planners post there with `Vendor: Planning & Design` flair and give unusually detailed operational answers. |

Sources: [r/weddingindustry](https://www.reddit.com/r/weddingindustry/),
[r/WeddingProfessionals](https://www.reddit.com/r/WeddingProfessionals/new/),
[r/EventPlanners](https://www.reddit.com/r/EventPlanners/top/?t=all),
[r/EventProduction](https://www.reddit.com/r/EventProduction/top/?t=all).

Two consequences. First, the richest planner-on-planner operational detail in this report comes from
`r/BigBudgetBrides` — planners answering a *client's* question about what good organisation looks
like, which produces unusually concrete descriptions of their real stacks. Second, sample sizes are
small everywhere. Nothing here should be read as quantitative.

---

# A. Verbatim evidence log, by pain theme

## A.1 Spreadsheet sprawl / Google Sheets as the real system of record

**Grade: Strong.** This is the best-evidenced pain in the report. Multiple independent professional
planners, unprompted, describe Google Sheets and Google Drive as their actual system of record — not
as a legacy embarrassment but as a deliberate choice, including by planners with $15k minimums.

> "Personally I've been using a shared Google Drive with all my couples, and have created an
> extensive Google Sheets to follow everything along. I figured it was something most people already
> have access to and experience with, so the learning curve is short/ nonexistent. I want to look
> more professional than just using Google Sheets, and attract higher clientele, but I feel like if
> I signed on with an event planner and got forced to use something new, I'd be pretty stressed."
> — u/No_Leader_3640, wedding planner, r/EventPlanners, 5 Jan 2026.
> <https://www.reddit.com/r/EventPlanners/comments/1q4rux5/what_portals_do_you_use/>

> "I also just use google sheets, because I find it's the best way to loop in the wedding party and
> other vendors. I like that it updates in real time so if I have to edit the timeline day of, it
> auto updates for all of the vendors too."
> — u/LeighBee212, same thread.

> "We have a spreadsheet for each client (that clients can access) with the planning checklist and
> due dates, timeline, booked vendor info, wedding party & VIP info, ceremony order, song list,
> packing list, and photo list. A separate spreadsheet for budget, which tracks expected and actual
> spend, payments and due dates... Internally, we use Asana for project management... Our pricing
> minimum is $15k for reference."
> — u/aislelesstraveled, flaired `Vendor: Planning & Design`, r/BigBudgetBrides, ~21 Aug 2026.
> <https://www.reddit.com/r/BigBudgetBrides/comments/1vtws1m/wedding_planner_organizational_management_norms/>

> "I used to use Aisle planner but google docs is more user friendly not only for me but for clients
> too."
> — u/erikasandovalevents, `Vendor: Planning & Design`, same thread ("I start at $15k with
> percentage pricing as a comparison").

> "The planners I know create a shared Google Drive for their clients. It's all customized and looks
> super professional. The clients love it because it's easy and familiar for them and the planners
> love it because everything is in one spot for everyone who needs to reference it."
> — u/singlemomtothree, r/EventPlanners, 6 Jan 2026.

> "For the past 20 years I've used excel to arrange my events."
> — u/krissyface, r/EventPlanners, 22 Feb 2026.
> <https://www.reddit.com/r/EventPlanners/comments/1rb3g2o/how_do_you_manage_large_scale_events_without/>

> "HONEYBOOK! literally our right hand. We also keep track of everything in terms of budget on
> excel."
> — u/redlc, NYC event planner and designer with two business partners, r/EventPlanners, 10 Nov 2025.
> <https://www.reddit.com/r/EventPlanners/comments/1oj4vw2/worst_part_of_being_an_event_planner/>

The important nuance, and it cuts against the obvious product conclusion: **the spreadsheet is not
purely a pain.** `LeighBee212` chooses Sheets *because* real-time propagation to vendors is exactly
what she needs on the day. `No_Leader_3640` chooses it because it has no learning curve for clients.
The dissatisfaction they express is about **status signalling to high-end clients**, not about the
tool failing them operationally. One planner in the same thread who did move to a dedicated platform
gave the opposite reason:

> "I am very adept at building Google sheets, can automate everything/write my own code to have it
> automated, but choose not to because I do not want to maintain my own software ecosystem. Also, to
> track everything across all of our clients manually, was really, really frustrating."
> — u/oso_events, r/EventPlanners, 6 Jan 2026.

That last quote is the sharpest articulation of the real spreadsheet pain found anywhere in this
research: **per-client spreadsheets work; the cross-client view is what breaks.**

## A.2 Paying for and maintaining multiple products at once

**Grade: Strong.** Directly evidenced, repeatedly, with named stacks.

> "Im a wedding planner and have been using HB for a couple years now and I haven't implemented any
> optimizations or automations. Basically using it to send contracts and receive payments. Is there
> someone I can hire to help me build my back end so I'm not using multiple CRMs. **Currently using
> Honeybook, Aisle planner and Google Docs.**"
> — u/PlannedbyKD, wedding planner, r/HoneyBook_Official, 2 Jun 2026.
> <https://www.reddit.com/r/HoneyBook_Official/comments/1tuxmx2/set_up_and_optimizing_hb/>

> "I use Dubsado for proposal / invoicing / questionnaires. It's the task tracking and 'client
> portal' I'm falling short on."
> — u/No_Leader_3640, r/EventPlanners, 5 Jan 2026.

> "I personally love and use aisle planner for client-facing wedding planning while our team uses
> asana for internal tasks, etc."
> — u/caitlinmevents, `Vendor: Planning & Design`, r/BigBudgetBrides, 1 Jul 2026.
> <https://www.reddit.com/r/BigBudgetBrides/comments/1uk8iav/aisle_planner_vs_asana/>

> "I'm a planner and I hate Aisle Planner. I also use Asana along with Google spreadsheets and a
> floor plan/seating chart software with my clients."
> — u/aislelesstraveled, same thread.

> "I currently use HoneyBook as a CRM, but want to use some sort of spreadsheet for budget tracking."
> — u/Interesting_Soft8827, new planner/coordinator, r/EventPlanners, ~5 Aug 2026.
> <https://www.reddit.com/r/EventPlanners/comments/1vg6uxi/wedding_planner_necessities/>

> "My wife is a wedding planner and event styler, so her team needs to use G Suite for collaboration
> **and 10 other apps** to perform their day-to-day work."
> — u/mauriciolazo, r/selfhosted, 5 Aug 2020 (311 upvotes). Second-hand and six years old, so
> **Moderate** on its own, but consistent with everything above.
> <https://www.reddit.com/r/selfhosted/comments/i4a95b/thank_you_selfhosters_self_hosting_10_apps_at/>

**Pattern worth naming:** the recurring stack is a *sales/money* tool (HoneyBook or Dubsado) plus a
*planning/logistics* tool (Aisle Planner) plus a *generic workspace* (Google Docs/Sheets/Drive or
Asana). Nobody described a single system. The `PlannedbyKD` post is the cleanest statement of the
motive — she is not shopping for features, she wants to stop running two CRMs.

**Cost is a live complaint, and verifiable.** Aisle Planner's own published pricing scales by active
project count: $49.99/mo sales-only, $69.99/mo up to 15 projects, $109.99/mo for 16–25, $164.99/mo
for 26–50, $229.99/mo for 51–100
([aisleplanner.com/pricing](https://www.aisleplanner.com/pricing), accessed 27 Aug 2026). Because
planner capacity is measured in concurrent projects (§B.1), the pricing curve bites exactly as a
planner grows.

> "I've been eyeing Aisle Planner, but am always shocked by the pricing structure."
> — u/No_Leader_3640, r/EventPlanners, 6 Jan 2026.

> "It's definitely so expensive for what it is."
> — u/oso_events (an Aisle Planner user), same thread.

## A.3 Channel fragmentation: email / text / WhatsApp / Instagram DMs

**Grade: Strong for the general phenomenon; Moderate specifically for WhatsApp.**

The single best quote comes from a planner explaining why she left the general-purpose stack:

> "I prefer to have everything for our clients and team in one place because it's more intuitive
> than **email + texting + drive + a floor plan software**."
> — u/oso_events, r/EventPlanners, 6 Jan 2026.

> "Between Instagram, texts, email, contracts, invoices, calendars and actual event details, what
> part of your workflow drives you the most crazy?"
> — u/Mysterious-Kiwi-8859 opening a thread in r/WeddingProfessionals, ~13 Aug 2026. The framing is
> itself evidence that a practitioner considers this the obvious axis of pain.
> <https://www.reddit.com/r/WeddingProfessionals/comments/1vnpy17/event_vendors_what_part_of_your_workflow_is_way/>

On WhatsApp specifically, the clearest statement comes from someone who is **not** a professional —
a person "roped into" a large event — so grade it **Moderate**, but it is vivid and the professional
replies in the thread validate rather than correct it:

> "vendors all operate on completely different communication styles, some email, some WhatsApp, some
> call, some just… disappear until the week of the event."
> ...
> "ngl excel would work if not all of my vendors msging us on differnet platforms. i was literally
> looped into at least 20+ or groupchats emails that didn't really require me to be there..."
> — u/jayce_the_builder, r/EventPlanners, 21–23 Feb 2026.
> <https://www.reddit.com/r/EventPlanners/comments/1rb3g2o/how_do_you_manage_large_scale_events_without/>

Professional replies in that thread treat channel discipline as a core competence:

> "What often helped me was forcing structure on communication. **One source of truth. One recap
> email after calls. Deadlines written down, not assumed.** If someone wants to text or WhatsApp,
> fine but decisions get documented in the master plan. If necessary, remind that vendor of the
> 'preferred/official' communication channel."
> — u/im4it2, r/EventPlanners, 24 Feb 2026.

> "The part that fries your brain isn't the tasks. **It's the context switching.** One minute you're
> solving catering counts, next you're mediating between AV and a speaker, then you're answering the
> same vendor question for the third time. Large events feel chaotic because complexity multiplies,
> it doesn't add. Ten vendors isn't twice as hard as five but it's exponential because of the
> communication paths between them."
> — u/im4it2, same thread.

> "Yes - I'm constantly having to adjust my approach/communication style based on who I'm talking to.
> It's super annoying because it's never reciprocated."
> — u/Exotic_Gazelle_1000, same thread, 24 Feb 2026.

**Instagram DMs are a real and contested channel.** From the client side:

> "Vendor recommendations come as **Instagram DMs with no context** (pricing, availability, why she's
> suggesting them) rather than an email or note."
> — u/Fine_Carrot_506, describing a $16k full-service planner, r/BigBudgetBrides, ~21 Aug 2026.
> <https://www.reddit.com/r/BigBudgetBrides/comments/1vtws1m/wedding_planner_organizational_management_norms/>

Two planners in the replies confirm DMs are in use but police the boundary:

> "I only ever DM our couples if we're in an exploratory phase (e.g., thoughts on this style of
> photography vs this other one)."
> — u/michelleollama, `Vendor: Planning & Design`.

> "Some of my brides and I do text and DM each other on instagram but that would never be the way to
> officially send them recommendations. ...and the instagram DM's sent to you for recommendations….im
> dying at just the thought of doing that!"
> — u/erikasandovalevents, `Vendor: Planning & Design`.

## A.4 Duplicate data entry across systems

**Grade: Moderate.** One outstanding quote, from an adjacent role. I did not find a wedding planner
saying this in their own words, despite targeted searching.

> "Though the system I have in place for recording payments and dates is tedious, it works like a
> system of checks and balances. **Everything is recorded in 3 different places and again in a place
> that marks it was recorded in all 3 places.**"
> — u/rosetintedmonocle, flaired `Venue Manager`, replying to "what part of your workflow is way more
> complicated than it should be?", r/WeddingProfessionals, ~14 Aug 2026.
> <https://www.reddit.com/r/WeddingProfessionals/comments/1vnpy17/event_vendors_what_part_of_your_workflow_is_way/>

Note what this person is saying, because it is easy to misread as pure pain: they call it "tedious"
but describe it as a deliberate **control**, not an accident. Any product that removes the
triple-entry has to replace the assurance it provides.

Supporting, weaker, from a Trustpilot HoneyBook review by a wedding vendor — a *lookup* burden rather
than a re-entry burden, but the same root cause of one fact living in two places:

> "if a client pays by credit card, you cannot easily see the actual net payment received from within
> that client's project. You have to leave the project, go into the Finance section, and then locate
> the transaction there. There isn't even a practical search field for this, so you may find yourself
> scrolling through transactions and matching dates and client names just to determine the amount you
> actually received after fees."
> — reviewer "TM", 27 Aug 2026, <https://www.trustpilot.com/review/honeybook.com>

## A.5 Forgotten or disputed verbal decisions ("but we agreed on the call…")

**Grade: Strong — but on the strength of one exceptionally specific first-person account, plus
several corroborating prescriptions.** Discount slightly: the author sells a planner training
programme and uses an affiliate link for the tool in question.

This is the single most on-point piece of evidence found in the entire research pass. Desirée Adams
is a wedding planner and educator (podcast: *The Planner's Edit*, previously *Ask the Planner*):

> "A while back, I had a client who was surprised by the cost of florals during the planning process.
> My immediate reaction was **how did this happen? I knew we had talked about the budget. I knew we
> had reviewed the numbers together on a call months earlier.**"
> ...
> "At the full-service level, you're having detailed conversations about budget, scope, vision, and
> expectations months — sometimes over a year — before the wedding day. A lot gets discussed. **A lot
> gets decided. And couples, understandably, don't always remember the specifics of what was said six
> months ago.** Having a searchable record of those conversations protects you, your client
> relationship, and the integrity of your process when questions come up — **because they will come
> up.**"
> — Desirée Adams, 6 Apr 2026.
> <https://desireeadams.co/2026/04/06/wedding-inquiry-management/>

Corroborating, from event planners giving advice (prescriptive, so **Weak** individually — a rule
implies a failure mode but does not evidence its frequency):

> "Communication breakdowns. Half of event stress comes from unclear communication between teams,
> vendors, or leadership. Overcommunicate. **Document decisions.**"
> — u/EventPlannerRyan, r/EventPlanners, 30 Oct 2025.
> <https://www.reddit.com/r/EventPlanners/comments/1oj4vw2/worst_part_of_being_an_event_planner/>

> "If they request items or attendance that will result in an overage, it needs to be communicated
> and **approved in writing**."
> — u/Far_Presentation6337, same thread, 31 Oct 2025.

> "Deadlines written down, not assumed."
> — u/im4it2, r/EventPlanners, 24 Feb 2026.

## A.6 Note-taking habits during client calls

**Grade: Strong for what planners *do*; Strong for the claim that AI note-taking is not yet
mainstream among planners; the two best sources disagree on adoption.**

The habit itself — typed notes into a doc, and a recap email after every meeting — is directly
evidenced:

> "**Notes are kept in Google docs and sent via email after every meeting**, and are also accessable
> to our clients in their Google drive folder."
> — u/aislelesstraveled, `Vendor: Planning & Design`, $15k minimum, r/BigBudgetBrides, ~21 Aug 2026.

> "my planner has a custom timeline/checklist spreadsheet that she built, **running meeting notes
> doc**, contracts are in folders, etc all of which we can access."
> — u/VoiceOpen8350, client, same thread.

> "One recap email after calls."
> — u/im4it2, r/EventPlanners, 24 Feb 2026.

And the client-side expectation that meeting notes are a deliverable:

> "Should there be a master spreadsheet with timeline, checklist built by her, **meeting notes**, all
> contracts kept in one place?"
> — u/Fine_Carrot_506, r/BigBudgetBrides, ~21 Aug 2026.

On **AI note-takers**, the two best sources give directly conflicting readings of adoption, and I
cannot resolve which is right:

> "The fifth tool in my inquiry process is one **I guarantee most planners aren't using**... It's
> called Fathom. It's an AI note-taker that connects directly to Zoom or Google Meets... **Taking
> detailed notes during that conversation pulls your focus away from the very thing that converts.**"
> — Desirée Adams, 6 Apr 2026. <https://desireeadams.co/2026/04/06/wedding-inquiry-management/>

> "**a lot of my students have AI note takers joining their calls all the time.** If you're a wedding
> planner or you're somebody heavily in logistics... Being able to have an AI note taker like Fathom
> AI, which is what I use and recommend, attend your calls and provide summaries, to-do lists, tasks,
> even mail notes out after the call to parties involved, is such a game changer. But **not enough
> people are recognizing that these calls are a goldmine of information.** ... **You hang up and most
> of what's said is gone in an hour.**"
> — Candice Coppola, wedding planner turned educator/coach.
> <https://blog.candicecoppola.com/ai-for-wedding-pros/>

Both authors independently name **Fathom** as the tool. Both sell to planners. The honest read: AI
note-taking is being actively evangelised to planners by their educators in 2026, adoption is
somewhere between "most aren't" and "a lot of my students are", and **no neutral data on adoption was
found**.

**No evidence found** on paper vs typed vs recorded as a general habit split, on whether planners
record calls with couples' consent as standard practice, or on note-taking during *vendor* calls as
distinct from client calls.

## A.7 Difficulty preparing for a call / re-reading threads to remember where things stand

**Grade: Moderate.** Evidenced clearly by one planner educator; nothing found on Reddit.

> "That information feeds directly back into how you personalize the proposal that follows. **You
> show up to that proposal having remembered everything, because it was all right there waiting for
> you.**"
> ...
> "...not toward manually tracking follow-ups or **trying to remember what was said on a call three
> months ago**."
> — Desirée Adams, 6 Apr 2026.

Adjacent, from event production — a request for exactly this capability, phrased as a complaint that
it does not exist (see also §A.12, the same quote read as an AI-attitude data point):

> "**Why I'm still doing event specs manually and I can't forward all my documents to AI to create
> deadlines and a project plan off of contracts is beyond me.**"
> — u/FittestEventProf, r/EventProduction, 27 May 2026.
> <https://www.reddit.com/r/EventProduction/comments/1to09wd/are_there_any_other_antiai_events_people_out_there/>

## A.8 Timeline maintenance burden

**Grade: Moderate.** Real, and clearly a recurring cycle, but I found no planner describing it as
*painful* — they describe it as the job.

> "**Timelines: monthly timelines are updated every month.** Wedding timeline for the wedding and/or
> weekend at about 3-4 months prior is when I start building it."
> — u/erikasandovalevents, `Vendor: Planning & Design`, r/BigBudgetBrides, ~21 Aug 2026.

> "if I have to **edit the timeline day of**, it auto updates for all of the vendors too."
> — u/LeighBee212, r/EventPlanners, 5 Jan 2026. Evidence that same-day timeline edits are expected
> and that propagation to vendors is the requirement being solved for.

> "Timelines always lie. Everything takes longer than you think: vendor responses, approvals,
> shipping, setup. Build in buffer time for everything."
> — u/EventPlannerRyan, r/EventPlanners, 30 Oct 2025.

> "You become the hero when YOUR timelines don't lie! So yes, definitely, always, build in
> buffer…regardless of what vendors tell you! AND…if you're responsible for moving people (wedding
> parties to vehicles, guests to different spaces, etc), double or triple the time you think it
> should take!"
> — u/Ok-Active-7023, same thread, 30 Oct 2025.

**No evidence found** for the specific claim that wedding-day timelines are revised many times in the
final weeks, or for any count of revisions. That is a plausible-sounding claim I could not
substantiate (§C).

## A.9 Supplier/vendor changes, lateness and cancellations

**Grade: Strong for vendor unreliability and last-minute changes. Weak for outright cancellation.**

The most specific account, and the one that best illustrates the compounding effect:

> "Just last week I had an AV vendor I've been working with for months. **We've been chasing him for
> two weeks for what was hopefully the final version of the quote**, but I never take that for
> granted. He got it to us **24 hours before start** and then needed a signature and payment but my
> client who was on the road. He got pretty snippy with me about not having a sign off on, but I was
> like my guy, you assumed, even though you're in this industry that it would be all good to go. I
> should never assume that. **Always assume one more change or one more question.**"
> — u/LouiseWH, r/EventPlanners, 22 Feb 2026.
> <https://www.reddit.com/r/EventPlanners/comments/1rb3g2o/how_do_you_manage_large_scale_events_without/>

> "Last minute changes + unexpected fires (literally all the time, **doesnt matter how much you plan
> or prep**)... **Vendors drop the ball.** Weather doesn't cooperate. Decor breaks."
> — u/redlc, NYC planner/designer, r/EventPlanners, 29 Oct 2025.

> "Vendors/ service providers who don't return emails and phone calls."
> — u/dirtynerdyinkedcurvy, same thread, 29 Oct 2025, answering "worst part of being an event
> planner".

> "The most annoying side is coordination - **how to get all the info and data from all the vendors,
> bands, partners, etc that you need to actually plan the damn thing.** I don't think there's a
> computer science solution to that, but that's what grates me the most."
> — u/Partiallyfermented, r/EventProduction, 7 Apr 2025. Note the explicit scepticism that software
> can fix it.
> <https://www.reddit.com/r/EventProduction/comments/1jtai4y/event_planners_whats_the_most_frustrating_part_of/>

> "90% of being an event planner is being able to pivot and make decisions on the fly when the
> original plan and all your backup plans don't work and you have literally five seconds to decide."
> — u/probably_preoccupied, r/EventPlanners, 21 Feb 2026 (23 upvotes, top comment).

On planner-side cancellation, the only concrete instance found is client-side and from a legal-advice
crosspost — a day-of coordinator who cancelled the day before the wedding
([r/BestofRedditorUpdates, 5 Oct 2025](https://www.reddit.com/r/BestofRedditorUpdates/comments/1nyeaab/wedding_day_of_coordinator_cancelled_the_day/)).
**Grade: Weak** as evidence of a systemic pain; it is one anecdote about one bad actor.

## A.10 Information going out of date

**Grade: Moderate.** Best evidenced from the client side, describing planner failures.

> "the shared Google Drive with contracts is **rarely updated**."
> — u/Fine_Carrot_506, on a $16k full-service planner, r/BigBudgetBrides, ~21 Aug 2026.

> "my previous planner was around 18.5k and also used aisleplanner. **she was not great at updating
> things through AP and the checklist was very generic.** we parted ways for a number of reasons, but
> the number one thing was **lack of structure and communication**."
> — u/suitablegouda, same thread.

Two independent clients at the $16k–$18.5k price point describe the same failure: the planner has the
tool, and the tool is stale. That is a meaningful signal — **the binding constraint is not tool
availability, it is the cost of keeping a tool current.** A third planner in the same thread named
the pattern:

> "Every planner is different and it sounds like yours is **more vibes than processes**."
> — u/michelleollama, `Vendor: Planning & Design`.

A Trustpilot HoneyBook reviewer gestures at the same thing from the product side, though the review
text is truncated in the public listing:

> "My major issues are the planning process. This was originally developed by photographers is my
> understanding and for planning purposes. But **the forms are not livi**[ng]…"
> — reviewer "Thomas Hinds", 20 Jun 2026, <https://www.trustpilot.com/review/honeybook.com>

## A.11 Wedding-day surprises caused by something not being recorded

**Grade: None → Weak.** I looked for this specifically and did not find it.

A thread titled exactly "What's the wildest last minute curveball you've had thrown at you on a
wedding day?" was posted in r/WeddingProfessionals on ~16 Aug 2026 and received **zero comments**
([link](https://www.reddit.com/r/WeddingProfessionals/comments/1vpmhwa/whats_the_wildest_last_minute_curveball_youve_had/)).
The only content is the OP's own examples, and he is a DJ, and his examples are *late changes*, not
*unrecorded information*:

> "As a DJ I've had entrance songs changed five minutes before the doors opened, first dance swapped
> mid cocktail hour, a best man hand me a completely different toast order right as I'm about to
> introduce him."
> — u/DjDanFudim.

The closest thing to the intended claim is a general statement about memory load, not a day-of
failure:

> "There are too many steps in a GREAT event planner, **it's impossible to remember it all when you
> are juggling a million clients at once.** CREATE a process, timelines, templates, pricing
> strategies, and stick to them."
> — u/redlc, r/EventPlanners, 29 Oct 2025.

**I found no planner describing a wedding-day failure caused specifically by something not being
written down.** This is one of the weakest-evidenced items in the brief and should be treated as a
hypothesis, not a finding.

## A.12 What planners and event pros say about AI

**Grade: Strong.** Rich, polarised, and unusually specific about *where* AI is and is not wanted.

### Hostility and fatigue

> "I've recently been to an industry event where **every talk featured AI, every event tech offering
> had AI bolted on to it, and nobody really had any idea why.** It's crazy. But it got me
> wondering...Am I the only one who thinks AI is overblown and that what it can do in no way helps
> forward the events industry, and if anything is holding it back?"
> — u/iammerelyhere, r/EventProduction, 26 May 2026. **59 upvotes, 90% upvoted, 58 comments** — the
> highest-engagement AI thread found in any events community.
> <https://www.reddit.com/r/EventProduction/comments/1to09wd/are_there_any_other_antiai_events_people_out_there/>

> "It reminds me of when block chain was in every goddamn seminar for like 18 months straight. At
> some point you just have to decide to wait these things out."
> — u/NuncProFunc, same thread.

> "AI is absolutely horrible for the planet and not only is a job killer but also raises electricity
> and water costs for the general public... **I for one will not be using it and will not be
> partnering with others that do.**"
> — u/Mindless-Act1887, same thread.

> "I hate it for anything customer facing. These days most savvy people can recognize AI from a mile
> away and **it looks extremely lazy**."
> — u/livvybugg, same thread.

> "I've noticed planners stop making mood boards and start sending me ai generated mockups." …
> "Annoying bc ai doesn't factor construction techniques when spitting out images. **Also definitely
> feels lazy in the planners' part.**"
> — u/a_electrum, set/booth builder, same thread. Evidence that AI use by planners is now visible to,
> and resented by, their supplier network.

> "I've already added a clause to my contract that elaborates how **no aspect of my work can be put
> through AI for literally any reason.**"
> — anonymous respondent, 2025 Wedding Pro Survey (500+ wedding professionals).
> <https://saradoesseo.com/wedding-pro-survey-2025/>

### Conditional enthusiasm — and it is remarkably specific

The pro-AI voices converge on one distinction: **back-office operations yes, client-facing output
no.**

> "Where I do see real value... is **backend ops for organizers, not attendee-facing fluff.** Things
> like: Auto-resending confirmation emails to speakers · Bulk check-in for specific company guests ·
> Pulling lists like 'all people who haven't received their certificate yet'. All by chatting to an
> AI agent and not having to login to systems. **That stuff eats up planner time during live
> events.** ... So: AI for ops automation = yes. AI for 'attendee experience' gimmicks = mostly
> counterproductive and [yawn]"
> — u/zeeris852, r/EventProduction, 27 May 2026.

> "I look at AI as a tool. **Don't rely on it to do anything by itself**, but to help me out when I
> need it."
> — u/Level_Percentage_419, same thread.

> "I think the day to day, finding an actual updated solution to CRMs. **Been experimenting with AI
> quite a bit. Not for vibe coding, but actual time saving. There's varying degrees of efficacy
> there.**"
> — u/kennyfiesta, r/WeddingProfessionals, ~18 Aug 2026.
> <https://www.reddit.com/r/WeddingProfessionals/comments/1vrb6pv/whats_actually_stuck_in_your_business_right_now/>

### The trust condition — the most product-relevant finding in this section

Two independent people state the same requirement: **AI output must be checkable against the
source.**

> "I personally would not trust an AI chat bot to pull accurate information **unless it linked me to
> the appropriate document/receipt/portal page so I can double check manually**."
> — u/dzzi, r/EventProduction, 7 Apr 2025.
> <https://www.reddit.com/r/EventProduction/comments/1jtai4y/event_planners_whats_the_most_frustrating_part_of/>

> "**Often there's missing or incomplete data returned and trying to spot that is a challenge.** I
> may be old fashioned but even if the normal interfaces are a little bit harder to navigate, **I can
> at least be assured that the data is correct.**"
> — u/iammerelyhere, r/EventProduction, 27 May 2026.

### Frustration that the *useful* AI product does not exist

> "**Why I'm still doing event specs manually and I can't forward all my documents to AI to create
> deadlines and a project plan off of contracts is beyond me. Until an actual PLANNER and not just
> some tech company trying to sell to planners decides to figure out how to really make this work…I'm
> not hopeful.**"
> — u/FittestEventProf, r/EventProduction, 27 May 2026.

> "It seems like these event tech companies are **adding AI because the venture capital firms told
> them too** and they add it in ways that make no sense for their products. **All while basic
> functionality doesn't work the way it should.**"
> — u/dylanalter2, r/EventProduction, 3 Feb 2026.
> <https://www.reddit.com/r/EventProduction/comments/1o6fpwy/whats_the_most_overhyped_piece_of_event_tech/>

### AI as a threat to the planner's value proposition

This is the planner-educator framing, and it is the sharpest version of the argument:

> "Couples are using AI just like we are. And they're using it to do the same things we're using it
> to do... **your checklists and all that other bullshit are no longer as valuable as they used to
> be.** Specifically for anybody who offers that kind of stuff, wedding planning adjacent tasks..."
> ...
> "AI content is everywhere and this is feeding into our trust recession... everybody is sounding the
> same and it's all the same chat GPT song and dance. **It immediately signals low effort.**"
> ...
> "Your role is to help clients edit, decide, and commit. And more more, **they're going to lean on
> you for the human side of the business that AI just cannot replicate.**"
> — Candice Coppola, "The State of the Wedding Industry in 2026".
> <https://blog.candicecoppola.com/state-of-the-wedding-industry/>

From the same 500+ pro survey:

> "**AI renderings are skewing expectations and budget alignment.** So, meeting new standards and
> setting investment expectations and the emotions that go along with that is really challenging."

> "Brides will move towards using AI to plan their weddings. **I have a healthy relationship with AI
> and use it everyday in my business and KNOW that the tools won't replace our industry** – it's just
> the illusion for brides that it could."

> "I think AI is going to be a massive disruption. Couples are going to think they can do a lot of
> the artwork themselves with AI and it's going to lead to a lot of ugly disjointed work."
> — <https://saradoesseo.com/wedding-pro-survey-2025/>

### Net read on AI sentiment

Not enthusiasm, not fear — **exhaustion with AI marketing, combined with a specific and unmet appetite
for back-office automation, gated on verifiability.** The single most valuable sentence for anyone
building here is `FittestEventProf`'s: the demand is explicit, and the stated reason for pessimism is
that products are built by "some tech company trying to sell to planners" rather than by a planner.

## A.13 Poor mobile capture during venue visits / on the road

**Grade: None.** I searched specifically for this and found nothing.

Searches for wedding planners discussing note capture during site visits or venue walkthroughs
returned only unrelated content. The one adjacent data point is a client-side mention that a planner
was unreachable for signature because they were "on the road" (u/LouiseWH, §A.9), and a passing
mention in AI-generated vendor content about "weak offline support during venue visits with poor
signal" (aiproductivity.ai) — **which is vendor marketing copy, not practitioner evidence, and is not
counted.**

**If mobile capture is a load-bearing assumption for a product, it is currently unevidenced and needs
primary research (interviews or diary studies).**

## A.14 Broader operational pain: burnout, admin load, and process as survival

**Grade: Strong.** Not one of the numbered themes, but it recurred so consistently it would be
dishonest to omit.

The 2025 Wedding Pro Survey (500+ wedding professionals, distributed via educator networks, anonymous,
fielded ~Oct–Dec 2025; planners and photographers were **over half** of respondents; **over 60% had
6+ years in business**) reports burnout and overwhelm as the top self-reported challenge:

> "Having the time to do IT ALL. I want to put more effort into marketing, photo shoots, etc but **I'm
> bogged down with the day to day answering emails, etc.**"

> "**Drowning in my workload and feeling like I can't catch a break.**"

> "Having enough time to do it all – the networking, social media, book keeping, and **client comms
> are already more than I can do well**, let alone make and execute plans for growth next year."

> "keeping all the plates spinning! social media, keeping up with AI changes, website, advertising,
> equipment, trying not to come off as burnt out when I am."
> — <https://saradoesseo.com/wedding-pro-survey-2025/>

The same survey reports that **more than half of respondents are prioritising "workflows, automations,
and sustainable operations" for 2026**, second only to marketing (~80%). That is the strongest
quantitative signal in this report that systems investment is on planners' agenda — with the caveat
that it is a self-selected, educator-network sample.

And the most-upvoted structural advice found anywhere:

> "**YOUR PROCESS and OPERATIONS IS THE KEY TO YOUR BUSINESS-- Without a SET process, you will burn.**
> There are too many steps in a GREAT event planner, it's impossible to remember it all when you are
> juggling a million clients at once."
> — u/redlc, r/EventPlanners, 29 Oct 2025 (27 upvotes, top comment).

## A.15 Software review evidence (2–3 star and below)

**Grade: Moderate for HoneyBook; Weak for the rest — the samples are tiny.**

Trustpilot volumes as at 27 Aug 2026: HoneyBook **704 reviews** (4.0; 10% 1-star, 8% 2-star, 11%
3-star), Dubsado **1 review**, aisleplanner.com **2 reviews**, planningpod.com **1 review**. Only
HoneyBook has a usable sample, and its profile is claimed with a paid Trustpilot subscription and the
company "invites their customers to review", which biases the distribution upward.

**HoneyBook** — the most substantive negative review is from a wedding vendor and is directly about
planner workflow:

> "I'm a wedding vendor, and **I've now had multiple planners tell me they actively dislike working
> with vendors who use HoneyBook because of how cumbersome the client/project structure is. Every job
> requires a new 'project,' even when you're working with the same planner repeatedly. From the
> planner's side, this can result in separate projects and logins for different vendors using
> HoneyBook.** It becomes unnecessarily confusing and frustrating."
> ...
> "there are **little workflow issues like this everywhere.** Individually they may sound minor, but
> when you use the platform every day to run a business, **they add up to an incredibly frustrating
> experience.**"
> — reviewer "TM", 27 Aug 2026, <https://www.trustpilot.com/review/honeybook.com>

That same reviewer alleges HoneyBook removed their troubleshooting post from the official Facebook
group — relevant mainly because it suggests the candid conversation happens in closed groups this
research could not reach.

On pricing and AI direction, from the HoneyBook subreddit:

> "I don't use the automations anymore because now they're more expensive, which was part of the whole
> reason I got HB to begin with. **I'll be switching to another CRM because HB keeps implementing more
> and more AI but I can't automate an email I wrote myself to respond to new inquiries?** What good is
> the CRM if I have to sit there and babysit it and still answer everything manually?... **I'm paying
> almost $40 a month to process payments that they still take a 2%+ chunk out of and send a glorified
> Adobe Acrobat file to someone? Greed isn't a good look, Honeybook.**"
> — u/Adorable_Site5277, r/HoneyBook_Official, 18 Jun 2026.
> <https://www.reddit.com/r/HoneyBook_Official/comments/1tuxmx2/set_up_and_optimizing_hb/>

**Planning Pod** — the single Trustpilot review is a 1-star from a venue, and it is severe:

> "**We have had constant issues where communications from one client will automatically get uploaded
> into another clients portal** which is completely unprofessional and makes us a venue look awful.
> Having clients ask why another bride's messages are showing in their portal is embarrassing."
> ...
> "**I'm literally losing money because I'm spending so much time trying to navigate the clunky UI**,
> the terrible customer service and the lack of thought behind the product. We have been sitting as a
> team almost every single day complaining to each other about how much we hate PP."
> ...
> "**Uplifting to another program during wedding season** because the people I put money and my trust
> into have simply said, go pound salt."
> ...
> "Think I'm crazy - **look up PlanningPod on the wedding groups** and you will also be met with the
> same concern."
> — reviewer "Daryl Licursi", 11 Mar 2026, <https://www.trustpilot.com/review/planningpod.com>

Note the migration timing problem: switching tools mid-season is itself a cost, which raises
switching friction for any new entrant.

**Aisle Planner** — 2 Trustpilot reviews, both negative, both apparently from couples rather than
planners:

> "**Disorganized wedding planning platform with zero user friendliness.** Constant annoying email
> notifications and hard to communicate with planners."
> — reviewer "mik wat", 10 Sep 2025, <https://www.trustpilot.com/review/aisleplanner.com>

Planner sentiment on Aisle Planner is better captured on Reddit, and it is sharply split:

> "Oh also **Aisle Planner sucks**." / "I'm a planner and **I hate Aisle Planner**."
> — u/aislelesstraveled, `Vendor: Planning & Design`, r/BigBudgetBrides, Jul–Aug 2026.

> "We use Aisle Planner... It works really well for us and we go through a mini tutorial on our
> kick-off calls. **All of our clients prefer it to a spreadsheet.**"
> — u/oso_events, r/EventPlanners, 6 Jan 2026.

> "IMO, **Aisle Planner is definitely the superior program**, but I also say that *if* you're actually
> using it to capacity."
> — u/caitlinmevents, `Vendor: Planning & Design`, r/BigBudgetBrides, 1 Jul 2026.

**Dubsado** — 1 Trustpilot review, positive, from a non-planner. No usable negative evidence obtained.

---

# B. Industry and segment facts

Each row is graded for source quality. Treat anything marked *low-confidence* as directional only.

## B.1 How many weddings a planner handles per year

**This is the weakest-sourced item in the brief.** No industry body, census, or credible survey
publishes it. What exists is (a) one first-person planner blog and (b) a cloud of AI-generated SEO
content converging suspiciously on "15–30", which I do not trust and do not cite as fact.

**Primary practitioner statement (the only one found):**

> "A DJ, a photographer, a caterer, a videographer, a florist have multiple events a week, often
> ending up with well over 100 events a year. **I keep it real and attend to 10-12, sometimes 15
> weddings a year.** That's plenty! I want to make sure that I can keep the facts straight and **don't
> confuse my couples names or details** and manage to follow up on all of the many to dos."
> — Strings & Champagne Events (independent planner blog).
> <https://www.strings-champagne.com/blog/just-how-many-weddings-does-a-planner-manage>

Note that her stated reason for capping volume is **cognitive load and cross-client confusion** —
which is the same failure mode `oso_events` named in §A.1.

**Structural constraint, well-evidenced:** capacity is bounded by concurrent projects, not annual
throughput. Aisle Planner prices in bands of *active projects* (15 / 25 / 50 / 100), which is a
strong revealed-preference signal about how the market segments
([aisleplanner.com/pricing](https://www.aisleplanner.com/pricing)). A planner running 12-month
full-service engagements with 15 weddings a year is carrying ~15 live projects at once, at different
stages.

**Not substantiated:** any per-segment split (full-service vs partial vs month-of) from a credible
source. See §C.

## B.2 Planner fees by segment and region

| Market | Figure | Source & confidence |
| --- | --- | --- |
| **US — average spend on planner** | 4–5% of total wedding budget (line item in The Knot's budget breakdown) | The Knot 2026 Real Weddings Study, n=10,474 US couples married in 2025. **High confidence** for what couples spend. <https://www.theknot.com/content/wedding-budget-ways-to-save-money> |
| **US — planner minimums (self-reported)** | $15,000 minimum, stated independently by two planners; $30,000 wedding minimum stated by one NYC event firm | Reddit, first-person. **Moderate** — real quotes, n=3, self-selected high end. u/aislelesstraveled and u/erikasandovalevents ([thread](https://www.reddit.com/r/BigBudgetBrides/comments/1vtws1m/wedding_planner_organizational_management_norms/)); u/redlc "we are currently at 15K min for reg events and $30K min for weddings" ([thread](https://www.reddit.com/r/EventPlanners/comments/1oj4vw2/worst_part_of_being_an_event_planner/)) |
| **US — client paid $16,000 for full-service** | one data point | u/Fine_Carrot_506, r/BigBudgetBrides. **Weak** (n=1) |
| **US — client paid $18,500 for full-service** | one data point | u/suitablegouda, same thread. **Weak** (n=1) |
| **UK — average spend on wedding planner** | **£1,543** (2026 report); £1,892 (2025); £2,436 (earlier year cited in same article) | Bridebook UK Wedding Report, ~7,000 UK couples. **High confidence** as a survey mean, but note it averages across all weddings including those using a planner only for partial work. <https://bridebook.com/uk/article/how-much-does-a-wedding-planner-cost> |
| **Ireland — average spend on wedding planner** | **€2,054** (Dec 2025 data), up from €2,018 | weddingsonline.ie Irish Wedding Survey, n=1,014, fielded Dec 2025. **Moderate-to-high**. <https://www.weddingsonline.ie/blog/the-2025-irish-wedding-survey/> |
| **Ireland — quoted planner fee range** | €1,500 (day-of) to €7,000+ (full service); up to €15,000 for high-end | LocallyIrish.ie cost guide. **Low confidence** — aggregator content, no stated methodology. <https://locallyirish.ie/cost-guides/wedding-events> |

**Deliberately excluded:** the frequently-repeated US tiering of "$1,500–$3,500 month-of /
$2,500–$6,000 partial / $4,000–$12,000 full" and "luxury at 10–15% of budget". It appears on
eventplanning.com and weddingplanninginstitute.com, both of which are content-marketing sites for
training products with no disclosed methodology, and the numbers propagate verbatim across several
AI-generated pages. It may well be roughly right. It is not evidence.

## B.3 Length of a planning engagement

| Figure | Source & confidence |
| --- | --- |
| **Average US engagement: 14 months** | The Knot 2026 Real Weddings Study, as published on The Knot's own B2B channel. **High confidence.** <https://pros.weddingpro.com/blog/entrepreneurship/real-wedding-study-vendor-insights/> |
| Average US engagement: 15 months | Same study, as reported by a third party. **Discrepancy noted and unresolved** — 14 vs 15 months from the same underlying study. <https://blissandbone.com/resources/average-engagement-length> |
| Median US couple launches a wedding website **8.4 months** before the day (IQR 5.8–11.0 months) — a proxy for when planning becomes concrete | Bliss & Bone platform data, 15,000+ weddings. **Moderate** — real platform data, but self-published by a wedding-website vendor and measures their product's usage, not planning generally. <https://blissandbone.com/resources/how-long-to-plan-a-wedding> |
| Planner-side: wedding-day timeline construction begins **3–4 months out**; monthly timelines updated monthly throughout | u/erikasandovalevents, `Vendor: Planning & Design`. **Moderate**, n=1, but operationally specific. |
| Partial-planning engagement: hire "around three or four months to go" | Bridebook. **Moderate** — advice content from a credible data publisher. <https://bridebook.com/uk/article/how-much-does-a-wedding-planner-cost> |

## B.4 Seasonality

**UK — well evidenced.** Bridebook's 2026 average-spend-by-month table (~7,000 couples) is a good
proxy for demand concentration:

| Month | Avg spend | | Month | Avg spend |
| --- | --- | --- | --- | --- |
| January | £11,000 | | July | £20,483 |
| February | £17,563 | | August | £22,351 |
| March | £18,813 | | September | £22,116 |
| April | £20,875 | | October | £17,873 |
| May | £19,829 | | November | £18,910 |
| June | £23,809 | | December | £19,333 |

Most expensive: June, August, September. Cheapest: January, February, October.
<https://bridebook.com/uk/article/how-much-does-a-wedding-cost-the-uk-average>

Bridebook also reports a structural shift: **"Fewer than half of weddings now take place on a
Saturday,"** with Wednesday and Thursday growing. If accurate, this materially loosens the historical
"one wedding per Saturday" capacity ceiling for planners.

**US — moderate.** October and September have overtaken June as the most popular months, attributed to
The Knot Real Weddings Study via a secondary aggregator
([schedulingkit.com](https://schedulingkit.com/statistics/wedding-industry-statistics)). **I could not
verify this directly against a The Knot page**, so treat as *low-confidence*.

**Practitioner-side seasonality, first-person:**

> "2025 was incredibly sporadic with popular wedding months (May, June, September) being much slower."
> — anonymous respondent, 2025 Wedding Pro Survey.

> "Today was my last wedding of the October rush..."
> — post title, r/WeddingProfessionals.

The Trustpilot Planning Pod reviewer's phrase **"Uplifting to another program during wedding season"**
is a useful reminder that seasonality governs when planners can adopt software at all.

## B.5 Size of the professional wedding planner population

**US — and there is a serious data-quality problem here that I want to flag rather than paper over.**

IBISWorld's own two pages give figures that cannot both be right:

- Number-of-businesses page (accessed 27 Aug 2026): *"There is **58,141** Wedding Planners in the US
  businesses as of 2026, an increase of 11.3% from 2025"* and *"grown 33.8% per year on average over
  the five years between 2021 and 2026."*
  <https://www.ibisworld.com/united-states/number-of-businesses/wedding-planners/4412/>
- The same page's prior-year FAQ, still circulating in search indexes: *"There is **21,714** Wedding
  Planners in the US businesses as of 2025, an decrease of -2.9% from 2024."*

58,141 with +11.3% year-on-year implies a 2025 base of ~52,200, not 21,714. **These are irreconcilable
without paid access to the underlying report.** A 33.8% five-year CAGR in business count against a
13.1% revenue CAGR would also imply revenue per business collapsing, which is possible in a
gig-ified market but is a strong claim. **Recommendation: do not use either number without buying the
report.** If a single figure is needed, "tens of thousands of mostly sole-operator US businesses,
highly fragmented" is defensible; IBISWorld separately states the industry is *"highly fragmented with
no companies holding a market share greater than 5%"*.

**US market size:** $1.6bn in 2026, up 2.1%, having grown at 13.1% CAGR 2021–2026 from a pandemic-era
low base; $1.5bn in 2025, which was a **-4.2% decline** following a **-12.2% decline in 2024**.
IBISWorld attributes part of the contraction to *"more couples have opted to plan their weddings
themselves rather than hire professionals."*
<https://www.ibisworld.com/united-states/industry/wedding-planners/4412/>

**UK — no credible count found.** See §C.

**Ireland — no credible count found.** See §C.

**EU — no credible count found.** See §C.

**Professional bodies, as a partial proxy — and the picture is one of contraction:**

- **UKAWP (UK Alliance of Wedding Planners) no longer exists.** Its own site carries the notice:
  *"Please note after nearly 20 years promoting professionalism in the wedding industry **the UKAWP is
  now closed**."* (September 2023). The `ukawp.com` domain now largely resolves to unrelated gambling
  spam; the announcement is still reachable at
  <https://www.ukawp.com/?h=754017990780>. Founder Bernadette Chapman confirms: *"When I closed the
  UKAWP..."* (<https://bernadettechapman.co.uk/2023/11/09/business-mindset-shift/>). **The UK's main
  professional wedding-planner association has not existed for three years.** This is the single
  cleanest institutional fact in the report and it should temper any assumption that a coherent,
  organised UK planner profession is addressable through industry bodies.
- **ABC (Association of Bridal Consultants)**, founded 1955, US-based (Gibsonville, NC), changed
  ownership in March 2025. It publishes *Wedding Planner Magazine*, stated as *"Reaching more than
  10,000 professionals worldwide."* **No membership count is published.** LinkedIn lists the
  organisation itself at **7 employees** and 324 followers, which is a small operation.
  <https://www.abcweddingplanners.com/> · <https://www.pr.com/press-release/947210>
- **WIPA (Wedding International Professionals Association)** publishes a live membership dashboard:
  **Retention 82.5%, Growth rate 5%, Attrition rate 19%, Members gained 1,434, Members lost 602.**
  Total membership is not stated. <https://www.wipa.org/dashboard/>

## B.6 Market size and post-2020 trends

**US:**

- **~2 million US couples married in 2025**, contributing to a **>$100 billion** US wedding industry.
- **Average wedding cost $34,200** (some TKWW materials round to $34,000), **flat year-on-year**.
- **Average $292 per guest**, up $8 on 2024 and "well above pre-pandemic levels".
- **Average guest count 117.** Gen Z 129, Millennials 112, Gen X 90.
- **Couples hire an average of 13 vendors.** 89% book a venue, 88% a photographer, 85% a caterer.
- **50% of couples cite personality as a top deciding factor when selecting a planner**; 52% cite
  responsiveness as key to building trust.
- **37% of couples reached out to more vendors than initially planned** to find budget-fitting options.

All from The Knot 2026 Real Weddings Study (n=10,474 US couples married 1 Jan–31 Dec 2025, recruited
by email from The Knot/WeddingWire membership — note the self-selection).
<https://www.theknotww.com/press-releases/the-knot-worldwide-unveils-2026-real-weddings-study> ·
<https://www.theknot.com/content/average-wedding-cost>

**UK:** average wedding cost **£20,604** (2026 report), essentially flat against £20,822 (2025) and
£20,775 (2024), up from £16,529 in 2022. Bridebook, ~7,000 couples.
<https://bridebook.com/uk/article/how-much-does-a-wedding-cost-the-uk-average>

**Ireland:** **19,898 marriages in 2025**, down 2.2% on 2024 (20,348) and **down 9.7% since 2015**
(22,025). Marriage rate 3.6 per 1,000, down from 4.7 in 2015. Official CSO data — the highest-quality
statistic in this report.
<https://www.cso.ie/en/releasesandpublications/ep/p-mar/marriages2025/keyfindings/>
Average Irish wedding spend **€36,641** excluding honeymoon, up 6.5%; **average guest count fell from
154 to 141**; 45% of couples went over budget, 21% by more than €5,000 (weddingsonline.ie, n=1,014).
<https://www.weddingsonline.ie/blog/the-2025-irish-wedding-survey/>

**The demand-side trend that matters most to planners** is the 2026 booking slowdown, and it is
well-evidenced from the practitioner side. From the 2025 Wedding Pro Survey (500+ pros):

- Pros reported an average **66% booking level for 2025** but only **42% for 2026** (as at Oct 2025).
- **Over half of pros report couples now take 1–4 weeks between first contact and booking**, described
  as slower than previous years.
- **Most pros convert 21–60% of inquiries.**
- **The majority of couples spend $5,000 or less** per wedding service.

> "Couples are booking much closer to their wedding dates than in past years."
> "It feels like couples are waiting or shopping around longer before committing."
> "I think we're watching the middle of the wedding market (the $50K–$80K range) slowly disappear."
> — <https://saradoesseo.com/wedding-pro-survey-2025/>

And from the leading planner educator:

> "**We're in a trust recession.** ...It's harder and harder for you to establish trust with clients,
> no matter how much money they have."
> — Candice Coppola. <https://blog.candicecoppola.com/state-of-the-wedding-industry/>

## B.7 Business failure / churn among wedding planners

**Grade: Weak. No direct statistic found.** Three indirect signals:

1. **WIPA attrition rate 19% / retention 82.5%** (<https://www.wipa.org/dashboard/>) — association
   churn, not business failure, and members may lapse for many reasons.
2. **IBISWorld US industry revenue declines of -12.2% (2024) and -4.2% (2025)** with DIY cited as a
   driver — consistent with, but not proof of, elevated exits.
3. **UKAWP's closure in 2023** after ~20 years — an association death, which is a symptom of a
   profession that could not sustain its own institution.

The 2025 Wedding Pro Survey sample skews to survivors (**over 60% in business 6+ years**), which by
construction cannot measure failure.

---

# C. Claims I could NOT substantiate

Listed plainly. Several of these are things the brief asked me to look for and I want to be explicit
that looking is not the same as finding.

1. **Poor mobile capture during venue visits / on the road.** Zero practitioner evidence. Only vendor
   marketing copy. (§A.13)
2. **Wedding-day surprises caused specifically by something not being recorded.** Searched directly;
   the one thread purpose-built for this question got zero replies. (§A.11)
3. **Wedding-day timelines changing repeatedly in the final weeks.** Timeline *maintenance* is
   evidenced; *repeated late revision* is not. No revision counts found.
4. **Duplicate data entry by wedding planners in their own words.** The one strong quote is from a
   venue manager, and he frames it as a deliberate control. (§A.4)
5. **WhatsApp specifically as a planner–couple channel.** Evidenced for vendor-side communication by
   one non-professional. No professional wedding planner was found describing WhatsApp use with
   couples. (Instagram DMs and SMS *are* evidenced.)
6. **Weddings per year by segment** (full-service vs partial vs month-of/day-of). No credible source.
   Only one first-person figure (10–15/year) and a cloud of unsourced SEO content. (§B.1)
7. **Number of professional wedding planners in the UK, Ireland, or the EU.** Nothing credible found
   for any of the three.
8. **US planner business count.** IBISWorld's own pages are internally contradictory (58,141 vs
   21,714). (§B.5)
9. **Business failure/churn rate for wedding planners.** No direct statistic exists that I could find.
   (§B.7)
10. **"63% of couples are now planning their weddings using AI instead of hiring a professional."**
    This surfaced in a search synthesis attributed to an unshown source. I could not locate the
    primary source. **Do not use it.**
11. **"68% of weddings fall within a six-month peak window."** Appears in AI-generated vendor content
    (wedypro.ai) with no primary citation. Unverified.
12. **US planner fee tiers by service level.** Widely repeated, no methodology anywhere. (§B.2)
13. **Capterra / G2 / GetApp / Software Advice 2–3 star reviews.** Access-blocked, not absent. This is
    a retrievable gap, not a negative finding.
14. **Facebook group discussions.** Not obtained. A Trustpilot reviewer's pointer to "the wedding
    groups" suggests this is where the richest complaint data lives.
15. **YouTube "day in the life" / workflow videos.** Not mined in this pass.
16. **Planner note-taking modality split** (paper vs typed vs recorded) and whether call recording is
    normalised. Habits are evidenced; the split is not.
17. **BLS occupational data** for meeting/convention/event planners. bls.gov blocks automated access.

---

# D. Honest assessment: what is real, what is thin, what is invented

## D.1 Strongly evidenced

**Multi-product stacks are the norm, and planners resent them.** Named, first-person, repeated:
HoneyBook + Aisle Planner + Google Docs; Dubsado + Drive + Sheets; Aisle Planner + Asana + Sheets +
floor-plan software. `PlannedbyKD`'s "so I'm not using multiple CRMs" is the purest statement of
intent found. Aisle Planner's per-project pricing bands make the cost curve verifiable. (§A.2)

**Google Sheets and Drive are the real system of record, including at the $15k+ tier.** Multiple
independent planners. Critically, **this is often a considered choice, not neglect** — chosen for
real-time vendor propagation and zero client learning curve. Any product replacing it must beat those
two properties specifically, not just look more professional. (§A.1)

**Channel fragmentation and context switching.** `oso_events`'s "email + texting + drive + a floor
plan software" and `im4it2`'s "the part that fries your brain isn't the tasks, it's the context
switching" are the two quotes to keep. Instagram DMs are a genuine, contested channel with a
planner–client etiquette boundary around them. (§A.3)

**Vendor unreliability and late-arriving information.** Well-evidenced and treated as structural
rather than exceptional. `LouiseWH`'s AV-quote-24-hours-out story is the best single illustration.
(§A.9)

**AI attitudes: fatigued, sceptical of client-facing AI, specifically hungry for back-office
automation, and gated on verifiability.** This is the most nuanced finding in the report and the most
actionable. `dzzi` ("unless it linked me to the appropriate document... so I can double check
manually") and `FittestEventProf` ("Until an actual PLANNER and not just some tech company trying to
sell to planners decides to figure out how to really make this work") should be treated as product
requirements. (§A.12)

**Admin load and burnout as the dominant self-reported challenge.** 500+ pro survey plus consistent
Reddit corroboration. More than half of surveyed pros name workflows and automation as a 2026
priority. (§A.14)

**The 2026 demand slowdown.** Booked-level dropping from 66% (2025) to 42% (2026), longer decision
cycles, hollowing middle market. Multiple independent sources including planner educators. (§B.6)

## D.2 Moderately evidenced

**Disputed verbal decisions.** One outstanding, specific, first-person account (Adams' florals story)
plus several corroborating prescriptions. Discounted because the author sells training and links an
affiliate tool — but the anecdote is too specific and too consequential to dismiss. **This is the
highest-value pain per unit of evidence in the report, and also the one most worth validating with
primary interviews before betting on it.** (§A.5)

**Note-taking during client calls.** Habits well-evidenced (typed notes into a Google Doc + recap
email after every meeting). AI note-taker adoption genuinely uncertain — the two best sources
contradict each other, and both are educators evangelising the same product. (§A.6)

**Information going stale.** Best evidenced from the client side: two independent clients at $16k and
$18.5k describing planners whose Aisle Planner and Drive were not kept current. The reframe that
matters: **the constraint is not access to a tool, it is the marginal cost of keeping it current.**
(§A.10)

**Duplicate entry.** One superb quote, wrong role, and framed as a deliberate control. (§A.4)

**Timeline maintenance.** Real and cyclical, but described as the job rather than as pain. (§A.8)

**Preparing for calls.** One good source, no independent corroboration. (§A.7)

## D.3 Weakly or not evidenced

**Poor mobile capture at venue visits — no evidence whatsoever.** If this is load-bearing for a
product thesis, it is currently an assumption.

**Wedding-day surprises from unrecorded information — no evidence.** The thread designed to elicit
exactly these stories drew zero replies.

**Planner cancellations as a systemic pain — one anecdote, client-side.**

**Repeated late timeline churn — asserted everywhere in vendor marketing, evidenced nowhere.**

## D.4 The vendor-marketing mirror, and why it matters

Every pain in this brief is asserted, confidently and in near-identical language, by at least one
company selling software to wedding planners: InvitiApp ("One sheet per wedding, 12 tabs per sheet"),
Mitra Planner ("five tools", "nights reconciling seating charts"), WeddingFlow ("Spreadsheets. Google
Docs. Email threads. A WhatsApp group. Sticky notes"), Nuptial ("You're paying $150+/mo for tools that
don't work together"), Paige ("a $325 line-item change is easy to miss").

Two readings, and they are not mutually exclusive:

1. **Convergent validation.** Several teams, presumably having done their own customer development,
   independently identified the same problems. The overlap with what real planners say in §A.1–A.3 is
   substantial and genuine.
2. **Founder consensus, not user consensus.** These pages are AI-generated SEO artefacts optimised for
   the same keywords. They may be copying each other and copying a shared founder-culture intuition,
   not observing users. Notably, the pains they assert *most* loudly — WhatsApp fragmentation, missed
   line-item changes, day-of surprises — are precisely the ones I could **not** substantiate from
   practitioner voices, while the pain planners actually articulate most clearly — *cross-client*
   tracking and multi-CRM cost — gets comparatively little vendor airtime.

That asymmetry is the most interesting thing in this report. **The market is crowded with products
solving the pains that are easiest to describe, and comparatively empty of products solving the one
`oso_events` named: "to track everything across all of our clients manually, was really, really
frustrating."**

## D.5 The three quotes to carry forward

If everything else in this document is forgotten, these three are the ones that earned their place:

> "I am very adept at building Google sheets, can automate everything/write my own code to have it
> automated, but choose not to because I do not want to maintain my own software ecosystem. Also, **to
> track everything across all of our clients manually, was really, really frustrating.**"
> — u/oso_events, wedding planner

> "**Why I'm still doing event specs manually and I can't forward all my documents to AI to create
> deadlines and a project plan off of contracts is beyond me. Until an actual PLANNER and not just
> some tech company trying to sell to planners decides to figure out how to really make this work…I'm
> not hopeful.**"
> — u/FittestEventProf, event professional

> "**I knew we had talked about the budget. I knew we had reviewed the numbers together on a call
> months earlier.** ... A lot gets decided. And couples, understandably, don't always remember the
> specifics of what was said six months ago."
> — Desirée Adams, wedding planner and educator

---

# E. What to research next

Ordered by value per unit of effort.

1. **Retrieve the Capterra / G2 / GetApp 2–3 star reviews** for HoneyBook, Aisle Planner, Dubsado and
   Planning Pod from a residential IP or via their APIs. This is the largest known gap and it is
   purely an access problem.
2. **Primary interviews (8–12 planners, mixed segments and geographies).** Four things cannot be
   settled from public sources: mobile capture behaviour, note-taking modality, how often verbal
   decisions actually get disputed, and per-segment wedding volume.
3. **Get inside the closed Facebook groups.** Two independent sources point there as the venue for
   candid tool complaints.
4. **Mine YouTube "day in the life" and "my planner workflow" transcripts.** Untouched in this pass
   and likely the best public source for observed rather than reported behaviour.
5. **Buy the IBISWorld report** or find an alternative, to resolve the US business-count
   contradiction.
6. **Validate the cross-client hypothesis explicitly.** The strongest signal here is that per-client
   organisation is broadly solved and cross-client organisation is not. That deserves a direct test
   before it becomes a product bet.
