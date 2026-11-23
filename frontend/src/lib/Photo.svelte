<script>
  // Redesign photo block. The mockups draw every photo as a labelled
  // gradient placeholder (".ph" in the mockup helmet CSS: sky-to-sand
  // gradient, two hill shapes, and a chip reading "Photo: <file>").
  // The real site has real photos, so: try the real <img> first (with
  // the existing raw-repo fallback in imgFallback); only when there is
  // no photo at all, or every source failed, render the mockup's
  // placeholder so the layout and label match the design either way.
  import { imgFallback } from "./api.js";

  export let src = "";
  export let file = "";
  export let label = "";
  export let height = 240;
  export let radius = 16;

  let failed = false;
  $: name = file || (src ? String(src).split("/").pop() : "");
  $: caption = name ? `Photo: ${name}${label ? `, ${label}` : ""}` : label;
</script>

{#if src && !failed}
  <div class="ph-wrap" style="height:{height}px;border-radius:{radius}px">
    <img
      src={src}
      alt={label || name}
      on:error={(e) => { if (!imgFallback(e)) failed = true; }}
    />
  </div>
{:else}
  <div
    class="ph"
    style="height:{height}px;border-radius:{radius}px"
    role="img"
    aria-label={caption}
  >
    <span>{caption}</span>
  </div>
{/if}
