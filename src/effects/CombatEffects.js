/**
 * Cosmetic-only combat feedback. All motion is deterministic and kept out of
 * fighter state / collision so presentation can never change gameplay results.
 */
export class CombatEffects {
  constructor() {
    this.particles = [];
    this.sequence = 0;
    this.shakeRemaining = 0;
    this.shakeDuration = 0;
    this.shakeMagnitude = 0;
    this.shakePhase = 0;
  }

  trigger(event) {
    if (!event || (event.type !== "hit" && event.type !== "block")) return false;

    const outcome = event.outcome ?? event.resolution?.outcome ?? event.type;
    const guardBreak = outcome === "guardBreak";
    const blocked = event.type === "block";
    const special = event.moveId === "arcLance" || event.moveId === "special";
    const heavy = event.moveId === "heavy";
    const palette = guardBreak
      ? ["#fff0ff", "#d9a0ff", "#a56ad1"]
      : blocked
        ? ["#e8f7ff", "#8ecbff", "#527ebc"]
        : special
          ? ["#fff0ff", "#d9a0ff", "#9764c6"]
          : event.hitLevel === "high"
            ? ["#fff0e8", "#ffb2c8", "#d96d91"]
            : event.hitLevel === "low"
              ? ["#f0fbff", "#8edbff", "#4e91c8"]
              : ["#fff9df", "#ffe096", "#d99a4f"];

    const count = guardBreak ? 15 : blocked ? 6 : (heavy || special ? 12 : 9);
    const duration = guardBreak ? 0.28 : blocked ? 0.14 : special ? 0.23 : 0.19;
    const magnitude = guardBreak ? 8 : blocked ? 2.2 : special ? 6.5 : heavy ? 5.8 : 4.2;
    const { x, y } = this.getContactPoint(event);

    this.sequence += 1;
    let seed = (Math.imul(this.sequence, 0x9e3779b1) + 0x85ebca6b) >>> 0;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    this.particles.push({
      kind: "ring", x, y,
      radius: blocked ? 4 : 7,
      radiusSpeed: guardBreak ? 330 : blocked ? 210 : 285,
      width: guardBreak ? 5 : blocked ? 2.5 : 3.5,
      life: duration, maxLife: duration, color: palette[0]
    });

    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index / count) + (random() - 0.5) * 0.42;
      const speed = (blocked ? 65 : 105) + random() * (blocked ? 95 : 175);
      const life = duration * (0.72 + random() * 0.38);
      this.particles.push({
        kind: "spark", x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: blocked ? 90 : 210,
        size: 2 + random() * (blocked ? 1.5 : 3.2),
        life, maxLife: life,
        color: palette[index % palette.length]
      });
    }

    this.particles = this.particles.slice(-96);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeRemaining = Math.max(this.shakeRemaining, duration);
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    return true;
  }

  getContactPoint(event) {
    if (Number.isFinite(event.projectile?.x) && Number.isFinite(event.projectile?.y)) {
      return { x: event.projectile.x, y: event.projectile.y };
    }
    const hitbox = event.hitbox;
    const hurtbox = event.hurtbox;
    if (hitbox && hurtbox) {
      const left = Math.max(hitbox.left, hurtbox.left);
      const right = Math.min(hitbox.right, hurtbox.right);
      const top = Math.max(hitbox.top, hurtbox.top);
      const bottom = Math.min(hitbox.bottom, hurtbox.bottom);
      if (right > left && bottom > top) {
        return { x: (left + right) / 2, y: (top + bottom) / 2 };
      }
    }
    return {
      x: event.defender?.x ?? 0,
      y: (event.defender?.y ?? 112) - 112
    };
  }

  update(deltaSeconds) {
    const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    for (const particle of this.particles) {
      particle.life -= delta;
      if (particle.kind === "ring") {
        particle.radius += particle.radiusSpeed * delta;
      } else {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vy += particle.gravity * delta;
        particle.vx *= Math.pow(0.08, delta);
      }
    }
    this.particles = this.particles.filter(particle => particle.life > 0);
    if (this.shakeRemaining > 0) {
      this.shakeRemaining = Math.max(0, this.shakeRemaining - delta);
      this.shakePhase += delta;
      if (this.shakeRemaining === 0) {
        this.shakeDuration = 0;
        this.shakeMagnitude = 0;
        this.shakePhase = 0;
      }
    }
  }

  getShakeOffset() {
    if (this.shakeRemaining <= 0 || this.shakeDuration <= 0) {
      return { x: 0, y: 0 };
    }
    const envelope = Math.pow(this.shakeRemaining / this.shakeDuration, 1.7);
    const phase = this.shakePhase * Math.PI * 2 * 42;
    return {
      x: Math.sin(phase) * this.shakeMagnitude * envelope,
      y: Math.cos(phase * 0.87) * this.shakeMagnitude * 0.55 * envelope
    };
  }

  reset() {
    this.particles = [];
    this.sequence = 0;
    this.shakeRemaining = 0;
    this.shakeDuration = 0;
    this.shakeMagnitude = 0;
    this.shakePhase = 0;
  }
}
