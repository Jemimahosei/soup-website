<script>
  import { onMount } from "svelte";
  import { api, adminApi, adminLogin, adminLogout, getToken, fmtDateLong, todayNY } from "../lib/api.js";

  let username = "admin";
  let password = "";
  let loggedIn = !!getToken();
  let loginError = "";
  let notice = "";
  let error = "";

  let events = [];
  let resources = [];
  let announcements = [];

  // Field config kept from the previous admin: drafts are built from
  // these lists, and save() posts the whole draft, so every database
  // column stays editable even where the mockup form is terser
  // (difficulty / spots on events, description on resources).
  const TABLES = {
    events: {
      label: "Events",
      fields: [
        { name: "title", label: "Title", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea" },
        { name: "location", label: "Location", type: "text" },
        { name: "event_date", label: "Date", type: "date", required: true },
        { name: "start_time", label: "Start time", type: "time" },
        { name: "end_time", label: "End time", type: "time" },
        { name: "category", label: "Category", type: "select", options: ["game", "competition", "tradition", "trip", "social"] },
        { name: "difficulty", label: "Difficulty", type: "select", options: ["easy", "moderate", "hard"] },
        { name: "spots_total", label: "Total spots", type: "number" },
        { name: "spots_taken", label: "Spots taken", type: "number" },
        { name: "image_url", label: "Image URL (e.g. /images/ctf3.jpg)", type: "text" },
      ],
    },
    resources: {
      label: "Resources",
      fields: [
        { name: "title", label: "Title", type: "text", required: true },
        { name: "category", label: "Category", type: "select", options: ["story", "poem", "guide", "link"] },
        { name: "description", label: "Description", type: "textarea" },
        { name: "url", label: "URL (links only)", type: "text" },
        { name: "body", label: "Body", type: "textarea" },
        { name: "image_url", label: "Image URL (e.g. /images/leaf-pile3-tt.jpg)", type: "text" },
      ],
    },
    announcements: {
      label: "Announcements",
      fields: [
        { name: "title", label: "Title", type: "text", required: true },
        { name: "body", label: "Body", type: "textarea" },
        { name: "pinned", label: "Pinned", type: "checkbox" },
      ],
    },
  };

  let drafts = { events: {}, resources: {}, announcements: {} };
  let editing = { events: null, resources: null, announcements: null };

  // Two-step in-page delete confirmation, keyed "table:id" — same
  // mechanism as before (native confirm() is auto-dismissed in some
  // browsers), rendered as the mockup's inline "Delete this? …
  // Yes, delete / Keep it" row.
  let confirmingDelete = null;

  // Reactive lists (see note in git history: a function call in the
  // template never re-ran when data arrived; $: lists fixes that).
  $: lists = { events, resources, announcements };
  let listsLoading = false;

  // --- Redesign navigation state (mockups 07 + 09 are two screens) ---
  let view = "events"; // "events" | "content"
  let contentTab = "stories"; // "stories" | "poems" | "guides" | "news"
  const CONTENT_TABS = [
    { key: "stories", label: "Stories", add: "Add a story", one: "Story", table: "resources", cats: ["story"] },
    { key: "poems", label: "Poems", add: "Add a poem", one: "Poem", table: "resources", cats: ["poem"] },
    { key: "guides", label: "Guides and links", add: "Add a guide or link", one: "Guide or link", table: "resources", cats: ["guide", "link"] },
    { key: "news", label: "News", add: "Post news", one: "News post", table: "announcements", cats: [] },
  ];
  $: tab = CONTENT_TABS.find((t) => t.key === contentTab);
  $: contentRows =
    tab.table === "announcements"
      ? announcements
      : resources.filter((r) => tab.cats.includes(r.category));
  // Mockup admin events list is newest-first.
  $: eventRows = [...events].sort((a, b) =>
    String(a.event_date) < String(b.event_date) ? 1 : -1
  );

  const EVENT_TYPES = ["game", "competition", "tradition", "trip", "social"];
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  function eventStatus(e) {
    return String(e.event_date).slice(0, 10) >= todayNY() ? "Upcoming" : "Past";
  }

  function emptyDraft(table) {
    const d = {};
    for (const f of TABLES[table].fields) {
      d[f.name] = f.type === "checkbox" ? false : f.type === "select" ? f.options[0] : "";
    }
    return d;
  }

  function handleAuthError(e) {
    if (e && e.status === 401) {
      adminLogout();
      loggedIn = false;
      loginError = "Your session ended. Please log in again.";
      return true;
    }
    return false;
  }

  async function loadAll() {
    listsLoading = true;
    try {
      [events, resources, announcements] = await Promise.all([
        api.events("all"),
        api.resources(),
        api.announcements(),
      ]);
      error = "";
    } catch (e) {
      if (!handleAuthError(e)) error = `Could not load content: ${e.message}`;
    } finally {
      listsLoading = false;
    }
  }

  onMount(() => {
    drafts = {
      events: emptyDraft("events"),
      resources: emptyDraft("resources"),
      announcements: emptyDraft("announcements"),
    };
    if (loggedIn) loadAll();
  });

  async function doLogin() {
    loginError = "";
    try {
      await adminLogin(username, password);
      loggedIn = true;
      password = "";
      await loadAll();
    } catch (e) {
      loginError = e.message;
    }
  }

  async function doLogout() {
    await adminLogout();
    loggedIn = false;
  }

  function startEdit(table, item) {
    const d = {};
    for (const f of TABLES[table].fields) {
      let v = item[f.name];
      if (f.name === "event_date" && v) v = String(v).slice(0, 10);
      d[f.name] = v ?? (f.type === "checkbox" ? false : "");
    }
    drafts[table] = d;
    editing[table] = item.id;
    notice = "";
    error = "";
    confirmingDelete = null;
    if (table === "events") {
      view = "events";
    } else if (table === "announcements") {
      view = "content";
      contentTab = "news";
    } else {
      view = "content";
      const t = CONTENT_TABS.find((x) => x.table === "resources" && x.cats.includes(item.category));
      if (t) contentTab = t.key;
    }
  }

  function cancelEdit(table) {
    drafts[table] = emptyDraft(table);
    editing[table] = null;
  }

  // The mockups switch between a list screen and a form screen.
  // formMode mirrors that: "list" | "new" | "edit" per table.
  let formMode = { events: "list", resources: "list", announcements: "list" };
  function startNew(table) {
    cancelEdit(table);
    notice = "";
    error = "";
    confirmingDelete = null;
    if (table === "resources") {
      // Preset the category from the active tab (guides can switch to
      // "link" in the form's Kind select).
      drafts.resources.category = tab.cats[0];
    }
    formMode[table] = "new";
    formMode = { ...formMode };
  }
  function editItem(table, item) {
    startEdit(table, item);
    formMode[table] = "edit";
    formMode = { ...formMode };
  }
  function backToList(table) {
    cancelEdit(table);
    error = "";
    formMode[table] = "list";
    formMode = { ...formMode };
  }

  async function save(table) {
    notice = "";
    error = "";
    const body = { ...drafts[table] };
    // Mockup validation messages (events form / content form).
    if (!String(body.title || "").trim()) {
      error = table === "events" ? "Add a title so people know what it is." : "Add a title.";
      return;
    }
    if (table === "events" && !body.event_date) {
      error = "Pick a date.";
      return;
    }
    for (const f of TABLES[table].fields) {
      if (f.type === "select" && !body[f.name]) body[f.name] = f.options[0];
    }
    if (body.spots_total === "") body.spots_total = null;
    else if (body.spots_total != null) body.spots_total = Number(body.spots_total);
    if (table === "events") {
      if (body.spots_taken === "" || body.spots_taken == null) body.spots_taken = 0;
      else body.spots_taken = Number(body.spots_taken);
    }
    try {
      if (editing[table]) {
        await adminApi.update(table, editing[table], body);
        notice = "Changes saved.";
      } else {
        await adminApi.create(table, body);
        notice = table === "events" ? "Event published." : "Published.";
      }
      cancelEdit(table);
      formMode[table] = "list";
      formMode = { ...formMode };
      await loadAll();
    } catch (e) {
      if (!handleAuthError(e)) error = e.message;
    }
  }

  async function remove(table, id) {
    const key = `${table}:${id}`;
    if (confirmingDelete !== key) {
      confirmingDelete = key;
      return;
    }
    confirmingDelete = null;
    try {
      await adminApi.remove(table, id);
      notice =
        table === "events"
          ? "Event deleted."
          : table === "announcements"
            ? "News post deleted."
            : `${tab.one} deleted.`;
      await loadAll();
    } catch (e) {
      if (!handleAuthError(e)) error = e.message;
    }
  }

  function pickTab(key) {
    contentTab = key;
    confirmingDelete = null;
    notice = "";
    error = "";
  }
</script>

{#if !loggedIn}
  <!-- Mockup 05: Admin log in -->
  <div class="admin-page" style="background:var(--cream);display:flex;flex-direction:column;min-height:720px">
    <header class="login-head">
      <a class="brand" href="#/">
        <span class="brand-badge">S</span>SOUP
      </a>
      <a href="#/" style="min-height:44px;display:inline-flex;align-items:center;font-weight:600;text-decoration:none">Back to the site</a>
    </header>
    <main class="login-main">
      <form class="login-card" on:submit|preventDefault={doLogin}>
        <h1>Club admin</h1>
        <p class="sub">Add events, share stories and keep the site up to date.</p>
        {#if loginError}
          <div class="alert-error" role="alert">{loginError}</div>
        {/if}
        <label class="flabel" for="admin-username">Username</label>
        <input id="admin-username" class="f-input" type="text" bind:value={username} placeholder="admin" autocomplete="username" required />
        <label class="flabel" for="admin-password">Password</label>
        <input id="admin-password" class="f-input" type="password" bind:value={password} autocomplete="current-password" required />
        <button class="btn-cta cta" type="submit">Log in</button>
        <p class="forgot">Forgot the password? Ask whoever set up the site to reset it in the hosting settings.</p>
      </form>
    </main>
  </div>
{:else}
  <!-- Mockups 07 + 09: sidebar admin, two screens -->
  <div class="admin-page">
    <div class="admin-shell">
      <aside class="admin-side">
        <a class="side-brand" href="#/">
          <span class="side-badge">S</span>SOUP admin
        </a>
        <button type="button" class="side-link" class:active={view === "events"} on:click={() => (view = "events")}>Events</button>
        <button type="button" class="side-link" class:active={view === "content"} on:click={() => (view = "content")}>Stories, poems and news</button>
        <a class="side-link side-gap" href="#/">View the site</a>
        <button type="button" class="side-link" on:click={doLogout}>Log out</button>
      </aside>

      <main class="admin-main">
        {#if error && formMode[view === "events" ? "events" : tab.table] === "list"}
          <div class="alert-error" role="alert" style="margin-bottom:20px">{error}</div>
          <p><button type="button" class="btn-ghost btn-md ghost" on:click={loadAll}>Try again</button></p>
        {/if}

        {#if view === "events"}
          <div class="admin-head">
            <h1>{formMode.events === "list" ? "Events" : editing.events ? "Edit event" : "Add an event"}</h1>
            {#if formMode.events === "list"}
              <button type="button" class="btn-cta btn-md cta" on:click={() => startNew("events")}>Add an event</button>
            {/if}
          </div>

          {#if notice}<div class="notice" role="status">{notice}</div>{/if}

          {#if formMode.events === "list"}
            <div class="admin-list">
              {#if listsLoading}
                <div class="admin-empty"><p>Loading…</p></div>
              {:else if eventRows.length === 0}
                <div class="admin-empty">
                  <div class="t">No events yet.</div>
                  <p>Add the first one and it shows on the Upcoming page right away.</p>
                </div>
              {:else}
                {#each eventRows as e}
                  <div class="admin-row">
                    <div class="grow">
                      <div class="row-title">{e.title}</div>
                      <div class="row-sub">{fmtDateLong(e.event_date)}{e.location ? `, ${e.location}` : ""}</div>
                    </div>
                    <span class="pill {eventStatus(e) === 'Upcoming' ? 'pill-up' : 'pill-past'}">{eventStatus(e)}</span>
                    {#if confirmingDelete === `events:${e.id}`}
                      <div class="confirm-actions">
                        <span class="q">Delete this event? This can't be undone.</span>
                        <button type="button" class="btn-danger" on:click={() => remove("events", e.id)}>Yes, delete</button>
                        <button type="button" class="btn-ghost ghost" on:click={() => (confirmingDelete = null)}>Keep it</button>
                      </div>
                    {:else}
                      <div class="row-actions">
                        <button type="button" class="btn-ghost ghost" on:click={() => editItem("events", e)}>Edit</button>
                        <button type="button" class="btn-delete-ghost" on:click={() => remove("events", e.id)}>Delete</button>
                      </div>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>
          {:else}
            <form class="admin-form" on:submit|preventDefault={() => save("events")}>
              {#if error}<div class="alert-error" role="alert">{error}</div>{/if}
              <label class="flabel" for="ev-title">Title</label>
              <input id="ev-title" class="f-input" type="text" bind:value={drafts.events.title} placeholder="Fall camping trip" />
              <div class="form-3col">
                <div style="flex:1 1 200px">
                  <label class="flabel" for="ev-date">Date</label>
                  <input id="ev-date" class="f-input" type="date" bind:value={drafts.events.event_date} />
                </div>
                <div style="flex:1 1 140px">
                  <label class="flabel" for="ev-start">Starts</label>
                  <input id="ev-start" class="f-input" type="time" bind:value={drafts.events.start_time} />
                </div>
                <div style="flex:1 1 140px">
                  <label class="flabel" for="ev-end">Ends</label>
                  <input id="ev-end" class="f-input" type="time" bind:value={drafts.events.end_time} />
                </div>
              </div>
              <label class="flabel" for="ev-place">Where</label>
              <input id="ev-place" class="f-input" type="text" bind:value={drafts.events.location} placeholder="Danby State Forest" />
              <label class="flabel" for="ev-desc">What to know</label>
              <textarea id="ev-desc" class="f-input" bind:value={drafts.events.description} placeholder="What happens, what to bring, how to get there."></textarea>
              <div style="font-weight:600;margin-bottom:8px">Type of event</div>
              <div class="chip-row">
                {#each EVENT_TYPES as t}
                  <button type="button" class="chip" class:on={drafts.events.category === t} on:click={() => (drafts.events.category = t)}>{cap(t)}</button>
                {/each}
              </div>
              <div style="font-weight:600;margin-bottom:8px">Photo</div>
              <div class="photo-drop">
                <span class="hint">Drop a photo here or choose one. It shows on the event page and in the Past events list. Photos are referenced by address — paste the image URL (e.g. /images/ctf3.jpg).</span>
                <input class="f-input" type="text" bind:value={drafts.events.image_url} placeholder="/images/ctf3.jpg" aria-label="Image URL" />
                <span class="choose">Choose a photo</span>
              </div>
              <div class="form-3col">
                <div style="flex:1 1 160px">
                  <label class="flabel" for="ev-diff">Difficulty</label>
                  <select id="ev-diff" class="f-input" bind:value={drafts.events.difficulty}>
                    <option value="easy">easy</option>
                    <option value="moderate">moderate</option>
                    <option value="hard">hard</option>
                  </select>
                </div>
                <div style="flex:1 1 140px">
                  <label class="flabel" for="ev-spots-total">Total spots</label>
                  <input id="ev-spots-total" class="f-input" type="number" bind:value={drafts.events.spots_total} />
                </div>
                <div style="flex:1 1 140px">
                  <label class="flabel" for="ev-spots-taken">Spots taken</label>
                  <input id="ev-spots-taken" class="f-input" type="number" bind:value={drafts.events.spots_taken} />
                </div>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-cta cta">{editing.events ? "Save changes" : "Publish event"}</button>
                <button type="button" class="btn-ghost ghost" on:click={() => backToList("events")}>Cancel</button>
              </div>
            </form>
          {/if}
        {:else}
          <!-- Stories, poems and news -->
          <div class="admin-head">
            <h1>{formMode[tab.table] === "list" ? "Stories, poems and news" : editing[tab.table] ? `Edit ${tab.one.toLowerCase()}` : tab.add}</h1>
            {#if formMode[tab.table] === "list"}
              <button type="button" class="btn-cta btn-md cta" on:click={() => startNew(tab.table)}>{tab.add}</button>
            {/if}
          </div>

          <div class="tab-row">
            {#each CONTENT_TABS as t}
              <button type="button" class="chip" class:on={contentTab === t.key} on:click={() => pickTab(t.key)}>{t.label}</button>
            {/each}
          </div>

          {#if notice}<div class="notice" role="status">{notice}</div>{/if}

          {#if formMode[tab.table] === "list"}
            <div class="admin-list">
              {#if listsLoading}
                <div class="admin-empty"><p>Loading…</p></div>
              {:else if contentRows.length === 0}
                <div class="admin-empty">
                  <div class="t">Nothing here yet.</div>
                  <p>Use the orange button to add the first one.</p>
                </div>
              {:else}
                {#each contentRows as item}
                  <div class="admin-row">
                    <div class="grow">
                      <div class="row-title">{item.title}</div>
                      <div class="row-sub">{tab.table === "announcements" ? "Shown on the home page" : item.description || ""}</div>
                    </div>
                    {#if item.pinned}
                      <span class="pill pill-pin">Pinned</span>
                    {/if}
                    {#if confirmingDelete === `${tab.table}:${item.id}`}
                      <div class="confirm-actions">
                        <span class="q">Delete this? This can't be undone.</span>
                        <button type="button" class="btn-danger" on:click={() => remove(tab.table, item.id)}>Yes, delete</button>
                        <button type="button" class="btn-ghost ghost" on:click={() => (confirmingDelete = null)}>Keep it</button>
                      </div>
                    {:else}
                      <div class="row-actions">
                        <button type="button" class="btn-ghost ghost" on:click={() => editItem(tab.table, item)}>Edit</button>
                        <button type="button" class="btn-delete-ghost" on:click={() => remove(tab.table, item.id)}>Delete</button>
                      </div>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>
          {:else}
            <form class="admin-form" on:submit|preventDefault={() => save(tab.table)}>
              {#if error}<div class="alert-error" role="alert">{error}</div>{/if}
              <label class="flabel" for="c-title">Title</label>
              <input id="c-title" class="f-input" type="text" bind:value={drafts[tab.table].title} />
              {#if contentTab === "guides"}
                <label class="flabel" for="c-kind">Kind</label>
                <select id="c-kind" class="f-input" bind:value={drafts.resources.category}>
                  <option value="guide">guide</option>
                  <option value="link">link</option>
                </select>
                <label class="flabel" for="c-url">Link address, if it is a link</label>
                <input id="c-url" class="f-input" type="text" bind:value={drafts.resources.url} placeholder="https://" />
              {/if}
              {#if tab.table === "resources"}
                <label class="flabel" for="c-desc">Short line (shown under the title)</label>
                <input id="c-desc" class="f-input" type="text" bind:value={drafts.resources.description} />
              {/if}
              <label class="flabel" for="c-body">Text</label>
              <textarea id="c-body" class="f-input" style="min-height:180px" bind:value={drafts[tab.table].body}></textarea>
              {#if contentTab === "stories"}
                <div style="font-weight:600;margin-bottom:8px">Photo</div>
                <div class="photo-drop">
                  <span class="hint">Drop a photo here or choose one. Photos are referenced by address — paste the image URL (e.g. /images/leaf-pile3.jpg).</span>
                  <input class="f-input" type="text" bind:value={drafts.resources.image_url} placeholder="/images/leaf-pile3.jpg" aria-label="Image URL" />
                  <span class="choose">Choose a photo</span>
                </div>
              {/if}
              {#if contentTab === "news"}
                <button type="button" class="pin-toggle" aria-pressed={!!drafts.announcements.pinned} on:click={() => (drafts.announcements.pinned = !drafts.announcements.pinned)}>
                  <span class="pin-box" style="background:{drafts.announcements.pinned ? '#12384a' : '#fff'}">
                    {#if drafts.announcements.pinned}
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="#fff6dc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"></path></svg>
                    {/if}
                  </span>
                  Pin to the top of the home page
                </button>
              {/if}
              <div class="form-actions">
                <button type="submit" class="btn-cta cta">{editing[tab.table] ? "Save changes" : "Publish"}</button>
                <button type="button" class="btn-ghost ghost" on:click={() => backToList(tab.table)}>Cancel</button>
              </div>
            </form>
          {/if}
        {/if}
      </main>
    </div>
  </div>
{/if}
