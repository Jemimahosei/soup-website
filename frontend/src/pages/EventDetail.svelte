<script>
  import { onMount } from "svelte";
  import { api, fmtDateLong, fmtTime, spotsLeft, todayNY } from "../lib/api.js";
  import Photo from "../lib/Photo.svelte";

  export let id;
  let event = null;
  let error = "";

  // Back link + CTA wording follow the same split the backend uses:
  // today in America/New_York (the previous version compared against a
  // UTC date, which flipped the label after 7pm Eastern).
  $: isUpcoming = event ? String(event.event_date).slice(0, 10) >= todayNY() : false;

  onMount(async () => {
    try {
      event = await api.event(id);
    } catch (e) {
      error = `Could not load this event: ${e.message}`;
    }
  });

  $: file = event && event.image_url ? String(event.image_url).split("/").pop() : "";
  $: left = event ? spotsLeft(event) : null;
</script>

<div class="page page-narrow detail">
  {#if error}
    <p class="error">{error}</p>
  {:else if !event}
    <p>Loading…</p>
  {:else}
    <a
      class="back-link"
      href={isUpcoming ? "#/upcoming-events" : "#/past-events"}
    >
      Back to {isUpcoming ? "upcoming events" : "past events"}
    </a>

    <div class="detail-photo">
      <Photo src={event.image_url || ""} file={file} height={420} radius={20} />
    </div>

    <div class="meta-line detail-meta">
      {fmtDateLong(event.event_date)}{#if event.start_time} · {fmtTime(event.start_time)}{event.end_time ? ` – ${fmtTime(event.end_time)}` : ""}{/if}{event.location ? `, ${event.location}` : ""}
      {#if left !== null}
        · <span class="spots" class:low={left <= 3}>{left} spots left</span> of {event.spots_total}
      {/if}
      {#if left === 0} · <span class="pill pill-pin">Full — join the waitlist</span>{/if}
    </div>

    <h1>{event.title}</h1>

    <p class="detail-body" style="white-space: pre-line;">{event.description}</p>

    <div class="join-card">
      <div class="join-body">
        <div class="join-title">{isUpcoming ? "Want in?" : "Want to play next year?"}</div>
        <div>Get in touch and we will add you to the group chat.</div>
      </div>
      <a href="#/join-us" class="btn-cta cta">Join SOUP</a>
    </div>
  {/if}
</div>

<style>
  .detail { padding-top: 16px; }
  .back-link { display: inline-flex; align-items: center; min-height: 44px; font-weight: 600; text-decoration: none; }
  .detail-photo { margin-top: 8px; }
  .detail-meta { margin-top: 28px; }
  .detail h1 { margin: 4px 0 0; font-size: 60px; }
  .detail-body { margin: 24px 0 0; font-size: 19px; max-width: 36em; }
  .spots { font-weight: 700; }
  .spots.low { color: var(--danger); }
  .join-card { background: var(--sand); border-radius: 16px; padding: 28px; margin-top: 40px; display: flex; gap: 24px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
  .join-body { flex: 1 1 320px; }
  .join-title { font-family: var(--display); font-weight: 800; font-size: 26px; }
  @media (max-width: 700px) {
    .detail h1 { font-size: 40px; }
  }
</style>
