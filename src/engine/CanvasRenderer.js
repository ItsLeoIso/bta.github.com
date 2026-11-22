import { getHurtbox } from "../combat/Hurtbox.js";
import { getActiveAttackHitbox } from "../combat/Hitbox.js";
import { ROUND_PHASES } from "../combat/RoundController.js";

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
    this.showHitboxes = false;
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
    const cameraX = (arena.previousCameraX ?? arena.cameraX ?? 0) +
      ((arena.cameraX ?? 0) - (arena.previousCameraX ?? arena.cameraX ?? 0)) * alpha;
    ctx.save(); ctx.translate(-cameraX, 0);
    this.drawBackdrop(ctx, arena);
    this.drawFighter(ctx, arena.player, COLORS.player, alpha);
    this.drawFighter(ctx, arena.opponent, COLORS.opponent, alpha);
    this.drawProjectiles(ctx, arena);
    this.drawCombatBoxes(ctx, arena);
    ctx.restore();
    this.drawHud(ctx, arena);
    this.drawComboCounter(ctx, arena);
    this.drawInputBuffer(ctx, arena);
    this.drawCommandFeedback(ctx, arena);
    this.drawRoundOverlay(ctx, arena);
    if (paused) {
      ctx.fillStyle = "rgba(0,0,0,.68)"; ctx.fillRect(0,0,arena.width,arena.height);
      ctx.fillStyle = COLORS.accent; ctx.textAlign = "center"; ctx.font = "bold 34px monospace";
      ctx.fillText("PAUSED", arena.width/2, arena.height/2);
    }
    ctx.restore();
  }
  drawBackdrop(ctx, arena) {
    const worldWidth=arena.worldWidth ?? arena.width;
    const horizon=arena.floorY;

    // A compact neon-city skyline, drawn in world space so it scrolls with the
    // stage while the fighters and screen-space HUD keep their existing layers.
    const sky=ctx.createLinearGradient(0,0,0,horizon);
    sky.addColorStop(0,"#090a16");
    sky.addColorStop(0.62,"#171226");
    sky.addColorStop(1,"#302039");
    ctx.fillStyle=sky;
    ctx.fillRect(0,0,worldWidth,horizon);

    const moon=ctx.createRadialGradient(worldWidth/2,150,8,worldWidth/2,150,150);
    moon.addColorStop(0,"rgba(142,117,190,.22)");
    moon.addColorStop(1,"rgba(142,117,190,0)");
    ctx.fillStyle=moon;
    ctx.fillRect(worldWidth/2-150,0,300,horizon);

    for(let i=0;i<34;i++){
      const x=(i*137+41)%worldWidth;
      const y=24+(i*53)%205;
      ctx.fillStyle=i%4===0 ? "rgba(255,210,235,.72)" : "rgba(181,177,220,.45)";
      ctx.fillRect(x,y,i%5===0?3:2,2);
    }

    for(let i=0;i<16;i++){
      const x=i*128-12;
      const width=108+(i%3)*12;
      const buildingHeight=104+((i*47)%128);
      const top=horizon-buildingHeight-14;
      ctx.fillStyle=i%2===0 ? "#11121f" : "#171526";
      ctx.fillRect(x,top,width,buildingHeight+14);
      ctx.fillStyle="#29233a";
      ctx.fillRect(x,top,width,5);
      ctx.fillStyle="rgba(11,10,20,.8)";
      ctx.fillRect(x+8,top+10,width-16,buildingHeight-8);

      const columns=Math.floor((width-24)/15);
      const rows=Math.floor((buildingHeight-24)/18);
      for(let row=0;row<rows;row++){
        for(let column=0;column<columns;column++){
          const lit=(i*11+row*7+column*3)%6===0;
          ctx.fillStyle=lit
            ? (i%3===0 ? "rgba(255,166,205,.72)" : "rgba(131,177,255,.62)")
            : "rgba(67,65,91,.42)";
          ctx.fillRect(x+13+column*15,top+16+row*18,6,8);
        }
      }

      if(i%4===1){
        const signX=x+width-28;
        const signY=top+28;
        ctx.save();
        ctx.shadowColor="#bd72d6";
        ctx.shadowBlur=12;
        ctx.fillStyle="rgba(43,24,58,.9)";
        ctx.fillRect(signX,signY,18,58);
        ctx.strokeStyle="#bb81d4";
        ctx.lineWidth=2;
        ctx.strokeRect(signX,signY,18,58);
        ctx.fillStyle="#e7c9f0";
        ctx.font="bold 8px monospace";
        ctx.textAlign="center";
        ctx.fillText("B",signX+9,signY+22);
        ctx.fillText("T",signX+9,signY+34);
        ctx.fillText("A",signX+9,signY+46);
        ctx.restore();
      }
    }

    // The lower skyline creates a second depth plane behind the playfield.
    for(let i=0;i<24;i++){
      const x=i*84-10;
      const h=48+((i*29)%64);
      ctx.fillStyle=i%2===0 ? "#201b31" : "#241d34";
      ctx.fillRect(x,horizon-h-4,76,h+4);
      ctx.fillStyle="rgba(138,117,168,.22)";
      ctx.fillRect(x,horizon-h-4,76,3);
      for(let w=0;w<3;w++){
        if((i+w)%3===0){
          ctx.fillStyle="rgba(242,166,206,.38)";
          ctx.fillRect(x+12+w*19,horizon-h+12,6,10);
        }
      }
    }

    const floor=ctx.createLinearGradient(0,horizon,0,arena.height);
    floor.addColorStop(0,"#292331");
    floor.addColorStop(0.18,"#17151f");
    floor.addColorStop(1,"#09090d");
    ctx.fillStyle=floor;
    ctx.fillRect(0,horizon,worldWidth,arena.height-horizon);

    ctx.strokeStyle="rgba(112,101,139,.22)";
    ctx.lineWidth=1;
    for(let x=0;x<=worldWidth;x+=64){
      ctx.beginPath();
      ctx.moveTo(x,horizon+2);
      ctx.lineTo(x,arena.height);
      ctx.stroke();
    }
    for(let y=horizon+28;y<arena.height;y+=28){
      ctx.beginPath();
      ctx.moveTo(0,y);
      ctx.lineTo(worldWidth,y);
      ctx.stroke();
    }

    ctx.save();
    ctx.shadowColor="#d07de2";
    ctx.shadowBlur=13;
    ctx.strokeStyle="#8b6a9d";
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(0,horizon);
    ctx.lineTo(worldWidth,horizon);
    ctx.stroke();
    ctx.restore();

    // Center-line and stage edges are deliberately subtle gameplay landmarks.
    ctx.fillStyle="rgba(195,146,218,.18)";
    ctx.fillRect(worldWidth/2-1,horizon-78,2,78);
    ctx.fillStyle="#5d4869";
    ctx.fillRect(0,horizon+6,worldWidth,3);
    ctx.fillStyle="#6a536f";
    ctx.fillRect(0,0,4,horizon);
    ctx.fillRect(worldWidth-4,0,4,horizon);
    ctx.fillStyle="rgba(199,144,219,.55)";
    ctx.fillRect(0,horizon,8,arena.height-horizon);
    ctx.fillRect(worldWidth-8,horizon,8,arena.height-horizon);
  }
  drawFighter(ctx, fighter, color, alpha) {
    const x = fighter.previousX + (fighter.x-fighter.previousX)*alpha;
    const y = fighter.previousY + (fighter.y-fighter.previousY)*alpha;
    const fighterScale = 3;
    const bodyWidth = 42, bodyHeight = fighter.crouching ? 48 : 76, top = -bodyHeight;
    ctx.save();
    ctx.fillStyle = "#3b3542";
    ctx.fillRect(x-(bodyWidth* fighterScale+10)/2,y-8,bodyWidth*fighterScale+10,8);
    ctx.translate(x,y);
    ctx.scale(fighterScale,fighterScale);
    ctx.fillStyle = color;
    ctx.fillRect(-bodyWidth/2,top+18,bodyWidth,bodyHeight-18);
    ctx.fillRect(-17,top,34,27);
    ctx.fillStyle = "#090909";
    ctx.fillRect(fighter.facing*7,top+10,5,5);
    if (fighter.state?.action === "guard") {
      ctx.strokeStyle = "#8ecbff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fighter.facing * 24, top + 43, 27, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    }
    if (fighter.state?.action === "attack" && fighter.actionData?.phase === "active") {
      ctx.strokeStyle = "#f0e7ff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(fighter.facing * 14, top + 44);
      ctx.quadraticCurveTo(fighter.facing * 34, top + 20, fighter.facing * 54, top + 42);
      ctx.stroke();
    }
    ctx.restore();
  }
  drawProjectiles(ctx, arena) {
    for (const projectile of arena.projectileController.projectiles) {
      ctx.save();
      const arcLance=projectile.moveId==="arcLance";
      ctx.fillStyle = arcLance ? "#d99aff" : "#8ecbff";
      ctx.strokeStyle = arcLance ? "#ffe0ff" : "#e6f5ff";
      ctx.lineWidth = arcLance ? 4 : 3;
      ctx.shadowColor = arcLance ? "#d99aff" : "#8ecbff";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(projectile.x,projectile.y,projectile.radius,0,Math.PI*2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  drawCombatBoxes(ctx, arena) {
    ctx.save();
    if(this.showHitboxes){
      const fighters=[arena.player,arena.opponent];
      ctx.lineWidth=2;
      ctx.setLineDash([5,4]);
      for(const fighter of fighters){
        const hurtbox=getHurtbox(fighter);
        ctx.strokeStyle=fighter===arena.player ? "#8ea6ff" : "#c39aff";
        ctx.strokeRect(
          hurtbox.left,hurtbox.top,
          hurtbox.right-hurtbox.left,hurtbox.bottom-hurtbox.top
        );
      }

      const hitbox=getActiveAttackHitbox(arena.player);
      if(hitbox){
        const colors=HITBOX_COLORS[arena.player.actionData.hitLevel] ?? HITBOX_COLORS.mid;
        ctx.setLineDash([]);
        ctx.fillStyle=colors.fill;
        ctx.strokeStyle=colors.stroke;
        ctx.fillRect(hitbox.left,hitbox.top,hitbox.right-hitbox.left,hitbox.bottom-hitbox.top);
        ctx.strokeRect(hitbox.left,hitbox.top,hitbox.right-hitbox.left,hitbox.bottom-hitbox.top);
      }

      const opponentHitbox=getActiveAttackHitbox(arena.opponent);
      if(opponentHitbox){
        const colors=HITBOX_COLORS[arena.opponent.actionData.hitLevel] ?? HITBOX_COLORS.mid;
        ctx.setLineDash([]);
        ctx.fillStyle=colors.fill;
        ctx.strokeStyle=colors.stroke;
        ctx.fillRect(opponentHitbox.left,opponentHitbox.top,opponentHitbox.right-opponentHitbox.left,opponentHitbox.bottom-opponentHitbox.top);
        ctx.strokeRect(opponentHitbox.left,opponentHitbox.top,opponentHitbox.right-opponentHitbox.left,opponentHitbox.bottom-opponentHitbox.top);
      }
    }

    if(arena.lastHit){
      ctx.globalAlpha=Math.min(1,arena.lastHit.remaining/0.12);
      ctx.fillStyle=HITBOX_COLORS[arena.lastHit.hitLevel]?.stroke ?? "#ffe096";
      ctx.font="bold 22px monospace";
      ctx.textAlign="center";
      const level=arena.lastHit.hitLevel?.toUpperCase();
      const outcome=arena.lastHit.outcome==="guardBreak"
        ? "GUARD BREAK"
        : arena.lastHit.outcome==="block"
          ? "BLOCKED"
          : arena.lastHit.outcome==="juggleDrop"
            ? "JUGGLE DROP"
            : "HIT";
      const label=[level,arena.lastHit.moveName.toUpperCase(),outcome].filter(Boolean).join(" ");
      ctx.fillText(label,arena.lastHit.x,arena.lastHit.y);
    }
    ctx.restore();
  }

  drawHud(ctx, arena) {
    const guardWidth = fighter => 300 * Math.max(0, Math.min(1, (fighter.guardMeter ?? 100) / 100));
    ctx.fillStyle = COLORS.text; ctx.font = "bold 16px monospace"; ctx.textAlign = "left"; ctx.fillText("PLAYER 01",32,22);
    ctx.textAlign = "right"; ctx.fillText(arena.opponent.displayName ?? "CPU RIVAL",arena.width-32,22);
    ctx.fillStyle = "#302d35"; ctx.fillRect(32,30,300,12); ctx.fillRect(arena.width-332,30,300,12);
    ctx.fillStyle = COLORS.player; ctx.fillRect(32,30,300*arena.player.health,12);
    ctx.fillStyle = COLORS.opponent; ctx.fillRect(arena.width-332+300*(1-arena.opponent.health),30,300*arena.opponent.health,12);

    ctx.fillStyle = "#302d35";
    ctx.fillRect(32,51,300,5);
    ctx.fillRect(arena.width-332,51,300,5);
    ctx.fillStyle = "#8ecbff";
    ctx.fillRect(32,51,guardWidth(arena.player),5);
    const opponentGuardWidth = guardWidth(arena.opponent);
    ctx.fillRect(arena.width-332+300-opponentGuardWidth,51,opponentGuardWidth,5);
    ctx.fillStyle = COLORS.text; ctx.font = "8px monospace"; ctx.textAlign = "left"; ctx.fillText("GUARD",32,67);
    ctx.textAlign = "right"; ctx.fillText("GUARD",arena.width-32,67);

    const rounds = arena.rounds;
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.accent;
    ctx.font = "bold 20px monospace";
    ctx.fillText(arena.trainingMode ? "TRAINING" : String(Math.ceil(rounds.timerRemaining)),arena.width/2,42);
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 9px monospace";
    ctx.fillText(arena.trainingMode ? "DUMMY · AUTO-RECOVERY" : "ROUND " + rounds.roundNumber,arena.width/2,66);
    ctx.font = "bold 11px monospace";
    ctx.fillText(arena.trainingMode ? "PRACTICE MODE" : rounds.score.player + "  -  " + rounds.score.opponent,arena.width/2,82);
  }

  drawComboCounter(ctx, arena) {
    const combo=arena.comboTracker?.getComboForAttacker(arena.player);
    if(!combo || combo.hitCount<2) return;
    ctx.save();
    ctx.textAlign="center";
    ctx.fillStyle=combo.airCombo ? "#8ecbff" : "#ffe096";
    ctx.font="bold 20px monospace";
    ctx.fillText((combo.airCombo ? "AIR COMBO" : "COMBO") + " x" + combo.hitCount,arena.width/2,112);
    ctx.fillStyle=COLORS.text;
    ctx.font="bold 10px monospace";
    ctx.fillText((combo.totalDamage*100).toFixed(1) + "% DAMAGE",arena.width/2,128);
    ctx.restore();
  }

  drawInputBuffer(ctx, arena) {
    const remaining=arena.inputBuffer?.remainingFrames(arena.inputFrame ?? 0) ?? 0;
    const action=arena.inputBuffer?.pending?.action;
    if (!remaining || !action) return;
    ctx.save();
    ctx.fillStyle="#ffe096";
    ctx.font="bold 11px monospace";
    ctx.textAlign="left";
    const label=action==="special" && arena.inputBuffer.pending?.specialMove==="arcLance"
      ? "ARC LANCE"
      : action.toUpperCase();
    ctx.fillText("BUFFER " + label + " · " + remaining + "F",32,arena.height-18);
    ctx.restore();
  }

  drawCommandFeedback(ctx, arena) {
    if (!(arena.commandFeedbackRemaining > 0) || !arena.commandFeedbackText) return;
    ctx.save();
    ctx.fillStyle = "#8ecbff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(arena.commandFeedbackText + " · SPECIAL", arena.width/2, arena.height-18);
    ctx.restore();
  }

  drawRoundOverlay(ctx, arena) {
    const rounds = arena.rounds;
    let headline = null;
    let detail = "";
    let prompt = "";

    if (rounds.phase === ROUND_PHASES.ROUND_INTRO) {
      headline = "ROUND " + rounds.roundNumber;
      detail = "GET READY";
    } else if (rounds.phase === ROUND_PHASES.ROUND_OVER) {
      headline = rounds.roundWinner
        ? (rounds.roundWinner === "player" ? "PLAYER 01 WINS ROUND" : "CPU RIVAL WINS ROUND")
        : "ROUND DRAW";
      detail = rounds.resultReason === "timeout"
        ? "TIME UP"
        : rounds.resultReason === "doubleKO"
          ? "DOUBLE K.O."
          : "K.O.";
    } else if (rounds.phase === ROUND_PHASES.MATCH_OVER) {
      headline = rounds.matchWinner === "player" ? "PLAYER 01 WINS" : "CPU RIVAL WINS";
      detail = "MATCH COMPLETE";
      prompt = "PRESS ENTER TO REMATCH";
    } else if (rounds.phase === ROUND_PHASES.ACTIVE && rounds.bannerRemaining > 0) {
      headline = rounds.bannerText;
    }

    if (!headline) return;

    const isFightBanner = rounds.phase === ROUND_PHASES.ACTIVE;
    ctx.save();
    ctx.fillStyle = isFightBanner ? "rgba(0,0,0,.48)" : "rgba(0,0,0,.76)";
    ctx.fillRect(150,190,660,160);
    ctx.strokeStyle = "#51495b";
    ctx.lineWidth = 2;
    ctx.strokeRect(150,190,660,160);
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.accent;
    ctx.font = "bold " + (isFightBanner ? "30px" : "28px") + " monospace";
    ctx.fillText(headline,arena.width/2,252);
    if (detail) {
      ctx.fillStyle = COLORS.text;
      ctx.font = "bold 13px monospace";
      ctx.fillText(detail,arena.width/2,286);
    }
    if (prompt) {
      ctx.fillStyle = COLORS.accent;
      ctx.font = "bold 12px monospace";
      ctx.fillText(prompt,arena.width/2,316);
    }
    ctx.restore();
  }
}
