<script>
  import { onMount } from "svelte";
  import { api, fmtDate, imgFallback } from "../lib/api.js";

  let past = [];
  let stories = [];
  let poems = [];
  let error = "";

  onMount(async () => {
    try {
      [past, stories, poems] = await Promise.all([
        api.events("past"),
        api.resources("story"),
        api.resources("poem"),
      ]);
    } catch (e) {
      error = `Could not load past events: ${e.message}`;
    }
  });
</script>

<div class="container">
  <section class="section">
    <h2>SOUP Past Events</h2>
    {#if error}
      <p class="error">{error}</p>
    {:else if past.length === 0}
      <p class="section-sub">No dated past events in the database yet.</p>
    {:else}
      <div class="grid">
        {#each past as e}
          <article class="card">
            <h3><a href={`#/events/${e.id}`}>{e.title}</a></h3>
            <p class="meta">{fmtDate(e.event_date)}{e.location ? ` · ${e.location}` : ""}</p>
            <p>{e.description}</p>
          </article>
        {/each}
      </div>
    {/if}
  </section>

  <section class="section">
    <h2>Our traditions</h2>
    <p class="section-sub">
      The events that come back every year — and the ones that make SOUP, SOUP.
    </p>
    <div class="grid">
      {#each stories as s}
        <article class="card">
          {#if s.image_url}
            <img
              class="card-img"
              src={s.image_url}
              alt={s.title}
              on:error={(e) => { if (!imgFallback(e)) e.currentTarget.style.display = "none"; }}
            />
          {/if}
          <h3>{s.title}</h3>
          <p style="white-space: pre-line;">{s.body}</p>
        </article>
      {/each}
    </div>
  </section>

  <section class="section">
    <h2>Poems inspired by our events!</h2>
    <div class="grid">
      {#each poems as p}
        <article class="card poem">
          <h3>{p.title}</h3>
          <p class="meta">{p.description}</p>
          <p style="white-space: pre-line;">{p.body}</p>
        </article>
      {/each}
    </div>
  </section>
</div>
