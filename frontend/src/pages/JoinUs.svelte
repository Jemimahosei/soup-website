<script>
  import { onMount } from "svelte";
  import { api, imgFallback } from "../lib/api.js";

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

<div class="container">
  <section class="section">
    <h2>Join Us!</h2>
    {#if error}
      <p class="error">{error}</p>
    {/if}

    {#each guides as g}
      <div class="card" style="margin-bottom: 1.1rem;">
        <h3>{g.title}</h3>
        <p style="white-space: pre-line;">{g.body}</p>
      </div>
    {/each}

    <div class="card" style="margin-bottom: 1.1rem;">
      <h3>Join the SoupMe (SOUP GroupMe)</h3>
      <p>
        Join the SoupMe
        <a href="https://web.groupme.com/join_group/76748584/IpJpxdYO">here</a>!
        This is where we drop specific information (rules, updates, etc.)
        about upcoming events.
      </p>
    </div>

    <div class="card" style="margin-bottom: 1.1rem;">
      <h3>Spread the word</h3>
      <img
        class="card-img"
        src="/images/161-things-flyer.jpg"
        alt="Flyer for the 161 Things Competition"
        on:error={(e) => { if (!imgFallback(e)) e.currentTarget.style.display = "none"; }}
      />
      <p>
        Flyers for upcoming events are posted here. Feel free to print a flyer
        and post it around campus, give it to your friends, or share it on
        social media. There will be more flyers for any upcoming events posted
        on this page of the site. These are always up for grabs. Help get more
        people involved in SOUP by sharing these flyers far and wide!
      </p>
    </div>

    <div class="card">
      <h3>Connect with SOUP</h3>
      <p>
        Instagram: cornell__soup<br />
        Email: <a href="mailto:soup_cu@gmail.com">soup_cu@gmail.com</a><br />
        {#each links as l}
          <a href={l.url}>{l.title}</a><br />
        {/each}
      </p>
      <p class="meta">
        SOUP is not an officially registered organization at Cornell.
      </p>
    </div>
  </section>
</div>
