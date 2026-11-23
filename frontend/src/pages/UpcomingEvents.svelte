<script>
  import { onMount } from "svelte";
  import { api, fmtDateLong, fmtTime } from "../lib/api.js";
  import Photo from "../lib/Photo.svelte";

  let upcoming = [];
  let past = [];
  let error = "";
  let loading = true;

  // The upcoming/past split itself is the server's (filter=upcoming /
  // filter=past, today in America/New_York) — do not re-derive it here.
  // The past list comes back oldest-first, so the "Most recent" card
  // below takes its last item.
  $: mostRecent = past.length ? past[past.length - 1] : null;

  onMount(async () => {
    try {
      [upcoming, past] = await Promise.all([
        api.events("upcoming"),
        api.events("past"),
      ]);
    } catch (e) {
      error = `Could not load upcoming events: ${e.message}`;
    } finally {
      loading = false;
    }
  });

  function fileOf(e) {
    return e.image_url ? String(e.image_url).split("/").pop() : "";
  }
</script>

<div class="page">
  <h1>Upcoming events</h1>

  {#if error}
    <p class="error">{error}</p>
  {:else if loading}
    <p class="section-sub" style="margin-top:32px">Loading…</p>
  {:else if upcoming.length === 0}
    <div class="empty-card">
      <div class="empty-body">
        <div class="empty-title">Nothing is on the calendar right now.</div>
        <p>
          Dates are posted here and in the SoupMe group chat as soon as they
          are set. The chat is where the rules, meeting spots and last
          minute changes live, so it is the fastest way to hear.
        </p>
        <div class="empty-actions">
          <a href="#/join-us" class="btn-cta cta">Join the group chat</a>
          <a href="#/past-events" class="btn-ghost ghost">Look back at past events</a>
        </div>
      </div>
      <div class="empty-photo">
        <Photo src="/images/snow1.jpg" file="snow1.jpg" height={280} radius={16} />
      </div>
    </div>
  {:else}
    <div class="event-list">
      {#each upcoming as e}
        <a href={`#/events/${e.id}`} class="event-row tile">
          <div class="photo">
            <Photo src={e.image_url || ""} file={fileOf(e)} height={180} radius={12} />
          </div>
          <div class="body">
            <div class="meta-line">
              {fmtDateLong(e.event_date)}{#if e.start_time} · {fmtTime(e.start_time)}{/if}{e.location ? `, ${e.location}` : ""}
            </div>
            <div class="title">{e.title}</div>
            <div class="desc">{e.description}</div>
          </div>
        </a>
      {/each}
    </div>
  {/if}

  {#if mostRecent}
    <h2 class="most-recent">Most recent</h2>
    <a href={`#/events/${mostRecent.id}`} class="event-row tile" style="margin-top:16px">
      <div class="photo">
        <Photo src={mostRecent.image_url || ""} file={fileOf(mostRecent)} height={180} radius={12} />
      </div>
      <div class="body">
        <div class="meta-line">
          {fmtDateLong(mostRecent.event_date)}{mostRecent.location ? `, ${mostRecent.location}` : ""}
        </div>
        <div class="title">{mostRecent.title}</div>
        <div class="desc">{mostRecent.description}</div>
      </div>
    </a>
  {/if}
</div>

<style>
  .empty-card { background: var(--sand); border-radius: 20px; padding: 44px; margin-top: 32px; display: flex; gap: 40px; align-items: center; flex-wrap: wrap; }
  .empty-body { flex: 1 1 400px; min-width: 0; }
  .empty-title { font-family: var(--display); font-weight: 800; font-size: 36px; line-height: 1.1; }
  .empty-body p { margin: 14px 0 0; max-width: 32em; }
  .empty-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 28px; }
  .empty-photo { flex: 0 1 340px; }
  .event-list { display: grid; gap: 16px; margin-top: 32px; }
  .most-recent { margin: 64px 0 8px; font-family: var(--display); font-weight: 800; font-size: 32px; }
  @media (max-width: 700px) {
    .empty-card { padding: 22px; }
    .empty-title { font-size: 24px; }
    .empty-photo { flex: 1 1 100%; }
  }
</style>
