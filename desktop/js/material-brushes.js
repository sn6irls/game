/* Viscous glitter brush. Independent of desktop UI. */
window.MaterialBrushes = {
  glitter(g, from, to, size, seed) {
    const dx = to.x - from.x,
      dy = to.y - from.y,
      d = Math.hypot(dx, dy),
      count = Math.min(110, Math.ceil(d / 2) + 1),
      r = size * 0.65;
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(211,122,213,.42)';
    g.lineWidth = r * 2;
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(to.x + 0.1, to.y + 0.1);
    g.stroke();
    g.strokeStyle = 'rgba(255,232,255,.6)';
    g.lineWidth = Math.max(1, r * 0.25);
    g.beginPath();
    g.moveTo(from.x - r * 0.25, from.y - r * 0.35);
    g.lineTo(to.x - r * 0.25, to.y - r * 0.35);
    g.stroke();
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1),
        x = from.x + dx * t,
        y = from.y + dy * t;
      for (let k = 0; k < 4; k++) {
        const angle = Math.random() * 6.28,
          dist = Math.sqrt(Math.random()) * r * 0.82;
        g.fillStyle = ['#fff8dc', '#e6b6ff', '#ffec70', '#a8faff', '#ffb9e5'][
          Math.floor(Math.random() * 5)
        ];
        g.globalAlpha = 0.65 + Math.random() * 0.35;
        const s = 0.6 + Math.random() * 1.4;
        g.fillRect(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, s, s);
      }
    }
    g.restore();
  },
};
