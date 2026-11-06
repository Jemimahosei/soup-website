<script>
  import { onMount } from "svelte";
  import { api, fmtDate, imgFallback } from "../lib/api.js";

  let announcements = [];
  let upcoming = [];
  let error = "";
  let loading = true;

  // Photo carousel from the real site (index.html). Photos live in the
  // club's images/ folder at deploy time; if a file is missing, the slide
  // falls back to a labelled card instead of a broken image.
  const slides = [
    { file: "ctf4.jpg", label: "Capture the Flag" },
    { file: "ctf6.jpg", label: "Capture the Flag" },
    { file: "camping1.jpg", label: "Camping" },
    { file: "snow1.jpg", label: "Snowball Fight" },
    { file: "leaf-pile6.jpg", label: "The Big Leaf Pile" },
  ];
  let slide = 0;
  let failed = {};
  function prev() { slide = (slide + slides.length - 1) % slides.length; }
  function next() { slide = (slide + 1) % slides.length; }

  const quotes = [
    {
      text: "Soup is a great group of people who wanted to explore what it meant to be an adult and still have fun which shaped my experience at Cornell. It is essentially a bunch of friends doing stuff all together and having experiences that are outside the box.",
      who: "Meghan, Cornell Junior",
    },
    {
      text: "My general experience in outdoor events has been incredibly rewarding. I've had the opportunity to explore beautiful natural landscapes, challenge myself physically, and forge meaningful connections with other members of SOUP!",
      who: "Sherki, Cornell Freshman",
    },
    {
      text: "I constantly have fun! It is exciting and entertaining. SOUP gave me the chance to hang out with my friends and meet new people. I miss having this team experience.",
      who: "Tessa, Cornell Alumnus",
    },
    {
      text: "I've had a really great time being involved in the organization. It's a good mix of structured and unstructured fun. I don't feel like there's anyone being the 'parent' or saying no to doing things, within reason. It's a pick-your-own-adventure type of thing.",
      who: "Sofia, Cornell Junior",
    },
  ];

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
  <div class="container">
    <h1>Students for Outdoor Unsupervised Playtime</h1>
    <p>
      Welcome to SOUP - Students for Outdoor Unsupervised Playtime! We are a
      vibrant group of Cornell University students dedicated to making the most
      of the scenic beauty and open spaces around Ithaca. Our mission is to
      foster community and active lifestyles through fun, unsupervised outdoor
      events. Join us for a range of activities from capture the flag and games
      of sardines to snowball fights and camping trips. Whether you're looking
      to relive childhood games or just enjoy the great outdoors with fellow
      students, SOUP is your go-to club for adventure and connection in
      nature. Let's play outside!
    </p>
    <div class="hero-ctas">
      <a class="btn" href="#/join-us">Join Us!</a>
      <a class="btn btn-ghost" href="#/upcoming-events">Upcoming Events</a>
    </div>
  </div>
</section>

<div class="carousel" aria-label="Photos from SOUP events">
  <div class="carousel-inner">
    <button class="carousel-btn" on:click={prev} aria-label="Previous photo">&lt;</button>
    <div class="carousel-slide">
      {#if failed[slide]}
        <div class="photo-label">
          {slides[slide].label}
          <small>Photo: images/{slides[slide].file} (from the club's gallery)</small>
        </div>
      {:else}
        <img
          src={`/images/${slides[slide].file}`}
          alt={slides[slide].label}
          on:error={(e) => { if (!imgFallback(e)) failed = { ...failed, [slide]: true }; }}
        />
      {/if}
    </div>
    <button class="carousel-btn" on:click={next} aria-label="Next photo">&gt;</button>
  </div>
  <div class="carousel-dots">
    {#each slides as _, i}
      <button
        class="dot"
        class:active={i === slide}
        on:click={() => (slide = i)}
        aria-label={`Photo ${i + 1}: ${slides[i].label}`}
      ></button>
    {/each}
  </div>
</div>

<div class="container">
  {#if error}
    <p class="error">{error}</p>
  {/if}

  <section class="section">
    <h2>History of SOUP</h2>
    <p style="max-width: 720px;">
      Founded in 2020 by a dynamic group of Cornell University students, SOUP -
      Students for Outdoor Unsupervised Playtime has quickly grown into a
      flourishing community with over 400 members passionate about outdoor
      activities. With a rich history of organizing both annual and novel events
      each year, SOUP encourages student engagement by hosting a variety of
      activities on Cornell's campus and the picturesque surroundings of Ithaca.
      Members have the unique opportunity to suggest and participate in new
      events, ensuring a continually evolving and engaging lineup. SOUP's
      commitment to promoting social bonds and outdoor exploration is evident in
      its mission to provide exciting, student-led outdoor adventures, promising
      a lasting legacy of community and fun.
    </p>
  </section>

  <section class="section">
    <h2>Hear from our members!</h2>
    <div class="quotes">
      {#each quotes as q}
        <div class="card quote">
          <p>"{q.text}"</p>
          <span class="who">— {q.who}</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="section">
    <h2>Announcements</h2>
    {#if loading}
      <p class="section-sub">Loading…</p>
    {:else if announcements.length === 0}
      <p class="section-sub">No announcements right now.</p>
    {:else}
      <div class="grid">
        {#each announcements as a}
          <article class="card">
            <h3>{a.title}</h3>
            {#if a.pinned}<span class="tag pinned">Pinned</span>{/if}
            <p style="white-space: pre-line;">{a.body}</p>
          </article>
        {/each}
      </div>
    {/if}
  </section>

  <section class="section">
    <h2>Coming up</h2>
    {#if loading}
      <p class="section-sub">Loading…</p>
    {:else if upcoming.length === 0}
      <p class="section-sub">
        No upcoming events are posted right now. New dates land here and in
        the
        <a href="https://web.groupme.com/join_group/76748584/IpJpxdYO">SoupMe GroupMe</a>
        as soon as they're set — or
        <a href="#/past-events">look back at past events</a>.
      </p>
    {:else}
      <div class="grid">
        {#each upcoming.slice(0, 3) as e}
          <article class="card">
            <h3><a href={`#/events/${e.id}`}>{e.title}</a></h3>
            <p class="meta">{fmtDate(e.event_date)}{e.location ? ` · ${e.location}` : ""}</p>
            <p>{e.description}</p>
          </article>
        {/each}
      </div>
      <p style="margin-top: 1rem;">
        <a class="btn btn-small" href="#/upcoming-events">All upcoming events</a>
      </p>
    {/if}
  </section>
</div>
