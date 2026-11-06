<script>
  import { onMount } from "svelte";
  import { api, fmtDate, fmtTime, imgFallback } from "../lib/api.js";

  let upcoming = [];
  let error = "";
  let loading = true;

  onMount(async () => {
    try {
      upcoming = await api.events("upcoming");
    } catch (e) {
      error = `Could not load upcoming events: ${e.message}`;
    } finally {
      loading = false;
    }
  });
</script>

<div class="container">
  <section class="section">
    <h2>SOUP Upcoming Events</h2>
    {#if error}
      <p class="error">{error}</p>
    {:else if loading}
      <p class="section-sub">Loading…</p>
    {:else if upcoming.length === 0}
      <p class="section-sub">
        No upcoming events are posted right now. New dates land here — and in
        the
        <a href="https://web.groupme.com/join_group/76748584/IpJpxdYO">SoupMe GroupMe</a>
        — as soon as they're set. In the meantime, you can
        <a href="#/past-events">look back at past events</a> or
        <a href="#/join-us">pitch your own idea</a>.
      </p>
    {:else}
      <div class="grid">
        {#each upcoming as e}
          <article class="card">
            <span class="tag">{e.category}</span>
            {#if e.image_url}
              <img
                class="card-img"
                src={e.image_url}
                alt={e.title}
                on:error={(e2) => { if (!imgFallback(e2)) e2.currentTarget.style.display = "none"; }}
              />
            {/if}
            <h3><a href={`#/events/${e.id}`}>{e.title}</a></h3>
            <p class="meta">
              {fmtDate(e.event_date)}{#if e.start_time} · {fmtTime(e.start_time)}{/if}{e.location ? ` · ${e.location}` : ""}
            </p>
            <p>{e.description}</p>
          </article>
        {/each}
      </div>
    {/if}
  </section>
</div>
