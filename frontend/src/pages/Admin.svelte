<script>
  import { onMount } from "svelte";
  import { api, adminApi, adminLogin, adminLogout, getToken } from "../lib/api.js";

  let username = "admin";
  let password = "";
  let loggedIn = !!getToken();
  let loginError = "";
  let notice = "";
  let error = "";

  let events = [];
  let resources = [];
  let announcements = [];

  const TABLES = {
    events: {
      label: "Events",
      fields: [
        { name: "title", label: "Title", type: "text" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "location", label: "Location", type: "text" },
        { name: "event_date", label: "Date", type: "date" },
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
        { name: "title", label: "Title", type: "text" },
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
        { name: "title", label: "Title", type: "text" },
        { name: "body", label: "Body", type: "textarea" },
        { name: "pinned", label: "Pinned", type: "checkbox" },
      ],
    },
  };

  let drafts = { events: {}, resources: {}, announcements: {} };
  let editing = { events: null, resources: null, announcements: null };

  function emptyDraft(table) {
    const d = {};
    for (const f of TABLES[table].fields) {
      d[f.name] = f.type === "checkbox" ? false : "";
    }
    return d;
  }

  async function loadAll() {
    try {
      [events, resources, announcements] = await Promise.all([
        api.events("all"),
        api.resources(),
        api.announcements(),
      ]);
      error = "";
    } catch (e) {
      error = `Could not load content: ${e.message}`;
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
  }

  function cancelEdit(table) {
    drafts[table] = emptyDraft(table);
    editing[table] = null;
  }

  async function save(table) {
    notice = "";
    error = "";
    const body = { ...drafts[table] };
    // Blank spot counts: total spots is optional (null), but spots taken
    // is NOT NULL in the database — sending null for it made every
    // create with the field left blank fail with a 500. Default it to 0.
    if (body.spots_total === "") body.spots_total = null;
    else if (body.spots_total != null) body.spots_total = Number(body.spots_total);
    if (table === "events") {
      if (body.spots_taken === "" || body.spots_taken == null) body.spots_taken = 0;
      else body.spots_taken = Number(body.spots_taken);
    }
    try {
      if (editing[table]) {
        await adminApi.update(table, editing[table], body);
        notice = `${TABLES[table].label.slice(0, -1)} updated.`;
      } else {
        await adminApi.create(table, body);
        notice = `${TABLES[table].label.slice(0, -1)} created.`;
      }
      cancelEdit(table);
      await loadAll();
    } catch (e) {
      error = e.message;
    }
  }

  async function remove(table, id) {
    if (!confirm("Delete this item?")) return;
    try {
      await adminApi.remove(table, id);
      notice = "Item deleted.";
      await loadAll();
    } catch (e) {
      error = e.message;
    }
  }

  const lists = () => ({ events, resources, announcements });
</script>

<div class="container">
  <section class="section">
    <h2>Club admin</h2>
    <p class="section-sub">
      Manage events, resources, and announcements without touching code.
      Sign in with the admin account: username <strong>admin</strong>,
      password set in the hosting dashboard (Render → soup-website →
      Environment → ADMIN_PASSWORD).
    </p>

    {#if !loggedIn}
      <form
        class="stacked"
        on:submit|preventDefault={doLogin}
      >
        <label>
          Username
          <input bind:value={username} placeholder="admin" autocomplete="username" required />
        </label>
        <label>
          Password
          <input type="password" bind:value={password} autocomplete="current-password" required />
        </label>
        <div><button class="btn" type="submit">Log in</button></div>
        {#if loginError}
          <p class="error">{loginError}</p>
        {/if}
      </form>
    {:else}
      <p>
        <button class="btn btn-small" on:click={doLogout}>Log out</button>
      </p>
      {#if notice}
        <p class="notice">{notice}</p>
      {/if}
      {#if error}
        <p class="error">{error}</p>
      {/if}

      {#each Object.keys(TABLES) as table}
        <h3 style="margin-top: 2rem;">{TABLES[table].label}</h3>

        <form
          class="stacked"
          on:submit|preventDefault={() => save(table)}
        >
          {#each TABLES[table].fields as f}
            {#if f.type === "textarea"}
              <label>
                {f.label}
                <textarea bind:value={drafts[table][f.name]}></textarea>
              </label>
            {:else if f.type === "select"}
              <label>
                {f.label}
                <select bind:value={drafts[table][f.name]}>
                  {#each f.options as opt}
                    <option value={opt}>{opt}</option>
                  {/each}
                </select>
              </label>
            {:else if f.type === "checkbox"}
              <label>
                <input
                  type="checkbox"
                  bind:checked={drafts[table][f.name]}
                  style="width: auto;"
                />
                {f.label}
              </label>
            {:else if f.type === "number"}
              <label>
                {f.label}
                <input type="number" bind:value={drafts[table][f.name]} />
              </label>
            {:else if f.type === "date"}
              <label>
                {f.label}
                <input type="date" bind:value={drafts[table][f.name]} />
              </label>
            {:else if f.type === "time"}
              <label>
                {f.label}
                <input type="time" bind:value={drafts[table][f.name]} />
              </label>
            {:else}
              <label>
                {f.label}
                <input type="text" bind:value={drafts[table][f.name]} />
              </label>
            {/if}
          {/each}
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-small" type="submit">
              {editing[table] ? "Save changes" : "Create"}
            </button>
            {#if editing[table]}
              <button class="btn btn-small btn-ghost" style="color: var(--ink); border-color: var(--line);" type="button" on:click={() => cancelEdit(table)}>
                Cancel
              </button>
            {/if}
          </div>
        </form>

        <div style="margin-top: 1rem;">
          {#each lists()[table] as item}
            <div class="admin-item">
              <span>
                <strong>{item.title}</strong>
                {#if item.event_date}
                  <span class="meta"> · {String(item.event_date).slice(0, 10)}</span>
                {/if}
                {#if item.pinned}
                  <span class="tag pinned">Pinned</span>
                {/if}
              </span>
              <span class="admin-actions">
                <button class="btn btn-small" on:click={() => startEdit(table, item)}>Edit</button>
                <button class="btn btn-small btn-danger" on:click={() => remove(table, item.id)}>Delete</button>
              </span>
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </section>
</div>
