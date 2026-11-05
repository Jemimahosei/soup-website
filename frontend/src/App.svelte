<script>
  import { onMount } from "svelte";
  import Home from "./pages/Home.svelte";
  import PastEvents from "./pages/PastEvents.svelte";
  import UpcomingEvents from "./pages/UpcomingEvents.svelte";
  import JoinUs from "./pages/JoinUs.svelte";
  import EventDetail from "./pages/EventDetail.svelte";
  import Admin from "./pages/Admin.svelte";
  import { imgFallback } from "./lib/api.js";

  let route = "home";
  let param = null;
  let menuOpen = false;
  let logoOk = true;

  function parseHash() {
    const hash = (window.location.hash || "#/").replace(/^#/, "");
    const parts = hash.split("/").filter(Boolean);
    if (parts.length === 0) {
      route = "home";
      param = null;
    } else if (parts[0] === "events" && parts[1]) {
      route = "event-detail";
      param = parts[1];
    } else if (["past-events", "upcoming-events", "join-us", "admin"].includes(parts[0])) {
      route = parts[0];
      param = null;
    } else {
      route = "home";
      param = null;
    }
    menuOpen = false;
    window.scrollTo(0, 0);
  }

  onMount(() => {
    parseHash();
    window.addEventListener("hashchange", parseHash);
    return () => window.removeEventListener("hashchange", parseHash);
  });

  // Nav mirrors the real site: Home, Past Events, Upcoming Events, Join Us!
  const nav = [
    { href: "#/", label: "Home", key: "home" },
    { href: "#/past-events", label: "Past Events", key: "past-events" },
    { href: "#/upcoming-events", label: "Upcoming Events", key: "upcoming-events" },
    { href: "#/join-us", label: "Join Us!", key: "join-us" },
    { href: "#/admin", label: "Admin", key: "admin" },
  ];
</script>

<header class="site-header">
  <nav class="nav" aria-label="Main">
    <a class="brand" href="#/">
      {#if logoOk}
        <img
          class="brand-logo"
          src="/images/logo-transparent.png"
          alt="SOUP logo"
          on:error={(e) => { if (!imgFallback(e)) logoOk = false; }}
        />
      {/if}
      SOUP<span>:</span>
    </a>
    <button class="nav-toggle" on:click={() => (menuOpen = !menuOpen)} aria-label="Toggle menu">
      Menu
    </button>
    <ul class="nav-links" class:open={menuOpen}>
      {#each nav as item}
        <li>
          <a
            href={item.href}
            class:active={route === item.key || (item.key === "upcoming-events" && route === "event-detail")}
            on:click={() => (menuOpen = false)}
          >
            {item.label}
          </a>
        </li>
      {/each}
    </ul>
  </nav>
</header>

<main>
  {#if route === "home"}
    <Home />
  {:else if route === "past-events"}
    <PastEvents />
  {:else if route === "upcoming-events"}
    <UpcomingEvents />
  {:else if route === "join-us"}
    <JoinUs />
  {:else if route === "event-detail"}
    <EventDetail id={param} />
  {:else if route === "admin"}
    <Admin />
  {/if}
</main>

<footer class="site-footer">
  <div class="container">
    <h3>SOUP</h3>
    <p>
      Students for Outdoor Unsupervised Playtime · Cornell University · Since 2020<br />
      SOUP is not an officially registered organization at Cornell.
    </p>
    <p>
      Instagram: cornell__soup · Email:
      <a href="mailto:soup_cu@gmail.com">soup_cu@gmail.com</a> ·
      <a href="https://web.groupme.com/join_group/76748584/IpJpxdYO">GroupMe link</a>
    </p>
    <p>
      <a href="#/upcoming-events">Upcoming events</a> ·
      <a href="#/past-events">Past events</a> ·
      <a href="#/join-us">Join us</a> ·
      <a href="#/admin">Club admin</a>
    </p>
  </div>
</footer>
