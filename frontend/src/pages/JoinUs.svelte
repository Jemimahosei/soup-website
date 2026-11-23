<script>
  import { onMount } from "svelte";
  import { api } from "../lib/api.js";
  import Photo from "../lib/Photo.svelte";

  // Guides and links are admin-managed resources (mockup admin screen:
  // "Guides and links" tab). The three cards and the flyer section are
  // the mockup's fixed Join layout; guides render below them and any
  // extra admin links under "More ways to connect".
  let guides = [];
  let links = [];
  let error = "";

  onMount(async () => {
    try {
      [guides, links] = await Promise.all([
        api.resources("guide"),
        api.resources("link"),
      ]);
    } catch (e) {
      error = `Could not load join information: ${e.message}`;
    }
  });
</script>

<div class="page">
  <h1>Join SOUP</h1>
  <p class="join-sub">Join the group chat, then come to whatever sounds fun.</p>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="join-grid">
    <div class="join-card sand">
      <div class="join-title">Join the SoupMe</div>
      <p>Our GroupMe. This is where we drop the rules, updates and meeting spots for upcoming events.</p>
      <a href="https://web.groupme.com/join_group/76748584/IpJpxdYO" class="btn-cta btn-md cta">Open the group chat</a>
    </div>
    <div class="join-card sky">
      <div class="join-title">Follow along</div>
      <p>Photos and updates on Instagram at cornell__soup.</p>
      <a href="https://www.instagram.com/cornell__soup" class="btn-ghost btn-md ghost">Open Instagram</a>
    </div>
    <div class="join-card white">
      <div class="join-title">Pitch an event</div>
      <p>Have an idea, or want to plan one with our support? We always welcome new leaders. Email soup_cu@gmail.com.</p>
      <a href="mailto:soup_cu@gmail.com" class="btn-ghost btn-md ghost">Email us</a>
    </div>
  </div>

  {#if guides.length}
    <div class="guide-list">
      {#each guides as g}
        <article class="guide-card">
          <h3>{g.title}</h3>
          <p style="white-space: pre-line;">{g.body}</p>
        </article>
      {/each}
    </div>
  {/if}

  <section class="spread">
    <div class="spread-photo">
      <Photo src="/images/161-things-flyer.jpg" file="161-things-flyer.jpg" label="161 Things flyer" height={460} radius={20} />
    </div>
    <div class="spread-body">
      <h2 class="h-section">Spread the word</h2>
      <p>
        Flyers for upcoming events are posted here. Print one and put it up
        around campus, hand it to a friend or share it online. They are
        always up for grabs, so help get more people outside.
      </p>
    </div>
  </section>

  {#if links.length}
    <div class="guide-card more-links">
      <h3>More ways to connect</h3>
      <p>
        {#each links as l}
          <a href={l.url}>{l.title}</a><br />
        {/each}
      </p>
    </div>
  {/if}

  <p class="join-note">SOUP is not an officially registered organization at Cornell.</p>
</div>

<style>
  .join-sub { margin: 16px 0 0; font-size: 21px; max-width: 30em; }
  .join-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; margin-top: 40px; }
  .join-card { border-radius: 16px; padding: 28px; display: flex; flex-direction: column; gap: 10px; }
  .join-card.sand { background: var(--sand); }
  .join-card.sky { background: var(--sky); }
  .join-card.white { background: #fff; }
  .join-title { font-family: var(--display); font-weight: 800; font-size: 28px; line-height: 1.1; }
  .join-card p { margin: 0; flex: 1; }
  .join-card a { align-self: flex-start; }
  .guide-list { display: grid; gap: 16px; margin-top: 40px; }
  .guide-card { background: #fff; border-radius: 16px; padding: 28px; }
  .guide-card h3 { margin: 0 0 8px; font-family: var(--display); font-weight: 800; font-size: 26px; }
  .guide-card p { margin: 0; }
  .spread { display: flex; gap: 48px; align-items: center; flex-wrap: wrap; margin-top: 80px; }
  .spread-photo { flex: 0 1 380px; }
  .spread-body { flex: 1 1 400px; min-width: 0; }
  .spread-body p { margin: 14px 0 0; max-width: 32em; }
  .more-links { margin-top: 40px; }
  .join-note { margin: 64px 0 0; color: var(--muted); font-size: 15px; }
  @media (max-width: 700px) {
    .join-grid { grid-template-columns: 1fr; }
    .spread-photo { flex: 1 1 100%; }
  }
</style>
