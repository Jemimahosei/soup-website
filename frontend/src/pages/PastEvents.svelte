<script>
  import { onMount } from "svelte";
  import { api, fmtDateLong } from "../lib/api.js";
  import Photo from "../lib/Photo.svelte";

  let past = [];
  let stories = [];
  let poems = [];
  let error = "";
  let loading = true;

  // Server returns past events oldest-first; the mockup grid leads with
  // the newest, so display a reversed copy (data and split unchanged).
  $: pastNewestFirst = [...past].reverse();

  onMount(async () => {
    try {
      [past, stories, poems] = await Promise.all([
        api.events("past"),
        api.resources("story"),
        api.resources("poem"),
      ]);
    } catch (e) {
      error = `Could not load past events: ${e.message}`;
    } finally {
      loading = false;
    }
  });

  function fileOf(item) {
    return item.image_url ? String(item.image_url).split("/").pop() : "";
  }
</script>

<div class="page">
  <h1>Past events</h1>

  {#if error}
    <p class="error">{error}</p>
  {:else if loading}
    <p class="section-sub" style="margin-top:32px">Loading…</p>
  {:else if past.length === 0}
    <p class="section-sub" style="margin-top:32px">No dated past events in the database yet.</p>
  {:else}
    <div class="event-grid" style="margin-top:36px">
      {#each pastNewestFirst as e}
        <a href={`#/events/${e.id}`} class="event-card tile">
          <Photo src={e.image_url || ""} file={fileOf(e)} height={240} radius={12} />
          <div class="meta-line">
            {fmtDateLong(e.event_date)}{e.location ? `, ${e.location}` : ""}
          </div>
          <div class="title">{e.title}</div>
        </a>
      {/each}
    </div>
  {/if}

  <h2 class="h-section traditions-h">Our traditions</h2>
  <p class="section-sub">The events that come back every year, and the ones that make SOUP what it is.</p>

  <div class="traditions">
    {#each stories as s, i}
      <article class="tradition" class:flip={i % 2 === 1}>
        <div class="tradition-photo">
          <Photo src={s.image_url || ""} file={fileOf(s)} height={300} radius={16} />
        </div>
        <div class="tradition-body">
          <h3>{s.title}</h3>
          <p style="white-space: pre-line;">{s.body}</p>
        </div>
      </article>
    {/each}
  </div>

  <h2 class="h-section poems-h">Poems from members</h2>
  <div class="event-grid" style="margin-top:24px">
    {#each poems as p}
      <div class="poem-card">
        <div class="poem-title">{p.title}</div>
        {#if p.description}<div class="poem-by">{p.description}</div>{/if}
        <p style="white-space: pre-line;">{p.body}</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .traditions-h { margin-top: 80px; }
  .traditions { display: flex; flex-direction: column; gap: 56px; }
  .tradition { display: flex; gap: 40px; align-items: center; flex-wrap: wrap; }
  .tradition.flip { flex-direction: row-reverse; }
  .tradition-photo { flex: 1 1 420px; min-width: 0; }
  .tradition-body { flex: 1 1 420px; min-width: 0; }
  .tradition-body h3 { margin: 0; font-family: var(--display); font-weight: 800; font-size: 32px; line-height: 1.1; }
  .tradition-body p { margin: 12px 0 0; }
  .poems-h { margin-top: 96px; }
  .poem-card { background: var(--sand); border-radius: 16px; padding: 28px; }
  .poem-title { font-family: var(--display); font-weight: 800; font-size: 26px; }
  .poem-by { color: var(--muted); margin-top: 2px; }
  .poem-card p { margin: 14px 0 0; font-style: italic; }
  @media (max-width: 700px) {
    .tradition, .tradition.flip { flex-direction: column; align-items: stretch; }
  }
</style>
