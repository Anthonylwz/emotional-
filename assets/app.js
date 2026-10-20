"use strict";

// Static catalog and device-local preferences. No account, database or build step.
const categories = [
  {
    key: "spanish",
    source: "spanishSongs",
    title: "Canciones en español",
    subtitle: "Para cantar eso que a veces cuesta decir.",
    label: "Canción en español",
  },
  {
    key: "english",
    source: "englishSongs",
    title: "Songs in English",
    subtitle: "Otra forma de conectar con lo que sientes.",
    label: "Canción en inglés",
  },
  {
    key: "hope",
    source: "hopCoreVideos",
    title: "Un poco de hope core",
    subtitle: "Pequeñas historias para hacer una pausa.",
    label: "Hope core",
  },
  {
    key: "tiktok",
    source: "tiktokVideos",
    title: "Momentos de TikTok",
    subtitle: "Algo breve. Algo que conecta.",
    label: "TikTok",
  },
];
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const normalize = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const videos = categories.flatMap((category) => {
  const unique = [
    ...new Map(
      videoData[category.source].map((item) => [
        typeof item === "string" ? item : item.id,
        item,
      ]),
    ).values(),
  ];
  return unique.map((item, index) => {
    const isYouTube = typeof item === "string";
    const id = isYouTube ? item : item.id;
    return {
      id,
      key: `${isYouTube ? "youtube" : "tiktok"}:${id}`,
      category: category.key,
      platform: isYouTube ? "YouTube" : "TikTok",
      user: isYouTube ? "" : item.user,
      // Descriptive labels instead of inventing unverified song titles.
      title: isYouTube
        ? `${category.label} · ${String(index + 1).padStart(2, "0")}`
        : `@${item.user}`,
      url: isYouTube
        ? `https://www.youtube.com/watch?v=${id}`
        : `https://www.tiktok.com/@${item.user}/video/${id}`,
    };
  });
});
const favoriteStorageKey = "emotional:favorites:v1";
let favorites = new Set();
let storageAvailable = true;
try {
  const stored = JSON.parse(localStorage.getItem(favoriteStorageKey) || "[]");
  if (Array.isArray(stored))
    favorites = new Set(
      stored.filter((key) => videos.some((video) => video.key === key)),
    );
} catch {
  storageAvailable = false;
}
const state = {
  filter: "all",
  query: "",
  order: [...videos],
  limits: Object.fromEntries(categories.map((category) => [category.key, 3])),
  scroll: {},
};
let toastTimer;
function notify(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3000);
}
function saveFavorites() {
  try {
    localStorage.setItem(favoriteStorageKey, JSON.stringify([...favorites]));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  $("#favorite-count").textContent = favorites.size;
}
function updateFavoriteButtons() {
  $$(".favorite-button").forEach((button) => {
    const selected = favorites.has(button.dataset.key);
    const video = videos.find((item) => item.key === button.dataset.key);
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute(
      "aria-label",
      `${selected ? "Quitar de" : "Guardar en"} favoritos: ${video.title}`,
    );
    button.textContent = selected ? "♥" : "♡";
  });
  $("#favorite-count").textContent = favorites.size;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function createCard(video, order) {
  const card = element("article", "media-card card-enter");
  card.style.setProperty("--order", order);
  const poster = element("button", "poster");
  poster.type = "button";
  poster.setAttribute("aria-label", `Reproducir ${video.title}`);
  poster.addEventListener("click", () => openVideo(video));
  if (video.platform === "YouTube") {
    const fallback = element("div", "tiktok-art");
    fallback.setAttribute("aria-hidden", "true");
    fallback.append(
      element("span", "", "♫"),
      element(
        "small",
        "",
        video.category === "spanish" ? "SIENTE LA MÚSICA" : "FEEL THE MUSIC",
      ),
    );
    poster.append(fallback);
    const image = element("img");
    image.src = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 480;
    image.height = 360;
    image.addEventListener(
      "error",
      () => {
        image.remove();
        poster.classList.add("image-unavailable");
      },
      { once: true },
    );
    poster.append(image);
  } else {
    const art = element("div", "tiktok-art");
    art.setAttribute("aria-hidden", "true");
    art.append(
      element("span", "", video.category === "hope" ? "✳" : "♪"),
      element(
        "small",
        "",
        video.category === "hope" ? "A LITTLE HOPE" : "FEEL SOMETHING",
      ),
    );
    poster.append(art);
  }
  const play = element("span", "play-icon", "▶");
  play.setAttribute("aria-hidden", "true");
  poster.append(
    element("span", "platform-badge", video.platform.toUpperCase()),
    play,
  );
  const meta = element("div", "video-meta");
  const copy = element("div");
  copy.append(
    element("h4", "", video.title),
    element(
      "p",
      "",
      video.platform === "YouTube"
        ? "Música · YouTube"
        : `${categories.find((category) => category.key === video.category).label} · TikTok`,
    ),
  );
  const favorite = element("button", "favorite-button");
  favorite.type = "button";
  favorite.dataset.key = video.key;
  favorite.addEventListener("click", () => {
    const removing = favorites.has(video.key);
    if (removing) favorites.delete(video.key);
    else favorites.add(video.key);
    saveFavorites();
    updateFavoriteButtons();
    favorite.classList.remove("popped");
    void favorite.offsetWidth;
    favorite.classList.add("popped");
    notify(
      storageAvailable
        ? removing
          ? "Eliminado de tus favoritos"
          : "Guardado para otro momento ♡"
        : "Favoritos disponibles durante esta visita; el navegador no permite guardarlos.",
    );
    if (state.filter === "favorites" && removing) {
      // Keep keyboard focus at the next available action after removing a card.
      const previousIndex = $$(".favorite-button").indexOf(favorite);
      render();
      const buttons = $$(".favorite-button");
      (
        buttons[Math.min(previousIndex, buttons.length - 1)] ||
        $("#clear-filters")
      ).focus();
    }
  });
  meta.append(copy, favorite);
  card.append(poster, meta);
  return card;
}
function rememberScroll() {
  $$(".media-grid").forEach((grid) => {
    state.scroll[grid.dataset.category] = grid.scrollLeft;
  });
}
function getMatches() {
  const query = normalize(state.query.trim());
  return state.order.filter((video) => {
    const category = categories.find((item) => item.key === video.category);
    return (
      (state.filter === "all" ||
        video.category === state.filter ||
        (state.filter === "favorites" && favorites.has(video.key))) &&
      normalize(
        `${video.title} ${video.platform} ${category.title} ${category.label}`,
      ).includes(query)
    );
  });
}
function render() {
  rememberScroll();
  const matches = getMatches();
  const fragment = document.createDocumentFragment();
  categories.forEach((category, categoryIndex) => {
    const items = matches.filter((video) => video.category === category.key);
    if (!items.length) return;
    const section = element("section", "category");
    section.dataset.category = category.key;
    section.setAttribute("aria-labelledby", `title-${category.key}`);
    const heading = element("div", "category-header");
    const titleWrap = element("div");
    const titleRow = element("div", "category-title");
    const title = element("h3", "", category.title);
    title.id = `title-${category.key}`;
    titleRow.append(
      element(
        "span",
        "category-number",
        String(categoryIndex + 1).padStart(2, "0"),
      ),
      title,
    );
    titleWrap.append(
      titleRow,
      element("p", "category-subtitle", category.subtitle),
    );
    const controls = element("div", "category-controls");
    const grid = element("div", "media-grid");
    grid.dataset.category = category.key;
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", category.title);
    grid.tabIndex = 0;
    const arrows = [-1, 1].map((direction) => {
      const button = element(
        "button",
        "icon-button",
        direction < 0 ? "←" : "→",
      );
      button.setAttribute(
        "aria-label",
        `${direction < 0 ? "Anterior" : "Siguiente"} en ${category.title}`,
      );
      button.addEventListener("click", () => {
        const card = grid.querySelector(".media-card");
        const step =
          card.getBoundingClientRect().width +
          parseFloat(getComputedStyle(grid).columnGap);
        grid.scrollBy({
          left: direction * step,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
      });
      controls.append(button);
      return button;
    });
    const updateArrows = () => {
      arrows[0].disabled = grid.scrollLeft <= 2;
      arrows[1].disabled =
        grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 2;
    };
    grid.addEventListener(
      "scroll",
      () => {
        state.scroll[category.key] = grid.scrollLeft;
        updateArrows();
      },
      { passive: true },
    );
    // DOM is replaced on filters; use a single window resize handler below.
    grid.updateArrows = updateArrows;
    const limit = state.limits[category.key];
    items
      .slice(0, limit)
      .forEach((video, index) => grid.append(createCard(video, index % 3)));
    heading.append(titleWrap, controls);
    const footer = element("div", "category-footer");
    footer.append(
      element(
        "span",
        "",
        `${Math.min(limit, items.length)} de ${items.length} momentos`,
      ),
    );
    if (limit < items.length) {
      const more = element(
        "button",
        "load-more",
        `Ver más · ${items.length - limit} restantes +`,
      );
      more.setAttribute("aria-label", `Cargar más en ${category.title}`);
      more.addEventListener("click", () => {
        const oldLimit = state.limits[category.key];
        state.limits[category.key] += 3;
        render();
        const next = document.querySelector(
          `[data-category="${category.key}"] .media-card:nth-child(${oldLimit + 1}) .poster`,
        );
        if (next) {
          next.focus({ preventScroll: true });
          next.scrollIntoView({
            block: "nearest",
            inline: "start",
            behavior: "instant",
          });
        }
        notify(`Más momentos en ${category.title}`);
      });
      footer.append(more);
    }
    section.append(heading, grid, footer);
    fragment.append(section);
  });
  $("#catalog").replaceChildren(fragment);
  $("#result-count").textContent = `${matches.length} momentos`;
  $("#empty").hidden = matches.length > 0;
  const emptyFavorites = state.filter === "favorites" && !state.query;
  $("#empty-title").textContent = emptyFavorites
    ? "Tu espacio empieza aquí."
    : "Todavía no hay coincidencias.";
  $("#empty-description").textContent = emptyFavorites
    ? "Guarda un video con el corazón para volver a encontrarlo."
    : "Prueba con otro creador, idioma o categoría.";
  updateFavoriteButtons();
  requestAnimationFrame(() =>
    $$(".media-grid").forEach((grid) => {
      grid.scrollLeft = state.scroll[grid.dataset.category] || 0;
      grid.updateArrows();
    }),
  );
}
function applyFilter(filter, updateUrl = true) {
  const valid = [
    "all",
    "favorites",
    ...categories.map((category) => category.key),
  ];
  state.filter = valid.includes(filter) ? filter : "all";
  $$(".filter").forEach((button) => {
    const selected = button.dataset.filter === state.filter;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (updateUrl) {
    const url = new URL(location.href);
    if (state.filter === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", state.filter);
    url.hash = "explorar";
    history.replaceState(null, "", url);
  }
  render();
}
$$(".filter").forEach((button) =>
  button.addEventListener("click", () => applyFilter(button.dataset.filter)),
);
$("#nav-favorites").addEventListener("click", () => {
  applyFilter("favorites");
  $("#explorar").focus({ preventScroll: true });
  $("#explorar").scrollIntoView();
});
$("#search").addEventListener("input", (event) => {
  state.query = event.target.value;
  state.scroll = {};
  render();
});
$("#clear-filters").addEventListener("click", () => {
  state.query = "";
  $("#search").value = "";
  applyFilter("all");
  $('[data-filter="all"]').focus();
});
$("#shuffle").addEventListener("click", () => {
  for (let i = state.order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
  }
  state.scroll = {};
  $$(".media-grid").forEach((grid) => {
    grid.scrollLeft = 0;
  });
  render();
  notify("Un nuevo orden para descubrir algo distinto");
});
window.addEventListener(
  "resize",
  () => $$(".media-grid").forEach((grid) => grid.updateArrows()),
  { passive: true },
);

// The YouTube script is requested only after the user chooses a video.
let youtubePromise;
function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubePromise) return youtubePromise;
  youtubePromise = new Promise((resolve, reject) => {
    const script = element("script");
    let finished = false;
    const fail = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      script.remove();
      youtubePromise = undefined;
      window.onYouTubeIframeAPIReady = undefined;
      reject(
        new Error(
          "YouTube no pudo cargarse. Revisa tu conexión y vuelve a intentarlo.",
        ),
      );
    };
    const timeout = setTimeout(fail, 12000);
    window.onYouTubeIframeAPIReady = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve(window.YT);
    };
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  });
  return youtubePromise;
}
let activeVideo = null;
let player = null;
let playerTimer;
let playGeneration = 0;
function destroyPlayer() {
  playGeneration++;
  clearTimeout(playerTimer);
  if (player) {
    try {
      player.destroy();
    } catch {
      /* A failed external player may already be gone. */
    }
  }
  player = null;
  $("#player-stage").replaceChildren();
}
function playbackError(message) {
  clearTimeout(playerTimer);
  $("#player-status").textContent = message;
  $("#retry-player").hidden = false;
  $("#player-stage .loader")?.remove();
}
async function startPlayback() {
  destroyPlayer();
  const generation = playGeneration;
  const video = activeVideo;
  const stage = $("#player-stage");
  stage.classList.toggle("vertical", video.platform === "TikTok");
  stage.append(element("div", "loader"));
  $("#retry-player").hidden = true;
  $("#player-status").textContent = "Conectando con la plataforma…";
  playerTimer = setTimeout(() => {
    if (generation === playGeneration)
      playbackError(
        "La plataforma está tardando. Puedes reintentar o abrir el video directamente.",
      );
  }, 18000);
  if (video.platform === "YouTube") {
    try {
      const YT = await loadYouTube();
      if (generation !== playGeneration || !$("#player-dialog").open) return;
      stage.replaceChildren();
      const container = element("div");
      stage.append(container);
      player = new YT.Player(container, {
        host: "https://www.youtube-nocookie.com",
        videoId: video.id,
        playerVars: { playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: (event) => {
            if (generation !== playGeneration) return;
            clearTimeout(playerTimer);
            $("#player-status").textContent =
              "Listo. Si no comienza automáticamente, pulsa play en el reproductor.";
            $("#retry-player").hidden = true;
            event.target.playVideo();
          },
          onError: () => {
            if (generation === playGeneration)
              playbackError(
                "Este video no está disponible para reproducirse aquí. Prueba abrirlo en YouTube.",
              );
          },
          onStateChange: (event) => {
            if (
              generation === playGeneration &&
              event.data === YT.PlayerState.ENDED
            )
              $("#player-status").textContent =
                "Tómate tu tiempo. Cuando quieras, elige otro momento.";
          },
        },
      });
    } catch (error) {
      if (generation === playGeneration) playbackError(error.message);
    }
  } else {
    const frame = element("iframe");
    frame.title = `Video de TikTok de ${video.user}`;
    frame.src = `https://www.tiktok.com/embed/v2/${video.id}?lang=es`;
    frame.allow = "fullscreen";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.addEventListener("load", () => {
      if (generation !== playGeneration) return;
      clearTimeout(playerTimer);
      stage.querySelector(".loader")?.remove();
      $("#player-status").textContent =
        "Si TikTok no muestra el video, ábrelo directamente en su plataforma.";
    });
    frame.addEventListener("error", () => {
      if (generation === playGeneration)
        playbackError("No se pudo cargar TikTok. Prueba el enlace directo.");
    });
    stage.append(frame);
  }
}
function openVideo(video) {
  activeVideo = video;
  $("#player-title").textContent = video.title;
  $("#player-platform").textContent = video.platform;
  $("#external-video").href = video.url;
  $("#external-video").textContent = `Abrir en ${video.platform} ↗`;
  $("#player-dialog").showModal();
  $("#close-player").focus();
  startPlayback();
}
$("#close-player").addEventListener("click", () => $("#player-dialog").close());
$("#retry-player").addEventListener("click", startPlayback);
$("#player-dialog").addEventListener("close", () => {
  destroyPlayer();
  activeVideo = null;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && $("#player-dialog").open) $("#player-dialog").close();
});
// Native dialogs provide Escape handling, focus trapping and focus restoration.
$$("dialog").forEach((dialog) => {
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [
      ...dialog.querySelectorAll(
        "button:not(:disabled), a[href], iframe, input",
      ),
    ].filter((node) => !node.hidden && node.getClientRects().length);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === dialog)
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || document.activeElement === dialog)
    ) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
    )
      dialog.close();
  });
});
$$("[data-close]").forEach((button) =>
  button.addEventListener("click", () =>
    document.getElementById(button.dataset.close).close(),
  ),
);
$("#open-yape").addEventListener("click", () => $("#yape-dialog").showModal());
$("#open-privacy").addEventListener("click", () =>
  $("#privacy-dialog").showModal(),
);
$("#erase-favorites").addEventListener("click", () => {
  favorites.clear();
  saveFavorites();
  render();
  $("#erase-favorites").textContent = "Favoritos borrados";
});
window.addEventListener("storage", (event) => {
  if (event.key !== favoriteStorageKey && event.key !== null) return;
  try {
    const stored = JSON.parse(event.newValue || "[]");
    favorites = new Set(
      Array.isArray(stored)
        ? stored.filter((key) => videos.some((video) => video.key === key))
        : [],
    );
    render();
  } catch {
    /* Keep current favorites if another tab stores malformed data. */
  }
});
applyFilter(
  new URLSearchParams(location.search).get("category") || "all",
  false,
);
