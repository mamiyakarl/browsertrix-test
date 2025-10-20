// youtube-hd.behavior.js — Browsertrix Web UI

class YouTubeHDBehavior {
  static id = "YouTube HD (custom; enlarge + request HD)";
  static runInIframes = true;

  static init(ctx) {
    // must return an object
    return { state: {} };
  }

  static isMatch() {
    // run on pages with a YT iframe or inside the YT iframe doc
    const hasYTFrame = !!document.querySelector(
      'iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]'
    );
    const host = (location.hostname || "").toLowerCase();
    const isYTDoc =
      host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com");
    return hasYTFrame || isYTDoc;
  }

  async awaitPageLoad() {
    await new Promise((r) => setTimeout(r, 1500));
  }

  static _post(frame, func, args = []) {
    try {
      frame.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "*"
      );
    } catch (_) {}
  }

  async* run(ctx) {
    const { Lib } = ctx;
    yield Lib.getState("YT-HD: start", "start");

    // big viewport helps YT pick HD
    try {
      if (window.outerWidth < 1600 || window.outerHeight < 900) {
        window.resizeTo(1600, 900);
      }
    } catch (_) {}

    const host = (location.hostname || "").toLowerCase();
    const isYTDoc =
      host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com");

    if (!isYTDoc) {
      // parent page: operate on iframes
      const iframes = Array.from(
        document.querySelectorAll('iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]')
      );
      yield Lib.getState(`YT-HD: found ${iframes.length} iframe(s)`, "ifr");

      for (const frame of iframes) {
        try {
          // make sure it's in view and large
          frame.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
          frame.width  = Math.max(parseInt(frame.width  || "0", 10), 1280);
          frame.height = Math.max(parseInt(frame.height || "0", 10), 720);
          frame.style.visibility = "visible";
          frame.style.opacity = "1";

          const u = new URL(frame.src, document.baseURI);
          // add player hints
          u.searchParams.set("enablejsapi", "1");
          u.searchParams.set("autoplay", "1");
          u.searchParams.set("mute", "1");        // autoplay-friendly
          u.searchParams.set("playsinline", "1");
          u.searchParams.set("vq", "hd1080");     // hint only
          const newSrc = u.toString();
          if (newSrc !== frame.src) {
            frame.src = newSrc;
            yield Lib.getState("YT-HD: iframe src updated (jsapi+autoplay+mute+vq)", "upd");
          }
        } catch (_) {}
      }

      // give reload time
      await new Promise((r) => setTimeout(r, 2000));

      // request playback + HD
      for (const frame of iframes) {
        YouTubeHDBehavior._post(frame, "mute");
        YouTubeHDBehavior._post(frame, "playVideo");
        YouTubeHDBehavior._post(frame, "setPlaybackQuality", ["hd1080"]);
      }
      yield Lib.getState("YT-HD: sent play + setPlaybackQuality", "req");

    } else {
      // inside the iframe doc (youtube.com)
      const video = document.querySelector("video");
      if (video) {
        try {
          video.muted = true;
          await video.play().catch(() => {});
          yield Lib.getState("YT-HD: played <video> inside iframe", "play");
        } catch (_) {}
      } else {
        yield Lib.getState("YT-HD: no <video> in iframe", "novid");
      }
    }

    // let higher bitrate segments arrive
    await new Promise((r) => setTimeout(r, 12000));
    yield Lib.getState("YT-HD: done", "done");
  }
}
