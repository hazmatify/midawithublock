const easeOut = (t) => 1 - (1 - t) ** 3;

function animate(win, duration, onFrame, onDone) {
  const start = Date.now();
  const timer = setInterval(() => {
    if (win.isDestroyed()) return clearInterval(timer);

    const progress = Math.min((Date.now() - start) / duration, 1);
    onFrame(progress);

    if (progress === 1) {
      clearInterval(timer);
      onDone?.();
    }
  }, 1000 / 60);

  return () => clearInterval(timer);
}

module.exports = { animate, easeOut };
