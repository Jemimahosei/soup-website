<script>
  import { onMount } from "svelte";
  import Home from "./pages/Home.svelte";
  import PastEvents from "./pages/PastEvents.svelte";
  import UpcomingEvents from "./pages/UpcomingEvents.svelte";
  import JoinUs from "./pages/JoinUs.svelte";
  import EventDetail from "./pages/EventDetail.svelte";
  import Admin from "./pages/Admin.svelte";

  let route = "home";
  let param = null;
  let menuOpen = false;

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

  // Mockup header nav: Upcoming · Past events · Join (orange CTA).
  // Home is the logo. Club admin was footer-only in the mockups;
  // Jemimah asked for a more conspicuous entry, so it is also an
  // outlined button in the header nav (footer link kept).
  const nav = [
    { href: "#/upcoming-events", label: "Upcoming", key: "upcoming-events" },
    { href: "#/past-events", label: "Past events", key: "past-events" },
    { href: "#/join-us", label: "Join", key: "join-us" },
  ];
</script>

{#if route === "admin"}
  <!-- Admin screens (mockups 05/07/09) have their own chrome:
       login header / navy sidebar, no public header or footer. -->
  <Admin />
{:else}
  <header class="site-header">
    <a class="brand" href="#/">
      <span class="brand-badge">S</span>SOUP
    </a>
    <button
      class="nav-toggle"
      on:click={() => (menuOpen = !menuOpen)}
      aria-label="Menu"
      aria-expanded={menuOpen}
    >
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="#12384a" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>
    </button>
    <nav class="site-nav" class:open={menuOpen} aria-label="Main">
      {#each nav as item}
        <a
          href={item.href}
          class:active={route === item.key}
          class:nav-join={item.key === "join-us"}
          class:cta={item.key === "join-us"}
          on:click={() => (menuOpen = false)}
        >
          {item.label}
        </a>
      {/each}
      <a href="#/admin" class="nav-admin" on:click={() => (menuOpen = false)}>Club admin</a>
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
    {/if}
  </main>

  <footer class="site-footer">
    <div class="inner">
      <div class="blurb">
        <strong>SOUP</strong><br />
        Students for Outdoor Unsupervised Playtime at Cornell University. SOUP is not an officially registered organization at Cornell.
      </div>
      <div>
        Instagram: cornell__soup<br />
        Email: soup_cu@gmail.com
      </div>
      <div class="links">
        <a href="#/upcoming-events">Upcoming</a>
        <a href="#/past-events">Past events</a>
        <a href="#/join-us">Join</a>
        <a href="#/admin">Club admin</a>
      </div>
    </div>
  </footer>
{/if}
