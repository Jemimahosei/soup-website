<script>
  import { onMount } from "svelte";
  import { api, fmtDateLong } from "../lib/api.js";
  import Photo from "../lib/Photo.svelte";

  let announcements = [];
  let upcoming = [];
  let error = "";
  let loading = true;

  // Pinned news belongs in the home page's upcoming section ("Next
  // hangout") — Jemimah's settled mapping. Within the pinned boards,
  // the Welcome board always comes first (Jemimah, 2026-11-22).
  // Unpinned announcements (e.g. the 161 Things recap) do not appear
  // on the home page at all.
  $: pinned = announcements
    .filter((a) => a.pinned)
    .sort((x, y) => welcomeRank(x) - welcomeRank(y));
  function welcomeRank(a) {
    return String(a.title || "").trim().toLowerCase().startsWith("welcome to soup") ? 0 : 1;
  }
  $: nextEvent = upcoming.length ? upcoming[0] : null;

  // "What we do" tiles — static in the mockup, mirroring the club's
  // tradition stories (the full stories live on the Past events page).
  const tiles = [
    { file: "ctf6.jpg", title: "24 hour Capture the Flag", blurb: "Every Labor Day weekend in Sugar Hill State Forest." },
    { file: "leaf-pile3.jpg", title: "The Big Leaf Pile", blurb: "Each October in Danby State Forest." },
    { file: "snowball-fight12.jpg", title: "Snowball fights", blurb: "Sometimes even in the middle of August." },
    { file: "camping2.jpg", title: "Camping trips", blurb: "Gourmet food, a big bonfire and gear for everyone." },
    { file: "fire2.jpg", title: "Burn Night", blurb: "Will it burn? That was the whole question." },
    { file: "manhunt2.jpg", title: "Campus Manhunt", blurb: "One person hides. Their location drops every ten minutes." },
  ];

  // Quote carousel — wording exactly as in the mockup's screen logic
  // (shortened forms of the member quotes). Arrows + counter are the
  // "tap the quote arrows" interaction from the mockup title.
  const quotes = [
    { text: "It is essentially a bunch of friends doing stuff all together and having experiences that are outside the box.", who: "Meghan, Cornell junior" },
    { text: "I've had the opportunity to explore beautiful natural landscapes, challenge myself physically, and forge meaningful connections.", who: "Sherki, Cornell freshman" },
    { text: "I constantly have fun! SOUP gave me the chance to hang out with my friends and meet new people. I miss having this team experience.", who: "Tessa, Cornell alumnus" },
    { text: "It's a good mix of structured and unstructured fun. It's a pick your own adventure type of thing.", who: "Sofia, Cornell junior" },
  ];
  let qi = 0;
  function prev() { qi = (qi + quotes.length - 1) % quotes.length; }
  function next() { qi = (qi + 1) % quotes.length; }

  onMount(async () => {
    try {
      [announcements, upcoming] = await Promise.all([
        api.announcements(),
        api.events("upcoming"),
      ]);
    } catch (e) {
      error = `Could not load the latest updates: ${e.message}`;
    } finally {
      loading = false;
    }
  });
</script>

<section class="hero">
  <div class="hero-text">
    <h1>Let's play outside.</h1>
    <p class="hero-sub">
      Students for Outdoor Unsupervised Playtime. Cornell's club for capture
      the flag, leaf piles, snowball fights and camping, with over 400
      members since 2020.
    </p>
    <div class="hero-ctas">
      <a href="#/join-us" class="btn-cta cta">Join the group chat</a>
      <a href="#/upcoming-events" class="btn-ghost ghost">See what is next</a>
    </div>
  </div>
  <div class="hero-photo">
    <Photo src="/images/ctf4.jpg" file="ctf4.jpg" label="Capture the Flag" height={520} radius={20} />
  </div>
</section>

<section class="stats">
  <div class="stats-inner">
    <div><div class="stat-num">400+</div><div class="stat-label">members</div></div>
    <div><div class="stat-num">2020</div><div class="stat-label">founded by four roommates</div></div>
    <div><div class="stat-num">24</div><div class="stat-label">hours of capture the flag</div></div>
    <div><div class="stat-num">0</div><div class="stat-label">adults in charge</div></div>
  </div>
</section>

<section class="wrap next">
  <h2 class="h-section">Next hangout</h2>
  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#each pinned as a}
    <div class="next-card pinned-card">
      <div class="next-body">
        <div class="next-title">{a.title}</div>
        <p style="white-space: pre-line;">{a.body}</p>
      </div>
    </div>
  {/each}

  {#if loading}
    <div class="next-card"><div class="next-body"><div class="next-title">Loading…</div></div></div>
  {:else if nextEvent}
    <div class="next-card">
      <div class="next-body">
        <div class="meta-line">
          {fmtDateLong(nextEvent.event_date)}{nextEvent.location ? `, ${nextEvent.location}` : ""}
        </div>
        <div class="next-title">{nextEvent.title}</div>
        <p>{nextEvent.description}</p>
      </div>
      <div class="next-actions">
        <a href={`#/events/${nextEvent.id}`} class="btn-cta btn-md cta">See the event</a>
        <a href="#/upcoming-events" class="btn-ghost btn-md ghost">All upcoming</a>
      </div>
    </div>
  {:else}
    <div class="next-card">
      <div class="next-body">
        <div class="next-title">Nothing is posted yet.</div>
        <p>
          New dates go to the SoupMe group chat first, usually a few days
          ahead. Camping trips often happen on a weekend with almost no
          planning.
        </p>
      </div>
      <div class="next-actions">
        <a href="#/join-us" class="btn-cta btn-md cta">Get the dates</a>
        <a href="#/past-events" class="btn-ghost btn-md ghost">Look back</a>
      </div>
    </div>
  {/if}
</section>

<section class="wrap what">
  <h2 class="h-section">What we do</h2>
  <p class="section-sub">
    Most things start as an idea in the group chat. These are the ones that
    came back every year.
  </p>
  <div class="tile-grid">
    {#each tiles as t}
      <a href="#/past-events" class="tile tile-link">
        <Photo src={`/images/${t.file}`} file={t.file} height={230} radius={16} />
        <div class="tile-title">{t.title}</div>
        <div class="tile-blurb">{t.blurb}</div>
      </a>
    {/each}
  </div>
</section>

<section class="quote-band">
  <div class="quote-inner">
    <div class="quote-main">
      <p class="quote-text">&ldquo;{quotes[qi].text}&rdquo;</p>
      <div class="quote-who">{quotes[qi].who}</div>
      <div class="quote-nav">
        <button type="button" on:click={prev} aria-label="Previous quote" class="quote-arrow">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="#12384a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg>
        </button>
        <button type="button" on:click={next} aria-label="Next quote" class="quote-arrow">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="#12384a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"></path></svg>
        </button>
        <span class="quote-count">{qi + 1} of {quotes.length}</span>
      </div>
    </div>
    <div class="quote-photo">
      <Photo src="/images/camping1.jpg" file="camping1.jpg" height={360} radius={20} />
    </div>
  </div>
</section>

<section class="wrap pitch">
  <div class="pitch-card">
    <div class="pitch-body">
      <h2>Got an idea? Run it with us.</h2>
      <p>
        There is no official leadership, just whoever wants to put on an
        event. We help with the planning, the gear and the word of mouth.
      </p>
    </div>
    <a href="#/join-us" class="pitch-btn">Pitch an event</a>
  </div>
</section>

<style>
  .hero { max-width: 1120px; margin: 0 auto; padding: 24px 24px 56px; display: flex; gap: 48px; align-items: center; flex-wrap: wrap; }
  .hero-text { flex: 1 1 440px; min-width: 0; }
  .hero h1 { margin: 0; font-family: var(--display); font-weight: 800; font-size: 88px; line-height: .95; letter-spacing: -.02em; text-wrap: balance; }
  .hero-sub { margin: 24px 0 0; font-size: 21px; max-width: 30em; }
  .hero-ctas { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 32px; }
  .hero-photo { flex: 1 1 440px; min-width: 0; }

  .stats { background: var(--ink); color: var(--cream); }
  .stats-inner { max-width: 1120px; margin: 0 auto; padding: 36px 24px; display: flex; gap: 32px 64px; flex-wrap: wrap; }
  .stat-num { font-family: var(--display); font-weight: 800; font-size: 48px; line-height: 1; }
  .stat-label { color: var(--sand); }

  .next { padding-top: 72px; padding-bottom: 24px; }
  .next-card { background: var(--sand); border-radius: 20px; padding: 36px; display: flex; gap: 32px; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-top: 20px; }
  .next-body { flex: 1 1 380px; min-width: 0; }
  .next-title { font-family: var(--display); font-weight: 800; font-size: 30px; line-height: 1.15; }
  .next-body p { margin: 10px 0 0; max-width: 32em; }
  .next-actions { display: flex; gap: 12px; flex-wrap: wrap; }
  .pinned-card { align-items: flex-start; }
  .news-list { display: grid; gap: 16px; margin-top: 24px; }
  .news-card { background: #fff; border-radius: 16px; padding: 24px 28px; }
  .news-card h3 { margin: 0 0 6px; font-family: var(--display); font-weight: 800; font-size: 24px; }
  .news-card p { margin: 0; color: var(--muted); }

  .what { padding-top: 56px; padding-bottom: 24px; }
  .what .h-section { margin-bottom: 8px; }
  .tile-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
  .tile-link { text-decoration: none; }
  .tile-title { font-family: var(--display); font-weight: 800; font-size: 24px; margin-top: 14px; }
  .tile-blurb { color: var(--muted); }

  .quote-band { background: var(--sky); margin-top: 56px; }
  .quote-inner { max-width: 1120px; margin: 0 auto; padding: 64px 24px; display: flex; gap: 48px; align-items: center; flex-wrap: wrap; }
  .quote-main { flex: 1 1 560px; min-width: 0; }
  .quote-text { margin: 0; font-family: var(--display); font-weight: 600; font-size: 30px; line-height: 1.3; text-wrap: pretty; }
  .quote-who { margin-top: 20px; font-weight: 600; }
  .quote-nav { display: flex; gap: 10px; margin-top: 24px; align-items: center; }
  .quote-arrow { width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--ink); background: transparent; color: var(--ink); display: flex; align-items: center; justify-content: center; }
  .quote-count { margin-left: 8px; color: var(--muted); }
  .quote-photo { flex: 0 1 320px; }

  .pitch { padding-top: 72px; padding-bottom: 72px; }
  .pitch-card { background: var(--ink); color: var(--cream); border-radius: 20px; padding: 44px; display: flex; gap: 32px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
  .pitch-body { flex: 1 1 400px; min-width: 0; }
  .pitch-card h2 { margin: 0; font-family: var(--display); font-weight: 800; font-size: 36px; line-height: 1.1; }
  .pitch-card p { margin: 10px 0 0; color: var(--sand); max-width: 34em; }
  .pitch-btn { background: var(--sand); color: var(--ink); border-radius: 8px; padding: 0 26px; min-height: 52px; display: inline-flex; align-items: center; font-weight: 600; text-decoration: none; font-size: 18px; }

  @media (max-width: 700px) {
    .hero { padding: 12px 16px 28px; gap: 24px; }
    .hero h1 { font-size: 54px; line-height: .98; }
    .hero-sub { font-size: 18px; }
    .hero-ctas a { flex: 1 1 100%; }
    .stats-inner { padding: 24px 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 12px; }
    .stat-num { font-size: 40px; }
    .next, .what { padding-left: 16px; padding-right: 16px; }
    .next { padding-top: 32px; }
    .next-card { padding: 22px; border-radius: 16px; }
    .next-title { font-size: 24px; }
    .tile-grid { grid-template-columns: 1fr; }
    .quote-inner { padding: 36px 16px; }
    .quote-text { font-size: 24px; }
    .quote-photo { display: none; }
    .pitch { padding: 32px 16px 40px; }
    .pitch-card { padding: 24px; border-radius: 16px; }
    .pitch-card h2 { font-size: 26px; }
  }
</style>
