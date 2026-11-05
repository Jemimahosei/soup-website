<script>
  import { onMount } from "svelte";
  import { api, fmtDate, fmtTime, imgFallback, spotsLeft } from "../lib/api.js";

  export let id;
  let event = null;
  let error = "";
  const today = new Date().toISOString().slice(0, 10);

  onMount(async () => {
    try {
      event = await api.event(id);
    } catch (e) {
      error = `Could not load this event: ${e.message}`;
    }
  });
</script>

<div class="container">
  <section class="section">
    <a
      class="back-link"
      href={event && event.event_date >= today ? "#/upcoming-events" : "#/past-events"}
    >
      ← {event && event.event_date >= today ? "Upcoming events" : "Past events"}
    </a>
    {#if error}
      <p class="error">{error}</p>
    {:else if !event}
      <p>Loading…</p>
    {:else}
      <span class="tag">{event.category}</span>
      {#if spotsLeft(event) === 0}
        <span class="tag full">Full — join the waitlist</span>
      {/if}
      {#if event.image_url}
        <img
          class="card-img detail-img"
          src={event.image_url}
          alt={event.title}
          on:error={(e) => { if (!imgFallback(e)) e.currentTarget.style.display = "none"; }}
        />
      {/if}
      <h2>{event.title}</h2>
      <div class="detail-meta">
        <span>{fmtDate(event.event_date)}</span>
        {#if event.start_time}
          <span>{fmtTime(event.start_time)}{event.end_time ? ` – ${fmtTime(event.end_time)}` : ""}</span>
        {/if}
        {#if event.location}<span>{event.location}</span>{/if}
        {#if spotsLeft(event) !== null}
          <span>
            <span class="spots" class:low={spotsLeft(event) <= 3}>
              {spotsLeft(event)} spots left
            </span>
            of {event.spots_total}
          </span>
        {/if}
      </div>
      <p style="white-space: pre-line; max-width: 720px;">{event.description}</p>
      <p class="meta">
        Want in? Join the
        <a href="https://web.groupme.com/join_group/76748584/IpJpxdYO">SoupMe GroupMe</a>
        or email <a href="mailto:soup_cu@gmail.com">soup_cu@gmail.com</a>.
      </p>
    {/if}
  </section>
</div>
