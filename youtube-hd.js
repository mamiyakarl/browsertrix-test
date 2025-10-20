// Runs in the page context as a siteSpecific behavior
(async () => {
  // 1) Find YT iframes and ensure enablejsapi=1 so we can control them
  document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]').forEach((frame) => {
    const u = new URL(frame.src);
    if (!u.searchParams.has('enablejsapi')) {
      u.searchParams.set('enablejsapi', '1');
      // Ask nicely for HD; modern YT may still adapt, but this helps
      if (!u.searchParams.has('vq')) u.searchParams.set('vq', 'hd1080');
      frame.src = u.toString();
    }
    // Make sure the player is visible and large enough to request HD renditions
    frame.width = Math.max(parseInt(frame.width || '0', 10), 1280);
    frame.height = Math.max(parseInt(frame.height || '0', 10), 720);
  });

  // 2) Give iframes a moment to reload with enablejsapi
  await new Promise(r => setTimeout(r, 2000));

  // 3) Use postMessage API to request playback + HD quality
  const msg = (func, args=[]) => JSON.stringify({ event: "command", func, args });

  document.querySelectorAll('iframe[src*="youtube"]').forEach((frame) => {
    // Autoplay muted to satisfy policies; then ask for HD
    frame.contentWindow?.postMessage(msg('mute'), '*');
    frame.contentWindow?.postMessage(msg('playVideo'), '*');
    frame.contentWindow?.postMessage(msg('setPlaybackQuality', ['hd1080']), '*');
  });
})();
