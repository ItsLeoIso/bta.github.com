import { getHurtbox } from "../combat/Hurtbox.js";
import { getActiveAttackHitbox } from "../combat/Hitbox.js";

const COLORS = { background:"#090909", grid:"#202020", floor:"#55515a", accent:"#d7d0df", player:"#d9d4e2", opponent:"#8d8798", text:"#aaa4b2" };
const HITBOX_COLORS = Object.freeze({
  high: Object.freeze({ fill: "rgba(255, 155, 155, .16)", stroke: "#ff9b9b" }),
  mid: Object.freeze({ fill: "rgba(255, 224, 150, .16)", stroke: "#ffe096" }),
  low: Object.freeze({ fill: "rgba(145, 201, 255, .16)", stroke: "#91c9ff" })
});
export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas; this.context = canvas.getContext("2d", { alpha:false });
    if (!this.context) throw new Error("Canvas 2D context is unavailable.");
    this.width = 960; this.height = 540; this.pixelRatio = 1; this.resizeObserver = null;
    this.resize = this.resize.bind(this);
  }
  attach() {
    this.resize();
    if ("ResizeObserver" in window) { this.resizeObserver = new ResizeObserver(this.resize); this.resizeObserver.observe(this.canvas); }
    else window.addEventListener("resize", this.resize);
  }
  detach() { this.resizeObserver?.disconnect(); window.removeEventListener("resize", this.resize); }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width); this.height = Math.max(1, rect.height);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  }
  render(arena, alpha = 0, paused = false) {
    const ctx = this.context, width = this.width, height = this.height;
    const scale = Math.min(width / arena.width, height / arena.height);
    const offsetX = (width - arena.width * scale) / 2, offsetY = (height - arena.height * scale) / 2;
    ctx.fillStyle = COLORS.background; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.translate(offsetX, offsetY); ctx.scale(scale, scale);
    this.drawBackdrop(ctx, arena);
    this.drawFighter(ctx, arena.player, COLORS.player, alpha);
    this.drawFighter(ctx, arena.opponent, COLORS.opponent, alpha);
    this.drawCombatBoxes(ctx, arena);
    this.drawHud(ctx, arena);
    if (paused) {
      ctx.fillStyle = "rgba(0,0,0,.68)"; ctx.fillRect(0,0,arena.width,arena.height);
      ctx.fillStyle = COLORS.accent; ctx.textAlign = "center"; ctx.font = "bold 34px monospace";
      ctx.fillText("PAUSED", arena.width/2, arena.height/2);
    }
    ctx.restore();
  }
  drawBackdrop(ctx, arena) {
    ctx.fillStyle = COLORS.background; ctx.fillRect(0,0,arena.width,arena.height);
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let x=0; x<=arena.width; x+=48) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,arena.floorY); ctx.stroke(); }
    for (let y=0; y<=arena.floorY; y+=48) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(arena.width,y); ctx.stroke(); }
    ctx.fillStyle = "#151419"; ctx.fillRect(0,arena.floorY,arena.width,arena.height-arena.floorY);
    ctx.strokeStyle = COLORS.floor; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0,arena.floorY); ctx.lineTo(arena.width,arena.floorY); ctx.stroke();
    ctx.fillStyle = "#302b36"; ctx.fillRect(arena.width/2-1,0,2,arena.floorY);
  }
  drawFighter(ctx, fighter, color, alpha) {
    const x = fighter.previousX + (fighter.x-fighter.previousX)*alpha;
    const y = fighter.previousY + (fighter.y-fighter.previousY)*alpha;
    const fighterScale = 3;
    const bodyWidth = 42, bodyHeight = fighter.crouching ? 48 : 76, top = -bodyHeight;
    ctx.save();
    // Keep the ground shadow broad but flat while scaling the fighter itself.
    ctx.fillStyle = "#3b3542";
    ctx.fillRect(x-(bodyWidth* fighterScale+10)/2,y-8,bodyWidth*fighterScale+10,8);
    ctx.translate(x,y);
    ctx.scale(fighterScale,fighterScale);
    ctx.fillStyle = color;
    ctx.fillRect(-bodyWidth/2,top+18,bodyWidth,bodyHeight-18);
    ctx.fillRect(-17,top,34,27);
    ctx.fillStyle = "#090909";
    ctx.fillRect(fighter.facing*7,top+10,5,5);
    if (fighter.state?.action === "attack" && fighter.actionData?.phase === "active") {
      // A temporary animation cue; the active hit-level collision region is drawn separately.
      ctx.strokeStyle = "#f0e7ff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(fighter.facing * 14, top + 44);
      ctx.quadraticCurveTo(fighter.facing * 34, top + 20, fighter.facing * 54, top + 42);
      ctx.stroke();
    }
    ctx.restore();
  }
  drawCombatBoxes(ctx, arena) {
    const fighters = [arena.player, arena.opponent];
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    for (const fighter of fighters) {
      const hurtbox = getHurtbox(fighter);
      ctx.strokeStyle = fighter === arena.player ? "#8ea6ff" : "#c39aff";
      ctx.strokeRect(
        hurtbox.left,
        hurtbox.top,
        hurtbox.right - hurtbox.left,
        hurtbox.bottom - hurtbox.top
      );
    }

    const hitbox = getActiveAttackHitbox(arena.player);
    if (hitbox) {
      const colors = HITBOX_COLORS[arena.player.actionData.hitLevel] ?? HITBOX_COLORS.mid;
      ctx.setLineDash([]);
      ctx.fillStyle = colors.fill;
      ctx.strokeStyle = colors.stroke;
      ctx.fillRect(hitbox.left, hitbox.top, hitbox.right-hitbox.left, hitbox.bottom-hitbox.top);
      ctx.strokeRect(hitbox.left, hitbox.top, hitbox.right-hitbox.left, hitbox.bottom-hitbox.top);
    }

    if (arena.lastHit) {
      ctx.globalAlpha = Math.min(1, arena.lastHit.remaining / 0.12);
      ctx.fillStyle = HITBOX_COLORS[arena.lastHit.hitLevel]?.stroke ?? "#ffe096";
      ctx.font = "bold 22px monospace";
      ctx.textAlign = "center";
      const level = arena.lastHit.hitLevel?.toUpperCase();
      const label = [level, arena.lastHit.moveName.toUpperCase(), "HIT"].filter(Boolean).join(" ");
      ctx.fillText(label, arena.lastHit.x, arena.lastHit.y);
    }
    ctx.restore();
  }

  drawHud(ctx, arena) {
    ctx.fillStyle = COLORS.text; ctx.font = "bold 16px monospace"; ctx.textAlign = "left"; ctx.fillText("PLAYER 01",32,22);
    ctx.textAlign = "right"; ctx.fillText("CPU DUMMY",arena.width-32,22);
    ctx.fillStyle = "#302d35"; ctx.fillRect(32,30,300,12); ctx.fillRect(arena.width-332,30,300,12);
    ctx.fillStyle = COLORS.player; ctx.fillRect(32,30,300*arena.player.health,12);
    ctx.fillStyle = COLORS.opponent; ctx.fillRect(arena.width-332+300*(1-arena.opponent.health),30,300*arena.opponent.health,12);
    ctx.textAlign = "center"; ctx.fillStyle = COLORS.accent; ctx.font = "bold 24px monospace"; ctx.fillText("99",arena.width/2,42);
  }
}
